#!/usr/bin/env bun
/**
 * Mint a Tujia session by loading the real mobile site once in Playwright, and write
 * it to `cookies.txt` in the format cookieJar.ts reads.
 *
 *   bun run session                    # writes ./cookies.txt
 *   bun run session -- --out /tmp/x    # somewhere else
 *   bun run session -- --login         # opens a visible browser and waits for you
 *
 * The default is ANONYMOUS — no login. That is enough for everything this proxy
 * does: search, the filter taxonomy, and listing detail all answer without one.
 * A logged-in session additionally unlocks Tujia's member pricing (the
 * "登录后解锁超低价 / 最高85折" strip on the site — up to ~15% off), so prices from an
 * anonymous session are the public ones. Nothing breaks without it.
 *
 * Two things this exists to avoid:
 *   - copying cookies out of DevTools by hand every time a session dies
 *   - needing to receive Tujia's login SMS, which only reaches Chinese numbers
 */
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const arg = (flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const out = arg('--out', './cookies.txt');
const cityId = arg('--city', '45');
const wantLogin = args.includes('--login');

const browser = await chromium.launch({ headless: !wantLogin });
// A mobile context, deliberately: m.tujia.com mints mobile sessions, and TujiaClient
// sends a matching mobile User-Agent. Mixing the two gets errcode 55999.
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

console.log(`[*] loading m.tujia.com/hotel_city${cityId}/ …`);
await page.goto(`https://m.tujia.com/hotel_city${cityId}/`, {
  waitUntil: 'domcontentloaded',
  timeout: 45000,
});
// Wait for the page's own search XHR: the session only picks up its full cookie set
// once Tujia's JS has run a request, and a half-formed one is not worth writing.
await page.waitForTimeout(12000);

if (wantLogin) {
  console.log('\n[!] Log in in the browser window, then press Enter here.');
  await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()));
}

const cookies = await ctx.cookies();
await browser.close();

if (!cookies.length) {
  console.error('✗ no cookies came back — did the page fail to load?');
  process.exit(1);
}

const loggedIn = cookies.some((c) => c.name === 'tujia.com_PortalContext_UserToken');
writeFileSync(
  out,
  [
    `# Minted by \`bun run session\` — ${loggedIn ? 'logged in' : 'anonymous'}.`,
    '# Real session data: gitignored, never commit it.',
    ...cookies.map((c) => `${c.name}=${c.value}`),
  ].join('\n') + '\n'
);

console.log(`[✓] wrote ${cookies.length} cookies to ${out}`);
console.log(`    logged in: ${loggedIn ? 'yes' : 'no (member pricing not available)'}`);
console.log(`    page's own search succeeded: ${searchOk ? 'yes' : 'no — session may be weak'}`);
