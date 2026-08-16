import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  TUJIA_API_URL: process.env.TUJIA_API_URL || 'https://m.tujia.com',
  CACHE_TTL: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  /** Path to the gitignored Tujia session file. See src/services/cookieJar.ts. */
  COOKIES_FILE: process.env.TUJIA_COOKIES_FILE || './cookies.txt',
  CNY_TO_EUR: 0.13,
};
