# Tujia Playwright Scraper

Scrapes Tujia (m.tujia.com) using a real browser to bypass anti-bot protection.

## Install

```bash
bun install
npx playwright install chromium
```

## First Run (Login Required)

Tujia requires login for search. The scraper will open a browser window for you to log in manually.

```bash
# First time — open in headed mode to log in
bun run scraper --headed
```

1. The browser opens to Tujia
2. Log in with your **phone / WeChat / Tujia account**
3. After successful login, the session is saved automatically to `./storage/tujia-state.json`
4. The scraper continues

## Subsequent Runs (No Login Needed)

```bash
# Uses saved session — fully headless
bun run scraper

# Or with custom options
bun run scraper --checkin 2026-10-10 --checkout 2026-11-05 --guests 1
```

## Options

| Flag | Default | Description |
|---|---|---|
| `--city` | `45` | Tujia city ID |
| `--city-name` | `guangzhou` | City name for filename |
| `--checkin` | `2026-10-10` | Check-in date |
| `--checkout` | `2026-11-05` | Check-out date |
| `--guests` | `1` | Number of guests |
| `--headed` | `false` | Show browser window |
| `--out` | `./output` | Output directory |
| `--state` | `./storage/tujia-state.json` | Session storage path |

## Output

JSON file with extracted hotels + raw API responses for debugging.

## Troubleshooting

**"Login required" on every run?**
- Make sure the `--state` file path is writable
- Check that `./storage/` directory exists after first login
- If session expired, delete `./storage/tujia-state.json` and re-login

**No hotels found?**
- Tujia may block certain date ranges during Canton Fair
- Try with nearer dates first to test
- Check `output/*.json` rawResponses for API errors
