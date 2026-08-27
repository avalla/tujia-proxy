import { writeFileSync, statSync } from 'fs';
import path from 'path';
import { CONFIG } from '../config';
import { isAnonymous, hasCookies } from './cookieJar';

/**
 * Minting a Tujia session by driving the real mobile site once.
 *
 * Tujia's sessions are short-lived and its login is SMS-only to Chinese numbers, so
 * an anonymous session is the practical way to keep the proxy working — see CLAUDE.md.
 * This is the one implementation; `scripts/mint-session.ts` and the server's periodic
 * refresh both call it.
 */

export interface MintResult {
  file: string;
  cookieCount: number;
  loggedIn: boolean;
  /** Whether Tujia's own search XHR on the page succeeded — a weak session if not. */
  searchOk: boolean;
}

/**
 * Drive m.tujia.com once and write the session it hands back.
 *
 * `wait` exists because the cookie set is only complete after Tujia's own JS has run
 * a search; a session dumped straight after `load` has three cookies instead of twelve.
 */
export async function mintSession(
  opts: { out?: string; cityId?: string; headless?: boolean; wait?: number } = {}
): Promise<MintResult> {
  const out = path.resolve(opts.out || CONFIG.COOKIES_FILE);
  const cityId = opts.cityId || '45';

  // Imported here rather than at module scope: Playwright pulls in a browser driver,
  // and the HTTP path should not pay for it on every start when refresh is disabled.
  const { chromium, devices } = await import('playwright');

  const browser = await chromium.launch({ headless: opts.headless !== false });
  try {
    // A mobile context deliberately: m.tujia.com mints mobile sessions and TujiaClient
    // sends a matching mobile UA. Mixing the two is rejected with errcode 55999.
    const ctx = await browser.newContext(devices['iPhone 13']);
    const page = await ctx.newPage();

    let searchOk = false;
    page.on('response', async (res) => {
      if (!res.url().includes('searchhouse')) return;
      try {
        if (((await res.json())?.errcode ?? 0) === 0) searchOk = true;
      } catch {
        /* not JSON */
      }
    });

    await page.goto(`https://m.tujia.com/hotel_city${cityId}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(opts.wait ?? 12000);

    const cookies = await ctx.cookies();
    if (!cookies.length) throw new Error('Tujia returned no cookies — did the page fail to load?');

    const loggedIn = cookies.some((c) => c.name === 'tujia.com_PortalContext_UserToken');
    writeFileSync(
      out,
      [
        `# Minted ${new Date().toISOString()} — ${loggedIn ? 'logged in' : 'anonymous'}.`,
        '# Real session data: gitignored, never commit it.',
        ...cookies.map((c) => `${c.name}=${c.value}`),
      ].join('\n') + '\n'
    );

    return { file: out, cookieCount: cookies.length, loggedIn, searchOk };
  } finally {
    await browser.close();
  }
}

/**
 * Keep `cookies.txt` fresh: mint once at startup, then on an interval.
 *
 * Three guards matter more than the timer:
 *
 *  - **A logged-in session is never overwritten.** Replacing one with an anonymous
 *    session would silently drop member pricing, and there is no way to mint a
 *    logged-in one unattended.
 *  - **A session younger than the interval is left alone.** `bun run dev` runs under
 *    `--watch`, so without this every file save would launch a browser.
 *  - **A failed refresh is not fatal.** The existing session usually still works; a
 *    browser that would not launch is no reason to take the API down.
 */
export function startSessionRefresh(intervalMs: number): { stop: () => void } {
  let running = false;

  /** Age of the session file in ms, or Infinity when there isn't one. */
  const sessionAgeMs = (): number => {
    try {
      return Date.now() - statSync(path.resolve(CONFIG.COOKIES_FILE)).mtimeMs;
    } catch {
      return Infinity;
    }
  };

  const refresh = async (reason: string) => {
    if (running) return; // a slow mint must not overlap the next tick
    if (hasCookies() && !isAnonymous()) {
      console.log('[session] logged-in session present — leaving it alone');
      return;
    }
    const age = sessionAgeMs();
    if (reason === 'startup' && age < intervalMs) {
      console.log(`[session] current session is ${Math.round(age / 60_000)} min old — no refresh needed`);
      return;
    }
    running = true;
    try {
      const r = await mintSession();
      console.log(
        `[session] refreshed (${reason}): ${r.cookieCount} cookies, ` +
          `${r.loggedIn ? 'logged in' : 'anonymous'}${r.searchOk ? '' : ', WEAK — search XHR did not succeed'}`
      );
    } catch (err: any) {
      console.warn(`[session] refresh failed (${reason}): ${err.message} — keeping the current session`);
    } finally {
      running = false;
    }
  };

  void refresh('startup');
  const timer = setInterval(() => void refresh('scheduled'), intervalMs);
  // Do not hold the process open on this alone.
  if (typeof timer.unref === 'function') timer.unref();

  return { stop: () => clearInterval(timer) };
}
