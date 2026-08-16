import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';

/**
 * Loads the Tujia browser session from disk instead of hardcoding it in source.
 *
 * The file is gitignored — it holds a real logged-in session (UserToken, UserId,
 * session id) and must never be committed. See cookies.example.txt for the format.
 *
 * Two formats are accepted, so you can paste from either place in DevTools:
 *   1. one `name=value` per line, `#` comments allowed  (Application → Cookies)
 *   2. a single line of `a=1; b=2; c=3`                  (copy of the Cookie: header)
 *
 * The file is re-read when its mtime changes, so refreshing an expired session
 * does not require restarting the server.
 */

export class MissingCookiesError extends Error {
  readonly status = 401;
  constructor(file: string, detail: string) {
    super(
      `${detail}\n` +
        `Expected a Tujia session at: ${file}\n` +
        `Copy your cookies from DevTools (Application → Cookies → m.tujia.com), or\n` +
        `start from cookies.example.txt. Set TUJIA_COOKIES_FILE to use another path.`
    );
    this.name = 'MissingCookiesError';
  }
}

/** Cookies that carry the search context and are overridden per request. */
const START_DATE = 'tujia.com_MobileContext_StartDate';
const END_DATE = 'tujia.com_MobileContext_EndDate';

let cache: { mtimeMs: number; jar: Map<string, string> } | null = null;

function parse(raw: string): Map<string, string> {
  const jar = new Map<string, string>();
  // A pasted Cookie: header is one line of "a=1; b=2" — split those too.
  const chunks = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .flatMap((l) => (l.includes(';') ? l.split(';') : [l]));

  for (const chunk of chunks) {
    const line = chunk.trim().replace(/^Cookie:\s*/i, '');
    if (!line) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    jar.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return jar;
}

function load(): Map<string, string> {
  const file = path.resolve(CONFIG.COOKIES_FILE);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    cache = null;
    throw new MissingCookiesError(file, 'No Tujia cookie file found.');
  }

  if (cache && cache.mtimeMs === stat.mtimeMs) return cache.jar;

  const jar = parse(fs.readFileSync(file, 'utf8'));
  if (!jar.size) {
    cache = null;
    throw new MissingCookiesError(file, 'The Tujia cookie file is empty.');
  }
  if (!jar.has('tujia.com_PortalContext_UserToken')) {
    console.warn(
      `[tujia] ${file} has no tujia.com_PortalContext_UserToken — ` +
        'search will likely fail with a login error.'
    );
  }

  cache = { mtimeMs: stat.mtimeMs, jar };
  console.log(`[tujia] loaded ${jar.size} cookies from ${file}`);
  return jar;
}

/**
 * Serialize the session into a Cookie header.
 * `dates` overrides the stay-context cookies so they match the query being sent
 * rather than whenever the session happened to be captured.
 */
export function cookieHeader(dates?: { checkIn?: string; checkOut?: string }): string {
  const jar = new Map(load());
  if (dates?.checkIn) jar.set(START_DATE, dates.checkIn);
  if (dates?.checkOut) jar.set(END_DATE, dates.checkOut);
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

/** True when a usable session file is present; used by the health endpoint. */
export function hasCookies(): boolean {
  try {
    load();
    return true;
  } catch {
    return false;
  }
}
