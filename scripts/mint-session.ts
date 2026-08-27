#!/usr/bin/env bun
/**
 * Mint a Tujia session into `cookies.txt`, by hand.
 *
 *   bun run session                    # anonymous, headless
 *   bun run session -- --out /tmp/x    # somewhere else
 *   bun run session -- --login         # visible browser, waits for you to log in
 *
 * The server does this for itself every 30 minutes (see `startSessionRefresh`), so
 * reach for this when the server is not running, when you want a logged-in session,
 * or when you have disabled the automatic refresh.
 *
 * Anonymous is enough for everything the proxy does: search, the filter taxonomy and
 * listing detail all answer without a login. What a login buys is Tujia's member
 * pricing — without it, prices come back masked ("1??") and the UI shows a range.
 */
import { mintSession } from '../src/services/sessionMinter';
import { CONFIG } from '../src/config';

const args = process.argv.slice(2);
const arg = (flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const out = arg('--out', CONFIG.COOKIES_FILE);
const cityId = arg('--city', '45');
const wantLogin = args.includes('--login');

if (wantLogin) {
  console.log('[*] opening a visible browser — log in, then close it to save the session.');
  console.log('    (Tujia only sends its login SMS to Chinese numbers.)');
}

console.log(`[*] loading m.tujia.com/hotel_city${cityId}/ …`);
const r = await mintSession({
  out,
  cityId,
  headless: !wantLogin,
  // A visible login needs time to type a code in; headless just needs the page's own
  // search XHR to land, which fills out the cookie set.
  wait: wantLogin ? 240_000 : 12_000,
});

console.log(`[✓] wrote ${r.cookieCount} cookies to ${r.file}`);
console.log(`    logged in: ${r.loggedIn ? 'yes' : 'no (member pricing not available)'}`);
console.log(`    page's own search succeeded: ${r.searchOk ? 'yes' : 'no — session may be weak'}`);
