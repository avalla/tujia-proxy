import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  TUJIA_API_URL: process.env.TUJIA_API_URL || 'https://m.tujia.com',
  CACHE_TTL: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  /** Path to the gitignored Tujia session file. See src/services/cookieJar.ts. */
  COOKIES_FILE: process.env.TUJIA_COOKIES_FILE || './cookies.txt',
  /**
   * How often the server re-mints an anonymous Tujia session, in minutes.
   * `0` disables it — useful when you keep a logged-in session by hand, or in an
   * environment with no browser. A logged-in session is never overwritten either way.
   */
  SESSION_REFRESH_MINUTES: parseInt(process.env.TUJIA_SESSION_REFRESH_MINUTES || '30', 10),
  CNY_TO_EUR: 0.13,
};
