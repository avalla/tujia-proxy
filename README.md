# Tujia Proxy EN

English-language proxy and web UI for [Tujia](https://m.tujia.com) (途家) apartment rentals,
covering **10 Chinese cities**, built around trade-fair accommodation — Guangzhou for the
Canton Fair, Shenzhen for the Shenzhen World shows, and the major metro cities besides.

Tujia has no public API and no English interface. This reverse-engineers its mobile web
endpoints, translates the results, and serves a searchable English front end.

![The search UI](docs/screenshots/ui-light.png)

## Quick start

```bash
bun install
npx playwright install chromium   # one-time, for session minting
bun run session                   # writes cookies.txt
bun run dev
```

Then open **http://localhost:3000**.

Tujia's endpoints need a browser session, but **not a login** — `bun run session` drives a
real browser once and saves the anonymous session it gets. Search, filters and detail pages
all work with it. `cookies.txt` is gitignored; it is a real session, so keep it out of commits.
`GET /api` tells you whether one was loaded.

A login only unlocks Tujia's member pricing (up to ~15% off). Without it, prices come back
**masked** — Tujia sends `"1??"` rather than a number — so the UI shows the range that mask
implies (¥100–199) and says so, instead of inventing a figure. `bun run session -- --login`
opens a visible browser if you have a Chinese number to receive the SMS.

## What you get

- **10 cities, switchable in the form** — Guangzhou, Shenzhen, Shanghai, Beijing, Chongqing,
  Chengdu, Hangzhou, Xi'an, Nanjing, Suzhou. Metro network, districts, attractions and the
  whole filter vocabulary swap with the city
- **3,843 metro stations across 174 lines**, searchable in English (Pazhou, Futian, Chaoyang,
  Jing'an…) — with no Chinese left in any English-facing field
- **~100 filters per city** translated — accepts foreign guests, near metro, free parking,
  kitchen, instant confirmation, rating floors, and the rest of Tujia's taxonomy
- **Translated detail pages** — photos, amenities grouped by room (and an honest list of
  what the place *lacks*), house rules, the cancellation timeline with dates converted,
  deposit terms, host stats and review sub-scores
- **Filter by a whole metro line** ("everything along Line 8"), not just a single station —
  using Tujia's own line filter, so it paginates properly. Branches are listed separately
  (`Line 3 · Tiyuxilu ↔ Jichangbei`) because they really are different corridors
- **Nearest metro station and line** on every listing, with walking distance and time —
  computed from the unit's own coordinates against that city's whole network, so it's the
  station you'd actually walk to, not the one you searched for
- **Real distance to a landmark** for every listing, computed from the unit's own coordinates
  rather than guessed from its address. Each city offers its own anchors — the Canton Fair
  complex, Shenzhen World, Shanghai's NECC, Chengdu's Western Expo City, and the main airports
- Prices in EUR alongside the original CNY, with pre-discount rates where Tujia reports them

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/` | the English web UI |
| `GET`  | `/api` | service info |
| `GET`  | `/api/v1/cities` | supported cities, with their landmarks |
| `GET`  | `/api/v1/filters` | the English filter catalog that drives the UI (`?city=49`) |
| `POST` | `/api/v1/search` | search listings |
| `GET`  | `/api/v1/hotel/:id` | full listing detail, translated (`?checkIn=&checkOut=&guests=`) |
| `GET`  | `/listing.html?id=` | the translated detail page |

### Search example

```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H 'content-type: application/json' \
  -d '{
    "cityId": "49",
    "checkIn": "2026-10-10",
    "checkOut": "2026-11-05",
    "guestCount": 2,
    "priceMax": 600,
    "sort": "2",
    "amenities": ["237", "2301"],
    "landmarkKey": "futian-cec",
    "maxDistanceToLandmarkKm": 6
  }'
```

`cityId` defaults to `45` (Guangzhou). `GET /api/v1/cities` lists all ten with their ids and
landmarks. An unsupported id is rejected with the list of supported ones rather than silently
searched.

`amenities` takes filter ids from `/api/v1/filters` (`237` = accepts foreign guests,
`2301` = near metro) — **fetch them for the city you are searching**, the vocabularies differ.
`sort` takes a sort id (`1` most popular, `2` price ascending). `landmarkKey` picks which
anchor `maxDistanceToLandmarkKm` and each listing's `distanceToLandmarkKm` measure from; omit
it for the city's default.

To search a whole metro line, send `metroLineId` with a `filterValue` from
`/api/v1/filters` → `metroLines[]` (e.g. `"7_268250"` for Line 8). Send at most one, and
note that `metroStationId` takes precedence — Tujia honours a single geo condition.

### Pagination

Send `pageIndex` and `pageSize`; the response carries a cursor:

```jsonc
{
  "total": 10,
  "totalAvailable": 2314,
  "nextPageIndex": 4,   // echo this back for the next page — NOT pageIndex + 1
  "hasMore": true
}
```

Echo `nextPageIndex` rather than incrementing yourself: with `maxDistanceToLandmarkKm` the
server walks several upstream pages per response, so the cursor can jump (`0 → 4 → 9`).
`hasMore` is false only once Tujia runs out of listings. Tujia's ranking drifts between
requests, so dedupe by `id` when appending — the web UI does.

## Keeping it working

Sessions expire. When search starts returning `401 Tujia session expired`, refresh
`cookies.txt` from DevTools — the file is re-read automatically, **no restart needed**.

Accepted formats: one `name=value` per line (`#` for comments), or a single pasted
`Cookie: a=1; b=2` header line. Use `TUJIA_COOKIES_FILE` to point elsewhere.

Reference requests for both live endpoints are kept in `requests.http`.

> ⚠️ `requests.http` and the `test-*.sh` scripts still contain a captured session inline.
> They aren't used by the app, but scrub them before sharing the repo.

`Tujia API error 55999` ("system busy, try again later") is **never** a rate limit, despite
how it reads. It means either a dead session or a desktop User-Agent hitting the mobile site.
Run `bun run session` and try again; see CLAUDE.md for how that was pinned down.

To refresh the filter catalogs after Tujia changes its taxonomy:

```bash
bun run catalog                      # every city
bun run catalog -- --city shenzhen   # just one
```

### Adding a city

1. Find its Tujia cityId by searching a candidate and reading `cityName` back off a result.
   **They are not guessable** — this repo shipped `30` as Shenzhen for a while; `30` is Weihai.
2. Add it to `CITIES` in `src/catalog/cities.ts`, with at least one landmark whose coordinates
   come from that city's own taxonomy. Ids already scouted but not registered: Qingdao `8`,
   Wuxi `14`, Ningbo `16`, Dalian `18`, Jinan `19`, Kunming `31`, Guilin `32`, Xiamen `33`.
3. `bun run catalog -- --city <slug>`, then add anything it reports as untranslated to
   `DISTRICT_MAP` / `AMENITY_MAP` in `src/utils/translator.ts`.

## Other commands

```bash
bun run mock             # run the mapper over a captured listing — catches field drift
bun run scraper          # Playwright fallback that scrapes via a real browser
bun run scraper:headed   # visible browser, needed for the one-time login
npx tsc --noEmit         # typecheck
```

See `SCRAPER.md` for the browser-based scraper, and `CLAUDE.md` for the architecture
and the reverse-engineering notes.

## Caveats

- **Tujia exposes no English title anywhere**, on either endpoint. The UI synthesises a
  headline from the structured facts (`"Entire apartment · 67 m² in Liwan"`) and shows the
  Chinese original underneath.
- **Review text stays Chinese.** Tujia ships `commentDetailTranslation` fields but never
  fills them, and there is no translation endpoint. Ratings, sub-scores and review tags
  are translated; the comment bodies are shown as written, and labelled as such.
- CNY→EUR uses a **fixed rate** (`CONFIG.CNY_TO_EUR`), so prices are indicative.
- Booking still happens on Tujia, in Chinese. The **Book ↗** link opens the listing there.
- **Filter ids are per city.** They overlap heavily but are not identical — Shenzhen carries a
  sea-view filter Guangzhou does not, Beijing a 四合院 courtyard-house type. Always read them
  from `/api/v1/filters?city=…` for the city you are about to search.
- The date and price defaults (`2026-10-10` → `2026-11-05`, ¥300 cap) still encode the Canton
  Fair stay, and do not change when you switch city.
- The Playwright scraper accepts `--city` but its output has no nearest-station or landmark
  distance — the HTTP proxy is the multi-city path.
