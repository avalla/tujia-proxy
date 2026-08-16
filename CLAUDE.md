# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An English-language proxy over Tujia (途家, m.tujia.com), a Chinese short-term rental site, specialized for finding Canton Fair accommodation in Guangzhou. There is no public Tujia API — everything here is reverse-engineered from the mobile web app's XHR traffic.

## Commands

Runtime is **Bun** (TypeScript runs natively; `tsconfig.json` exists for editor/type-checking only — nothing compiles it in the normal flow).

```bash
bun install

bun run dev              # express server + English UI, hot reload, :3000
bun run start            # express server, no watch
bun run build            # bundle to dist/ (--target=bun)

bun run catalog          # regenerate src/catalog/filters.generated.ts from Tujia's live taxonomy
bun run mock             # run mapper against a fixture, prints HotelEn JSON

bun run scraper          # Playwright scrape, headless, uses saved session
bun run scraper:headed   # visible browser (needed for first-time login)
bun run scraper -- --city 45 --checkin 2026-10-10 --checkout 2026-11-05 --guests 1

npx playwright install chromium   # one-time, before first scrape
```

There is **no test framework**. `test-*.sh` are raw `curl` probes against the live Tujia endpoints used to re-derive the request shape when it breaks — they are not assertions and are not run by CI. `bun run mock` is the closest thing to a unit check: it runs `mapper.ts` over a real captured `data.items[0]` (`src/mocks/search-item.json`), so field-name drift surfaces there first.

`npx tsc --noEmit` typechecks (nothing in the normal flow compiles the project — Bun runs the TS directly).

## The filter catalog (`src/catalog/filters.generated.ts`)

Generated, committed, and **never hand-edited** — `bun run catalog` overwrites it. It is the single source of truth for filter ids and their English names: 21 metro lines / 406 stations (with bd09 coordinates), 11 districts, 50 attractions, 104 filters in 12 groups, 5 sort orders, 8 price bands.

English names come from three sources, in priority order:
1. hand dictionaries in `scripts/generate-catalog.ts` (group names, sort orders, metro line names)
2. `translateAmenity()` from `utils/translator.ts` — so the mapper and the UI share one vocabulary
3. pinyin transliteration via `pinyin-pro`, for the ~400 metro stations nobody has translated

Tujia ships an `englishName` field on every filter item and leaves it `null` in every single case, and only romanizes attractions/universities/hospitals — never stations or districts. Hence step 3. Transliteration runs at **generation** time, not runtime, so the output is diffable and correctable.

If the generator reports filters falling back to pinyin, add them to `AMENITY_MAP` in `utils/translator.ts` rather than editing the generated file. Brand names under 品牌民宿 are exempt — transliteration is correct for those.

`TujiaClient.buildConditions()` resolves amenity values through this catalog, so the search API accepts any of the 104 filter ids; the `acceptForeigners` / `nearMetro` / `freeParking` booleans are just aliases folded into `amenities`.

## Whole-line filter ("near line X")

Each line subgroup in the taxonomy carries a `全线` pseudo-entry whose value is a **`7_*`** condition (stations are `1_*`). It filters the entire line server-side — verified against an unfiltered control, measuring distance to Line 8 with our own geo:

| | filtered `7_268250` | unfiltered |
|---|---|---|
| median distance to Line 8 | 1.20 km | 4.65 km |
| max | 4.66 km | 65.30 km |
| within 1.5 km | 39/60 | 13/60 |

Three rules, each learned the hard way:

- **Send at most one.** Two whole-line conditions do not OR — Tujia honours only the last (Line 3's two ids gave 8902 and 6107; both together gave 6107).
- **A station beats a line.** Both are type-5 geo conditions and only one is honoured, so `buildConditions()` sends the station when `metroStationId` is set and ignores `metroLineId`. The UI mirrors this by disabling the line select.
- **Repeated line names are not duplicates.** Line 3 genuinely branches at Tiyu Xilu, so segments are kept separate and disambiguated by terminus (`Line 3 · Tiyuxilu ↔ Jichangbei`). The generator only drops a segment whose stations are a strict subset of a longer same-named one — that removed exactly one 1-station "Line 2" stub.

`MetroLine` therefore carries both `en` (short, for card badges) and `label` (unique, for the picker).

**UI caveat worth preserving:** with a line filter active, the card leads with the nearest station *on that line*, not the globally nearest. The globally nearest is often on Line 11 (a loop interchanging with nearly everything), so showing it made a working Line 8 filter look broken — 10 cards, only 2 badged "Line 8". The true nearest is kept as a muted second line. That calculation lives in `nearestOnFilteredLine()` in `app.js`, client-side because it depends on the query.

## Pagination

Tujia honours `pageIndex`/`pageSize` (verified: consecutive pages return disjoint id sets; `pageSize` 5/20/30 all respected), but two things make naive paging wrong:

- **The client must not compute `pageIndex + 1`.** When `maxDistanceToFairKm` is set, the server walks several upstream pages per response to fill one. `/api/v1/search` therefore returns a **`nextPageIndex` cursor** plus `hasMore`; echo the cursor back. Measured jumps: `0 → 4 → 9 → 17`.
- **`hasMore` keys on upstream exhaustion, not on whether the response kept anything.** A local-filter scan can burn its 8-page budget in a sparse stretch and keep zero results while thousands remain. Gating on `results.length > 0` would wrongly say "that's all".

`nextPageIndex` is `null` only when an upstream page returns fewer than `pageSize` items. Page 400 returns `total: 0, hasMore: false, nextPageIndex: null`.

The UI appends via a Load-more button and **dedupes by id** — Tujia's live popularity ranking drifts between requests, so the same listing can appear on two pages. That is why the on-screen count sometimes grows by 9 rather than 10.

## The web UI (`public/`)

Plain HTML/CSS/JS — no build step, no framework, no CDN. Express serves it via `express.static`, mounted **after** `/api/*` so API routes always win. `GET /api/v1/filters` feeds the form.

Two things worth knowing before editing it:

- **Listing titles are synthesized.** Tujia's `unitName` is Chinese keyword-spam (`广州天河区/新装修/清新雅致复式/琶洲交易会/...`) and there is no English title anywhere in the API. `headline()` in `app.js` builds a readable line out of the structured facts instead (`"Entire apartment · 67 m² in Liwan"`) and the original is kept underneath in a `lang="zh-CN"` element. Don't "fix" this by showing the raw name as the title.
- **Colours are tokens in `:root` with a `prefers-color-scheme: dark` override.** `--ink-3` is tuned to the WCAG AA threshold against `--surface` in both themes; if you darken/lighten it, re-check contrast.

## Two independent data paths

The repo contains two unrelated ways to get Tujia data. They share no code, and diverge in output shape. Know which one you're touching.

**1. HTTP proxy** (`src/index.ts` → `server.ts` → `routes/` → `services/tujiaClient.ts`)
Express + axios. Hits Tujia's JSON endpoints directly with forged browser headers. Fast, but auth-fragile (see below). Returns the rich `HotelEn` shape from `src/types/index.ts`.

**2. Playwright scraper** (`src/scraper-cli.ts` → `src/scraper.ts`)
Drives a real mobile-emulated Chromium at `m.tujia.com/hotel_city<id>/`, and rather than parsing the DOM, **intercepts the page's own XHR responses** (`page.on('response')`, filtered on `searchhouse/bnb`), scrolls to trigger more, then extracts from the collected JSON. Survives anti-bot; slower and needs an interactive login once. Writes `output/tujia-<city>-<date>-<ts>.json` containing both flattened hotels and `rawResponses` for debugging. Its output type is `ScrapedHotel` — a flatter, separate shape, with its own inlined `CNY_TO_EUR` constant duplicating `utils/currency.ts`.

If you change how a hotel record is read from Tujia's payload, you likely need to change it in **both** `services/mapper.ts` and `scraper.ts:extractHotels()`. Both now read `data.items`.

## The two Tujia endpoints (verified live)

Both are POSTs that take the **same** `conditions` array, and they answer completely differently. `requests.http` holds sniffed copies of both.

| Endpoint | Returns | Notes |
|---|---|---|
| `/bnbapp-node-h5/h5/search/v2/searchhouse/bnb` | **Listings**, in `data.items` | Also `data.totalCount` (all matches) and `data.canBookCount` (bookable for those dates). Needs `feLog`, and user-chosen conditions marked `"selected": true`. `TujiaClient.search()` |
| `/bnbapp-node-h5/h5/search/conditions/fetch` | **Filter taxonomy only**, in `data.allConditions` | No listings at all. ~880 leaf items in a group/subGroup tree, contextualized to the conditions you send. `TujiaClient.fetchConditions()`, consumed by the catalog generator |

`GET /bnbapp-node-h5/h5/unit/detail` **does not exist** — it 404s with a Ctrip-style `ResponseStatus` envelope. `routes/detail.ts` returns 501 until someone sniffs the real detail request into `requests.http`.

Tujia mirrors the active filter set into the page URL as `<type>-<value>` pairs, and reads the `Referer`:
`/hotel_city45_5-1_268263/6-237_6-2301_6-502_7-0,300/` — city+metro in the first segment, the rest underscore-joined. `TujiaClient.buildReferer()` reconstructs this rather than hardcoding it.

### Search-result field names

`data.items[]` uses none of the names a detail-style payload would. These are verified against a live response (a captured item lives at `src/mocks/search-item.json`, exercised by `bun run mock`):

- price → `finalPrice` (after discount) and `productPrice` (before)
- rating → `commentBrief.overall`, count → `commentBrief.totalCount`, label → `.scoreTitle`
- amenities → `houseTagsForCD[].text`; `houseTags[]` is the promo strip and carries discount copy, not amenities
- `pictureList` is a plain array of URL **strings**
- room facts → `unitSummeries[]`, discriminated by `textType`: `CANLIVEDESC` (`"2居2大床4人"`), `HOUSELEVEL` (`"整套28㎡"`), `NAVIGATIONINFO`
- every unit carries real `longitude`/`latitude` plus `distance` (metres to whatever landmark the search was anchored on)
- availability → `failType === 0 && fitSearchCondition !== false`
- no host name / superhost / response-rate fields exist on this endpoint
- **no listing URL is returned.** The public page is `https://m.tujia.com/detail/<unitId>.htm`. Don't try to verify a URL guess with curl: every path under `m.tujia.com` answers HTTP 200 with the same ~12 KB SPA shell, so `/product/<id>.htm` and `/unit_<id>/` look identical to `/detail/<id>.htm` over HTTP. Only a rendered browser check distinguishes them (`/detail/` renders 房屋详情; the others render an empty shell).

### Coordinates

`mapper.ts` computes `location.nearestMetro` for **every** listing by scanning the catalog's 406 stations from the unit's own coordinates — independent of whether the search was anchored on a station. Stations are collapsed by name at module load, so interchanges report every line serving them (`Fangcun → Lines 1 & 11 & 22`). This is a different number from `distanceToSearchAnchorM`, which is Tujia's distance to the *searched* station: a listing anchored on Wanshengwei at 4.3 km may sit 0.6 km from Tangdong.

Every coordinate Tujia returns is Baidu **`bd09ll`** (stated per-unit in `geoCoordSysType`). `utils/geo.ts` deliberately never converts to WGS84 — it only ever measures Tujia points against other Tujia points, so staying in bd09 keeps the error at zero. The Canton Fair reference point is Tujia's own taxonomy entry `5_23158498` (`113.36747, 23.106647`). The haversine there was checked against Tujia's own `distance` field across a full page of results and agrees to within 1 m.

## The `conditions` protocol (core domain knowledge)

Tujia's search takes an untyped array of filter objects; `TujiaClient.buildConditions()` is the encoder and is the least obvious code in the repo. The `type` field selects the filter kind:

| type | meaning | notes |
|---|---|---|
| 1 | city | value = cityId, plus lat/lng + `pingYin`/`pinYin` |
| 2 / 3 | check-in / check-out | value = `YYYY-MM-DD` |
| 4 | sort order | `'1'` = 欢迎度排序 (popularity) |
| 5 | metro station | value = e.g. `1_268263`, must carry the station's lat/lng |
| 6 | amenity / guests | discriminated further by `conditionType` |
| 7 | price range | value = `"min,max"`, `conditionType: 101` |

Within `type: 6`, `conditionType` matters: `2` = amenity (`218` free parking, `219` paid parking, `237` accepts foreigners), `23` = near metro (`2301`) / pets (`2304`), `5` = guest count (`500 + n`, n in 1..15), `11` = bed count (`1100 + n`), `0` = bedroom count (plain `n`), `25` = rating floor, `26` = review-count floor.

User-chosen filters carry `"selected": true`; implicit context (city, check-in, check-out) does not. Ordering is significant: metro first, city/dates last. Preserve it when adding conditions.

The live taxonomy is the authority on valid ids — call `TujiaClient.fetchConditions()` rather than guessing. It returns ~880 items across 筛选 (filters), 位置 (location: 24 metro lines with per-station coordinates, 11 districts, scenic spots, stations, universities, hospitals), 排序 (6 sort orders), and a guests/beds/rooms/price group. Every item ships an `englishName` field that Tujia always leaves `null`.

Reference payloads: `requests.http` (both endpoints, current) and `test-*.sh` (curl probes). When search starts returning nothing, re-sniff and diff against those.

## Auth, and how it breaks

The proxy authenticates with a real browser session (`_fas_session_id`, `tujia.com_PortalContext_UserToken`, `UserId`, …), loaded by `src/services/cookieJar.ts` from a **gitignored `cookies.txt`** — never from source. `cookies.example.txt` is the committed template.

- path overridable with `TUJIA_COOKIES_FILE`
- two input formats: `name=value` per line with `#` comments, or a single pasted `Cookie: a=1; b=2` header
- the file is re-read on mtime change, so an expired session can be refreshed **without restarting**
- the `MobileContext_StartDate`/`EndDate` cookies are overwritten per request to match the dates being queried, so a stale capture doesn't leak the wrong stay window
- missing/empty file → `MissingCookiesError` (HTTP 401) with the path and instructions; `GET /api` reports `session: "MISSING"`

Sessions expire. When search starts returning 401 or errcode `55004` / 登录 prompts, refresh `cookies.txt`.

**Other files still contain a live session** and are not loaded by the app, but should not be published as-is: `requests.http`, `test-curl.sh`, `test-search.sh`, `test-real-search.sh`, `test-full-search.sh`. `temp.json` and `response.json` are captured responses and are now gitignored.

The scraper solves the same problem properly: `storage/tujia-state.json` (gitignored) holds a Playwright storage state. `handleLoginIfNeeded()` detects login walls by scanning page text for 登录 / 请重新登录 / `55004`, opens `m.tujia.com/login`, and blocks up to 5 minutes for a human to authenticate before persisting the session.

`ssl-bypass-lite.js` and `ssl-pinning-disable.js` are **Frida scripts for an Android emulator**, not part of the Node app — they disable certificate pinning so the native Tujia app's traffic can be read through mitmproxy. That was the original sniffing route (see README's "Sniffing the Token"); the current code uses the m.tujia.com web endpoints instead.

## Known inconsistencies (present in the code, not yet reconciled)

- `middleware/cache.ts` exports a `cacheMiddleware` that nothing mounts — `routes/search.ts` calls `getCache`/`setCache` manually instead. The `NodeCache` TTL there is hardcoded to 300s and ignores `CONFIG.CACHE_TTL`.
- `routes/cities.ts` exposes Shenzhen/Beijing/Shanghai ids, but every geo and translation default in the repo is Guangzhou-specific. Those cities are untested.

## Other things worth knowing

- **Do not re-filter results client-side on amenities.** The `conditions` payload already filters server-side, and the response's tag vocabulary is *not* the same as the filter vocabulary — a unit returned by the `接待外宾` filter often has no `接待外宾` tag. The old code re-filtered on tag substrings and would have dropped nearly everything. `routes/search.ts` now only applies `maxDistanceToFairKm` locally, since Tujia has no condition for it.
- **`mapper.ts` targets `data.items` specifically.** Field names are pinned to that endpoint rather than probing 2–3 candidate keys, because the candidates in the old code were guesses that matched nothing. If you wire up a second endpoint, write a second mapper.
- **CNY→EUR is a frozen constant** (`0.13`), defined twice (`config.ts` and `scraper.ts`).
- Defaults throughout (city `45` = Guangzhou, `2026-10-10` → `2026-11-05`, price cap 300 CNY) encode the Canton Fair use case, not neutral defaults.
- Comments and some CLI output are in Italian; user-facing API output is English.
- `temp.json`, `response.json`, `cookies.txt` are captured live responses/sessions kept for reference, not code.
