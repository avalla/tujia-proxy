# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An English-language proxy over Tujia (途家, m.tujia.com), a Chinese short-term rental site, built around trade-fair accommodation: Guangzhou for the Canton Fair, Shenzhen for the Shenzhen World shows. There is no public Tujia API — everything here is reverse-engineered from the mobile web app's XHR traffic.

Every city-specific fact lives in one of two places, and nowhere else:

- `src/catalog/cities.ts` — hand-written registry: Tujia cityId, names, pinyin, centre coordinates, the distance anchors ("landmarks") the UI offers, and `extraStations` — the rare station Tujia's taxonomy omits (Beijing's Daxing Airport terminus). Those are spliced in by `withExtraStations()` at load time, carry an empty `value` (not searchable, geometry only), and survive regeneration because the generated files never contain them.
- `src/catalog/<slug>.generated.ts` — one generated catalog per city: metro lines and stations, districts, attractions, filters, sort orders, price bands.

`src/catalog/index.ts` joins the two; `getCatalog(cityId)` and `allStations(cityId)` are the entry points. Nothing outside the catalog directory should hardcode a cityId, a district name, or a landmark coordinate.

### Cities currently registered

All ten are generated: **3,843 metro stations, 1,013 filters, no CJK left in any English field.**

| city | id | metro lines / stations | districts | landmarks |
|---|---|---|---|---|
| Guangzhou | 45 | 23 / 407 | 11 | 1 |
| Shenzhen | 49 | 17 / 433 | 10 | 3 |
| Shanghai | 23 | 21 / 530 | 16 | 3 |
| Beijing | 48 | 28 / 525 | 16 | 4 |
| Chongqing | 22 | 14 / 331 | 39 | 3 |
| Chengdu | 10 | 19 / 482 | 20 | 4 |
| Hangzhou | 7 | 15 / 319 | 13 | 2 |
| Xi'an | 17 | 13 / 278 | 13 | 1 |
| Nanjing | 9 | 14 / 270 | 11 | 2 |
| Suzhou | 11 | 10 / 268 | 10 | 2 |

Ids were each verified by searching them and reading `cityName` back. Useful ones **not** registered: Qingdao 8, Wuxi 14, Ningbo 16, Dalian 18, Jinan 19, Kunming 31, Guilin 32, Xiamen 33, Sanya 1, Yantai 44. Weihai is 30 — the id this repo once shipped as Shenzhen.

### Adding a city

1. Search the candidate id and read `cityName` off a result — **the ids are not guessable.** The original `routes/cities.ts` shipped four guesses and three were wrong: `30` is Weihai, not Shenzhen. Verified: `45` = Guangzhou, `48` = Beijing, `49` = Shenzhen.
2. Add the entry to `CITIES` in `src/catalog/cities.ts`, with at least one landmark lifted from that city's own taxonomy (so the coordinate is bd09, like everything else).
3. `bun run catalog -- --city <slug>`. The generator stubs the file, rewrites `src/catalog/index.ts`, then fills it.
4. Add any districts it reports to `DISTRICT_MAP`, and any filters it reports falling back to pinyin to `AMENITY_MAP` — both in `utils/translator.ts`.

## Commands

Runtime is **Bun** (TypeScript runs natively; `tsconfig.json` exists for editor/type-checking only — nothing compiles it in the normal flow).

```bash
bun install

bun run dev              # express server + English UI, hot reload, :3000
bun run start            # express server, no watch
bun run build            # bundle to dist/ (--target=bun)

bun run session          # mint a Tujia session into cookies.txt (anonymous; --login for a real one)
bun run catalog                       # regenerate every city's catalog from Tujia's live taxonomy
bun run catalog -- --city shenzhen    # just one (id or slug; comma-separate for several)
bun run mock             # run mapper against a fixture, prints HotelEn JSON

bun run scraper          # Playwright scrape, headless, uses saved session
bun run scraper:headed   # visible browser (needed for first-time login)
bun run scraper -- --city shenzhen --checkin 2026-10-10 --checkout 2026-11-05 --guests 1

npx playwright install chromium   # one-time, before first scrape
```

There is **no test framework**. `test-*.sh` are raw `curl` probes against the live Tujia endpoints used to re-derive the request shape when it breaks — they are not assertions and are not run by CI. `bun run mock` is the closest thing to a unit check: it runs `mapper.ts` over a real captured `data.items[0]` (`src/mocks/search-item.json`), so field-name drift surfaces there first.

`npx tsc --noEmit` typechecks (nothing in the normal flow compiles the project — Bun runs the TS directly).

## The filter catalogs (`src/catalog/*.generated.ts`)

One file per city, generated, committed, and **never hand-edited** — `bun run catalog` overwrites them, along with `src/catalog/index.ts`. Each is the single source of truth for that city's filter ids and their English names:

| | Guangzhou (45) | Shenzhen (49) |
|---|---|---|
| metro lines / stations | 23 / 407 | 17 / 433 |
| districts | 11 | 10 |
| attractions | 50 | 50 |
| filters (groups) | 95 (12) | 98 (12) |

The shapes live in `src/catalog/types.ts`, hand-written, so the generator emits data only and every catalog is checked against one contract. A city with no metro at all (Tujia serves plenty) simply ships an empty `metroLines`; `findNearestMetro()` returns null rather than throwing.

English names come from three sources, in priority order:
1. hand dictionaries in `scripts/generate-catalog.ts` (group names, sort orders, metro line names)
2. `translateAmenity()` from `utils/translator.ts` — so the mapper and the UI share one vocabulary
3. pinyin transliteration via `pinyin-pro`, for the ~400 metro stations nobody has translated

Tujia ships an `englishName` field on every filter item and leaves it `null` in every single case, and only romanizes attractions/universities/hospitals — never stations or districts. Hence step 3. Transliteration runs at **generation** time, not runtime, so the output is diffable and correctable.

If the generator reports filters falling back to pinyin, add them to `AMENITY_MAP` in `utils/translator.ts` rather than editing the generated file. Brand names under 品牌民宿 are exempt — transliteration is correct for those.

`TujiaClient.buildConditions()` resolves amenity values through the catalogs, so the search API accepts any filter id from any of them; the `acceptForeigners` / `nearMetro` / `freeParking` booleans are just aliases folded into `amenities`. That lookup is deliberately **global, not per city**: Tujia's filter and whole-line ids are globally unique, so a client that sends a Shenzhen line id still produces a well-formed condition instead of a silent drop. The city itself rides on the type-1 condition, which is always built from `params.cityId`.

## The detail page

`services/detailMapper.ts` is a **separate mapper** from `mapper.ts` — the detail shape shares almost no field names with a search item. Four traps, all found by testing rather than reading:

- **`deleted: true` on a facility means the place does NOT have it.** Listing those as amenities advertises what is missing. They are split into `amenitiesUnavailable` and struck through in the UI.
- **`isDeleted: true` on a check-in rule means NOT permitted** (no pets, no cooking). Same inversion, different key name.
- **`orderTotalStayNight` is not a number.** It is a bucket phrase (`小住几晚` = "a few nights"), hence `stayLength: string`.
- **`discount: "7.0"` is a 折 figure** — you pay 70%, so it renders as "30% off", not "7.0".

Neither name Tujia ships is English: `currentHouse.houseName` is a short Chinese title and `topModule.houseName` is the search keyword string. The page synthesises an English headline from structured facts, exactly as the result cards do, and keeps both Chinese forms visible.

**Reviews stay Chinese.** `commentDetailTranslation` / `commentDetailHasTranslation` exist on every review and Tujia never populates them, and no translation endpoint appears in the traffic. The page says so rather than pretending. The English signal comes from the structured parts — rating, six sub-scores, review tags.

Free-text policies (cancellation timeline, deposit terms) go through `translatePolicyText()`, a phrase table. **Order matters there**: longer phrases must precede the anchors they contain, or `离店` fires inside `离店后原路退还` and wrecks it. Anything still containing CJK afterwards is flagged `partial: true`, and the UI shows the Chinese original alongside.

To check coverage after changing the vocabulary, walk the payload of several listings and flag CJK in fields that should be English — that is how the remaining gaps (layout chips, rating words, `¥50/人/晚` vs `¥50/人晚`) were found.

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

**Line naming is not uniform across cities.** Guangzhou numbers lines plainly (`1号线`) and marks branches with `支线`. Shenzhen names most of its lines after the corridor they run — `1号罗宝线`, `3号龙岗线`, `2号蛇口线` — which the `号线` pattern does not match; without the second pattern in `lineName()` those romanize to unreadable blobs like `"1haoluobao Line"`. The badge stays `Line 1` either way and the qualifier only widens the picker label (`Line 1 · Luobao`), so a card badge is comparable across cities.

**UI caveat worth preserving:** with a line filter active, the card leads with the nearest station *on that line*, not the globally nearest. The globally nearest is often on Line 11 (a loop interchanging with nearly everything), so showing it made a working Line 8 filter look broken — 10 cards, only 2 badged "Line 8". The true nearest is kept as a muted second line.

That calculation is `findNearestOnLine()` in `utils/geo.ts` and lands on every result as `location.nearestOnLine`. It used to be `nearestOnFilteredLine()` in `app.js`, client-side "because it depends on the query" — but the server builds the query, so it knows the line too, and `maxDistanceToMetroLineKm` has to filter on the same number. Two implementations of one distance would eventually disagree; there is now one.

### `maxDistanceToMetroLineKm`

Tujia's whole-line filter is **generous**: measured on Shenzhen's Line 11, the listings it returns sit 3.4–3.8 km from the line. That is "near" by its reckoning and useless by a traveller's. This filter tightens it locally, the same way `maxDistanceToLandmarkKm` does, and at 1.5 km the same query returns places 0.2–1.5 km out.

It needs `metroLineId` and is ignored without one — `metroStationId` beats `metroLineId` upstream, so `ctx.line` is null in that case and the filter correctly falls away.

## Pagination

Tujia honours `pageIndex`/`pageSize` (verified: consecutive pages return disjoint id sets; `pageSize` 5/20/30 all respected), but two things make naive paging wrong:

- **The client must not compute `pageIndex + 1`.** When `maxDistanceToLandmarkKm` or `maxDistanceToMetroLineKm` is set, the server walks several upstream pages per response to fill one. `/api/v1/search` therefore returns a **`nextPageIndex` cursor** plus `hasMore`; echo the cursor back. Measured jumps: `0 → 4 → 9 → 17`.
- **The cursor counts upstream pages, which are bigger than yours.** While a local filter is active the walk asks Tujia for `pageSize` 20 regardless of what the client wanted, so `nextPageIndex` is in units of 20. It stays consistent because the same filter is still active on the follow-up request.
- **`hasMore` keys on upstream exhaustion, not on whether the response kept anything.** A local-filter scan can burn its 8-page budget in a sparse stretch and keep zero results while thousands remain. Gating on `results.length > 0` would wrongly say "that's all".

`nextPageIndex` is `null` only when an upstream page returns fewer than `pageSize` items. Page 400 returns `total: 0, hasMore: false, nextPageIndex: null`.

The UI appends via a Load-more button and **dedupes by id** — Tujia's live popularity ranking drifts between requests, so the same listing can appear on two pages. That is why the on-screen count sometimes grows by 9 rather than 10.

## The web UI (`public/`)

Plain HTML/CSS/JS — no build step, no framework, no CDN. Express serves it via `express.static`, mounted **after** `/api/*` so API routes always win. `GET /api/v1/filters` feeds the form.

Three things worth knowing before editing it:

- **Switching city reloads the whole catalog.** `loadCatalog(cityId)` refetches `/api/v1/filters?city=…` and re-renders the line select, the station list, the sort orders and every amenity group, because all four are per-city vocabularies. Those render functions therefore **clear their host element first** — they used to append, which was safe only while the catalog was loaded once at boot.
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

A third endpoint serves one listing:

| Endpoint | Returns |
|---|---|
| `POST /bnbapp-node-h5/h5/house/gethouse/v3/bnb` | **Full detail**, in `data.mainPart` / `data.currentHouse` / `data.pricePart` (~75 KB) |

Sniffed by loading `m.tujia.com/detail/<id>.htm` in Playwright with a real session and watching the XHR. Its payload is a plain `{houseParameter, productParameter, searchId, extendParameter, feLog}` — dates matter, since prices and the cancellation timeline are computed for the stay.

`GET /bnbapp-node-h5/h5/unit/detail` **does not exist** — it 404s with a Ctrip-style `ResponseStatus` envelope. It was a guess in the original code; don't reinstate it.

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

`mapper.ts` computes `location.nearestMetro` for **every** listing by scanning that city's stations from the unit's own coordinates — independent of whether the search was anchored on a station. Stations are collapsed by name, so interchanges report every line serving them (`Fangcun → Lines 1 & 11 & 22`). This is a different number from `distanceToSearchAnchorM`, which is Tujia's distance to the *searched* station: a listing anchored on Wanshengwei at 4.3 km may sit 0.6 km from Tangdong.

**The station index is per city and built lazily.** `findNearestMetro(cityId, …)` memoizes one index per city rather than one global list — measuring a Shenzhen unit against Guangzhou's catalog would confidently report a "nearest station" 100 km away instead of none, and a city nobody searches costs nothing to skip. That is why `mapToEnglish()` takes a `MapContext` rather than reading coordinates alone.

Every coordinate Tujia returns is Baidu **`bd09ll`** (stated per-unit in `geoCoordSysType`). `utils/geo.ts` deliberately never converts to WGS84 — it only ever measures Tujia points against other Tujia points, so staying in bd09 keeps the error at zero. Landmark coordinates in `cities.ts` are lifted from each city's own taxonomy (the entry id is recorded in `Landmark.value`) precisely so this stays true. The Canton Fair point is `5_23158498` (`113.36747, 23.106647`); its haversine was checked against Tujia's own `distance` field across a full page of results and agrees to within 1 m.

**Landmarks are a list, not a constant.** Guangzhou has one (the Canton Fair complex); Shenzhen has three, because its venues are far apart — Shenzhen World is in Bao'an, ~28 km from the Futian/Luohu cluster where most listings sit. A tight radius against the default anchor there legitimately returns nothing, which is why the empty state offers the nearest stations to the anchor instead of just saying "no results".

## The `conditions` protocol (core domain knowledge)

Tujia's search takes an untyped array of filter objects; `TujiaClient.buildConditions()` is the encoder and is the least obvious code in the repo. The `type` field selects the filter kind:

| type | meaning | notes |
|---|---|---|
| 1 | city | value = cityId, plus lat/lng + `pingYin`/`pinYin`, all from `catalog/cities.ts` |
| 2 / 3 | check-in / check-out | value = `YYYY-MM-DD` |
| 4 | sort order | `'1'` = 欢迎度排序 (popularity) |
| 5 | metro station | value = e.g. `1_268263`, must carry the station's lat/lng |
| 6 | amenity / guests | discriminated further by `conditionType` |
| 7 | price range | value = `"min,max"`, `conditionType: 101` |

Within `type: 6`, `conditionType` matters: `2` = amenity (`218` free parking, `219` paid parking, `237` accepts foreigners), `23` = near metro (`2301`) / pets (`2304`), `5` = guest count (`500 + n`, n in 1..15), `11` = bed count (`1100 + n`), `0` = bedroom count (plain `n`), `25` = rating floor, `26` = review-count floor.

User-chosen filters carry `"selected": true`; implicit context (city, check-in, check-out) does not. Ordering is significant: metro first, city/dates last. Preserve it when adding conditions.

**The type-1 coordinates are context, not a filter** — verified: a search for city `49` carrying Guangzhou's coordinates still returns Shenzhen listings, because `value` (the cityId) is what selects. They are set correctly anyway, from the registry.

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
- The Playwright scraper is still single-shape: it takes `--city` through the registry now, but `extractHotels()` has no city context, so its `ScrapedHotel` output carries no nearest-station or landmark distance. The HTTP path is the one that is multi-city end to end.
- **Do not regenerate a catalog on an anonymous session.** On 2026-10-20 `bun run catalog -- --city beijing` with a freshly minted anonymous session returned the metro network intact but **0 districts and 0 filters**, and the generator wrote that out, wiping the city's whole filter vocabulary. Check `git diff --stat src/catalog` after every run and revert if the filter count collapsed.

## `errcode 55999` — it is never a rate limit

`55999` reads as `抱歉，系统不太给力，请稍后再试` — "sorry, the system is under the weather, try again later". It is **not** a throttle. Waiting does nothing; a whole night of waiting did nothing. It has exactly **two** causes, and they are easy to confuse because they return the same code:

1. **A dead or fabricated session** (`_fas_session_id` no longer valid).
2. **A desktop User-Agent against a mobile session.** m.tujia.com mints mobile sessions; sending a desktop Chrome UA at one is rejected. This repo shipped a desktop UA for months, which is why the failure looked like a session problem long after the session was the least of it.

`TujiaClient` now sends a **mobile UA**, and it must stay that way. Verified by minting one fresh session per variant and making exactly one request each — anything less is contaminated, because a rejected request appears to poison the session for subsequent ones:

| variant (one fresh session each) | result |
|---|---|
| mobile UA, nothing else | `errcode 0`, 10 items |
| **desktop UA** | **55999** |
| mobile UA + `Origin` | `errcode 0` |
| mobile UA + `Sec-Fetch-*` | `errcode 0` |
| mobile UA + `act=keyword_search` | `errcode 0` |

So `Origin`, `Sec-Fetch-*` and the query-string parameters are all harmless; the UA is the whole story. The earlier suspects were ruled out first: `curl` on the page returns the SPA shell (not network), Playwright gets `errcode 0` from the same IP (not the IP or Tujia), changing IP via VPN changes nothing (not the IP again), and axios / curl / in-page fetch all succeed with browser cookies (not the client, TLS fingerprint or request shape).

### No login required, and the server keeps its own session alive

`mintSession()` in `services/sessionMinter.ts` drives m.tujia.com once with Playwright and saves the session it is handed. That is enough for everything: search, `conditions/fetch`, and listing detail. Tujia's login is SMS-only and only reaches Chinese numbers, so this is the practical path. `bun run session` is the manual entry point; `bun run session -- --login` opens a visible browser if you do have a number.

What a login buys is **member pricing** — Tujia's "登录后解锁超低价 / 最高85折" strip, up to ~15% off.

Sessions expire after a few hours, so `startServer()` calls `startSessionRefresh()`: mint at startup, then every `TUJIA_SESSION_REFRESH_MINUTES` (default 30, `0` disables). Three guards, each there for a reason:

- **A logged-in session is never overwritten.** Replacing one with an anonymous session would silently drop member pricing, and nothing can mint a logged-in one unattended.
- **A session younger than the interval is left alone.** `bun run dev` runs under `--watch`, so without this every file save would launch a browser.
- **A failed refresh is not fatal.** The current session usually still works; a browser that will not launch is no reason to take the API down.

Note the failure mode this does *not* fix: `55004` mid-search is usually "you asked too fast", not an expired session — re-minting will not help there. See the table below.

### What an anonymous session will and will not do

Three limits, all measured, all of which the page walk had to be reshaped around:

| | anonymous session |
|---|---|
| back-to-back searches | **3**, then `55004` on the fourth |
| same, ~2.5 s apart | fine |
| `pageSize` | 20 works, **30 is refused outright** |
| pagination | any `pageIndex` is fine |

So `routes/search.ts` asks for 20 per upstream page and walks at most 5 of them, 1.5 s apart — 100 units scanned in 5 requests where the old 8×10 scanned 80 in 8. A page that fails *mid-walk* no longer fails the whole search: it returns what it collected with `hasMore` still true, so the client can retry from the cursor.

`55004` here is not "your session died", it is "you asked too fast". Re-minting will not help; slowing down will.

### Anonymous sessions get masked prices, not missing ones

Logged out, Tujia returns `finalPrice: "1??"` and `productPrice: "¥2??"` instead of numbers — on **both** the search and detail endpoints. This is a trap in two directions:

- `detailMapper.toNumber()` matches `[\d.]+`, so it read `"1??"` as **¥1**. Never parse a Tujia price with it.
- Treating the string as a number produced `€null` on every card.

`parsePrice()` in `utils/currency.ts` handles it. The mask is *information*, not noise: each `?` is one hidden digit, so `"1??"` pins the price to 100–199. That becomes `fromCNY`/`toCNY` (and the EUR pair) with `masked: true`, and the UI shows a range plus a note saying why. `perNightCNY` is null in that case, so nothing downstream can mistake a range for an exact figure.

## Other things worth knowing

- **Do not re-filter results client-side on amenities.** The `conditions` payload already filters server-side, and the response's tag vocabulary is *not* the same as the filter vocabulary — a unit returned by the `接待外宾` filter often has no `接待外宾` tag. The old code re-filtered on tag substrings and would have dropped nearly everything. `routes/search.ts` now only applies `maxDistanceToLandmarkKm` locally, since Tujia has no condition for it. (`maxDistanceToFairKm` is still accepted as the pre-multi-city spelling.)
- **`mapper.ts` targets `data.items` specifically.** Field names are pinned to that endpoint rather than probing 2–3 candidate keys, because the candidates in the old code were guesses that matched nothing. If you wire up a second endpoint, write a second mapper.
- **CNY→EUR is a frozen constant** (`0.13`), defined twice (`config.ts` and `scraper.ts`).
- Defaults throughout (`DEFAULT_CITY_ID` = `45` Guangzhou, `2026-10-10` → `2026-11-05`, price cap 300 CNY) encode the Canton Fair use case, not neutral defaults. The date and price defaults are still Guangzhou-shaped even when another city is selected.
- **An unsupported cityId is rejected, not passed through.** Tujia would happily answer for a city we have no catalog for, and every result would come back with a null nearest-station and untranslated districts — which looks like a bug rather than a missing catalog. `/api/v1/search` and `/api/v1/filters` both 400 with the supported list.
- Comments and some CLI output are in Italian; user-facing API output is English.
- `temp.json`, `response.json`, `cookies.txt` are captured live responses/sessions kept for reference, not code.
