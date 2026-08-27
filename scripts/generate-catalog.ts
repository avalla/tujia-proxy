#!/usr/bin/env bun
/**
 * Generates one `src/catalog/<slug>.generated.ts` per supported city from Tujia's
 * live filter taxonomy.
 *
 *   bun run catalog                      # every city in src/catalog/cities.ts
 *   bun run catalog -- --city shenzhen   # just one (id or slug)
 *
 * Tujia ships an `englishName` on every filter item and always leaves it null, and
 * only romanizes attractions/universities/hospitals (never metro stations or
 * districts). So English names come from three sources, in priority order:
 *   1. GROUP_EN / lineName() / hand dictionaries below, for anything with a real name
 *   2. translateAmenity(), so the mapper and the UI share one vocabulary
 *   3. pinyin transliteration, for the ~800 metro stations nobody has translated
 *
 * Transliteration happens here rather than at runtime so the output is committed,
 * diffable, and hand-correctable.
 */
import { pinyin } from 'pinyin-pro';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { translateAmenity, translateDistrict } from '../src/utils/translator';
import { CITIES, findCity, type City } from '../src/catalog/cities';

// TujiaClient is imported dynamically in main(), after the catalog index and any
// missing stub files have been written. It reaches the catalog through
// src/catalog/index.ts, so importing it statically here would fail on a fresh city
// whose generated file does not exist yet — the chicken-and-egg this defers past.
type TujiaClient = import('../src/services/tujiaClient').TujiaClient;

const GROUP_EN: Record<string, string> = {
  筛选: 'Filters',
  位置: 'Location',
  排序: 'Sort',
  人床居卫价格筛选: 'Guests, beds & price',
  热门筛选: 'Popular',
  特色推荐: 'Featured',
  景观: 'Views',
  风格: 'Style',
  服务: 'Services',
  点评: 'Reviews',
  点评分: 'Rating',
  点评数: 'Review count',
  住客印象: 'Guest impressions',
  设施: 'Facilities',
  基础设施: 'Essentials',
  特色设施: 'Special facilities',
  房型: 'Property type',
  基础房型: 'Standard types',
  特色房型: 'Special types',
  出租类型: 'Rental type',
  特殊要求: 'Special requirements',
  房屋周边: 'Neighbourhood',
  优惠: 'Deals',
  品牌民宿: 'Branded stays',
  房屋等级: 'Property grade',
  总人数: 'Guests',
  总床铺数: 'Beds',
  总居室数: 'Bedrooms',
  床铺数: 'Beds',
  居室数: 'Bedrooms',
  价格区间: 'Price range',
  价格范围: 'Price range',
  地铁线路: 'Metro lines',
  行政区: 'Districts',
  商圈: 'Business areas',
  观光景点: 'Attractions',
  '机场/车站': 'Airports & stations',
  飞机场: 'Airports',
  火车站: 'Railway stations',
  汽车站: 'Bus stations',
  高校: 'Universities',
  医院: 'Hospitals',
  热门推荐: 'Popular',
};

const SORT_EN: Record<string, string> = {
  欢迎度排序: 'Most popular',
  低价优先: 'Price: low to high',
  高价优先: 'Price: high to low',
  '距离近→远': 'Distance: nearest first',
  好评优先: 'Best rated',
  '点评数多→少': 'Most reviewed',
};

/** Title-case a Chinese string via pinyin: 万胜围 -> Wanshengwei */
function romanize(cn: string): string {
  // Parenthetical qualifiers are always noise once transliterated — 西岭雪山（滑雪场景区）
  // becomes "Xilingxueshan（huaxuechangjingqu）", brackets and all. Strip here rather
  // than only in romanizePlace: attractions that ship a pingYin flag skip that path.
  cn = cn.replace(/[（(][^）)]*[）)]/g, '').trim();
  const syllables = pinyin(cn, { toneType: 'none', type: 'array' }) as string[];
  const joined = syllables.join('').replace(/\s+/g, '');
  if (!joined) return cn;
  return joined.charAt(0).toUpperCase() + joined.slice(1).toLowerCase();
}

/** Romanize a place name, translating the common structural suffixes. */
function romanizePlace(cn: string): string {
  // Drop parenthetical qualifiers — 机场北(2号航站楼) romanizes to an unreadable blob.
  cn = cn.replace(/[（(][^）)]*[）)]/g, '').trim();
  const suffixes: [RegExp, string][] = [
    [/地铁站$/, ' Station'],
    [/火车站$/, ' Railway Station'],
    [/汽车客运站$/, ' Bus Station'],
    [/汽车站$/, ' Bus Station'],
    [/机场$/, ' Airport'],
    [/大学$/, ' University'],
    [/学院$/, ' College'],
    [/医院$/, ' Hospital'],
    [/公园$/, ' Park'],
    [/广场$/, ' Plaza'],
    [/口岸$/, ' Port'],
    [/区$/, ' District'],
  ];
  for (const [re, en] of suffixes) {
    if (re.test(cn)) return romanize(cn.replace(re, '')) + en;
  }
  return romanize(cn);
}

/**
 * Lines whose names carry real words rather than a place — pinyin turns those into
 * blobs ("Shoudujichang Line" for the Capital Airport line), and there are few
 * enough to name by hand. Trams live here too: their names embed 有轨电车
 * mid-string, which no suffix rule reaches cleanly.
 */
const LINE_NAMES: Record<string, string> = {
  'APM线': 'APM Line',
  '海珠有轨电车': 'Haizhu Tram',
  '磁悬浮': 'Maglev',
  '环线': 'Loop Line',
  '大兴机场线': 'Daxing Airport Line',
  '首都机场线': 'Capital Airport Line',
  '市域机场线': 'Airport Link Line',
  '重庆云巴线': 'Yunba Line',
  '西郊线（有轨电车）': 'Xijiao Tram',
  '亦庄T1线（有轨电车）': 'Yizhuang T1 Tram',
  '成都有轨电车蓉2号线': 'Rong 2 Tram',
  '成都有轨电车蓉2号线支线': 'Rong 2 Tram Branch',
};

/**
 * Words that appear inside a line name and describe what the line *is*, rather than
 * where it goes. Romanizing these produces blobs — 杭海城际铁路 becomes
 * "Hanghaichengjitielu" — so they are peeled off and translated, and whatever place
 * name is left over is transliterated as usual.
 */
const LINE_WORDS: [RegExp, string][] = [
  [/城际铁路$/, 'Intercity Railway'],
  [/城际$/, 'Intercity'],
  [/机场$/, 'Airport'],
  [/云巴$/, 'Yunba'], // BYD's monorail product, used in Chongqing and Xi'an
  [/磁浮$/, 'Maglev'],
  [/快线$/, 'Express'],
];

/** Romanize a line's place stem, translating any descriptive tail first. */
function romanizeStem(stem: string): string {
  if (!stem) return '';
  for (const [re, en] of LINE_WORDS) {
    if (re.test(stem)) {
      const place = stem.replace(re, '');
      return [place ? romanize(place) : '', en].filter(Boolean).join(' ');
    }
  }
  return romanize(stem);
}

/**
 * Split a Tujia line name into the short badge name and its qualifier.
 *
 * Naming is not consistent across cities, and every variant below was found by
 * generating a city and reading the output:
 *   1号线              Guangzhou, Shanghai, Chengdu — the plain case
 *   6号线支线           a branch
 *   14号线知识城支线      a named branch
 *   1号罗宝线           Shenzhen names lines after the corridor they run
 *   4号线大兴线          Beijing appends the corridor after 号线
 *   1号线-八通线         …sometimes with a dash
 *   3号线-空港线         Chongqing likewise
 *   S3资阳线            a letter-prefixed suburban line
 *
 * The badge stays "Line 4" in every numbered case, so a card badge is comparable
 * across cities; the qualifier only widens the picker label ("Line 4 · Daxing").
 */
function lineName(cn: string): { en: string; qualifier: string } {
  if (LINE_NAMES[cn]) return { en: LINE_NAMES[cn], qualifier: '' };

  // Parentheticals romanize into noise — 西郊线（有轨电车）→ "…（youguidianche）".
  const s = cn.replace(/[（(][^）)]*[）)]/g, '').trim();

  /** Trim a corridor name to its stem: "-八通线" → "Batong", "支线" → "Branch". */
  const corridor = (raw: string): string => {
    const stem = raw
      .replace(/^[-—·\s]+/, '') // 1号线-八通线
      .replace(/^号线?/, '') // S3号线 — the 号线 is the word "line", not a place
      .replace(/支线$/, '')
      .replace(/线$/, ''); // 4号线大兴线
    return [romanizeStem(stem), /支线$/.test(raw) ? 'Branch' : ''].filter(Boolean).join(' ');
  };

  // 号 may or may not be followed by 线 before the corridor name.
  const numbered = s.match(/^(\d+)号线?(.*)$/);
  if (numbered) return { en: `Line ${numbered[1]}`, qualifier: corridor(numbered[2]) };

  // S1线 / S3资阳线 — a letter-and-digit prefix, optionally with a corridor.
  const lettered = s.match(/^([A-Z]+\d*)(.*)$/);
  if (lettered) {
    const rest = corridor(lettered[2]);
    return { en: `${lettered[1]}${rest ? ` ${rest}` : ''} Line`, qualifier: '' };
  }

  if (s.endsWith('线')) return { en: `${romanizeStem(s.slice(0, -1))} Line`, qualifier: '' };
  return { en: romanizeStem(s), qualifier: '' };
}

interface RawItem {
  label: string;
  type: number;
  value: string;
  gType: number;
  conditionType?: number | null;
  labelDesc?: string;
  longitude?: number;
  latitude?: number;
  pingYin?: string | null;
}

interface RawGroup {
  label?: string | null;
  itemTypeLabel?: string | null;
  items?: RawItem[];
  subGroups?: RawGroup[];
  otherFilterItems?: RawItem[];
}

const findGroup = (groups: RawGroup[], label: string): RawGroup | undefined =>
  groups.find((g) => g.label === label);

/** Collect every leaf item under a group, depth-first. */
function collect(group: RawGroup | undefined): RawItem[] {
  if (!group) return [];
  return [
    ...(group.items || []),
    ...(group.otherFilterItems || []),
    ...(group.subGroups || []).flatMap(collect),
  ];
}

/** Groups nest one level deeper than the top level; flatten for lookup by label. */
function collect2(all: RawGroup[]): RawGroup[] {
  return all.flatMap((g) => [g, ...(g.subGroups || [])]);
}

const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch one city's taxonomy, retrying through Tujia's burst throttle.
 *
 * `errcode 55999` (抱歉，系统不太给力 — "system busy") is a *global* limit on the
 * session, not a per-endpoint one, and generating several cities back to back trips
 * it reliably. It clears in a few minutes, so back off rather than failing the run
 * and losing the cities already generated.
 */
async function fetchWithBackoff(client: TujiaClient, city: City): Promise<any> {
  const waits = [0, 30_000, 60_000, 120_000, 180_000];
  for (let attempt = 0; attempt < waits.length; attempt++) {
    if (waits[attempt]) {
      console.log(`    throttled — waiting ${waits[attempt] / 1000}s before retry ${attempt}`);
      await nap(waits[attempt]);
    }
    try {
      return await client.fetchConditions({
        cityId: city.id,
        checkIn: '2026-10-10',
        checkOut: '2026-11-05',
        guestCount: 2,
      });
    } catch (err: any) {
      if (!String(err.message).includes('55999')) throw err;
    }
  }
  throw new Error(
    `${city.name}: Tujia stayed throttled (55999) through every retry. Wait a few minutes and rerun.`
  );
}

/** Build one city's catalog file. Returns a one-line summary for the final report. */
async function generateCity(client: TujiaClient, city: City): Promise<string> {
  const untranslated: string[] = [];

  /**
   * Amenity English name, falling back to pinyin and recording the miss.
   * `isBrand` suppresses the warning for 品牌民宿 — those are B&B brand names,
   * where transliteration is the correct treatment, not a gap.
   */
  const amenityEn = (cn: string, isBrand = false): string => {
    const en = translateAmenity(cn);
    if (en === cn) {
      if (!isBrand) untranslated.push(cn);
      return romanize(cn);
    }
    return en;
  };

  console.log(`\n[*] ${city.name} (city ${city.id}) — fetching filter taxonomy...`);
  const raw = await fetchWithBackoff(client, city);

  const all: RawGroup[] = raw.data?.allConditions || [];
  if (!all.length) throw new Error('No allConditions in response — did the session expire?');

  // --- Metro lines and stations -------------------------------------------
  // Each line subgroup carries a "全线" (whole-line) pseudo-entry whose value is a
  // `7_*` condition that filters the whole line server-side — that is the id behind
  // the "near line X" feature. The remaining `1_*` entries are the stations.
  //
  // Tujia lists some names twice, and those are NOT duplicates to merge: Guangzhou's
  // Line 3 genuinely branches at Tiyu Xilu, and 广佛线/2号线 have short stub segments.
  // Each segment has its own whole-line id, and sending two of them does NOT OR —
  // Tujia honours only the last. So keep them separate and disambiguate.
  //
  // A city with no metro (Tujia serves plenty) simply has no 地铁线路 group; the
  // catalog then ships an empty METRO_LINES and everything downstream degrades to
  // "no nearest station" rather than breaking.
  const metroGroup = findGroup(collect2(all), '地铁线路');
  const segments = (metroGroup?.subGroups || [])
    .map((line) => {
      const whole = (line.items || []).find((s) => s.label === '全线');
      const stations = (line.items || [])
        .filter((s) => s.label !== '全线' && !(s.longitude === 0 && s.latitude === 0))
        .map((s) => ({
          value: s.value,
          cn: s.label,
          en: romanizePlace(s.label),
          lng: s.longitude ?? 0,
          lat: s.latitude ?? 0,
        }));
      const { en, qualifier } = lineName(line.label || '');
      return {
        cn: line.label || '',
        en,
        base: qualifier ? `${en} · ${qualifier}` : en,
        filterValue: whole?.value ?? null,
        stations,
      };
    })
    .filter((l) => l.stations.length > 0);

  // Drop stub segments whose stations are all already covered by a longer segment of
  // the same line (Tujia lists a 1-station "2号线" holding only 广州南站, which the main
  // Line 2 already contains). Genuine branches share no such containment and survive.
  const kept = segments.filter((s) => {
    const values = new Set(s.stations.map((st) => st.value));
    return !segments.some(
      (other) =>
        other !== s &&
        other.en === s.en &&
        other.stations.length > s.stations.length &&
        [...values].every((v) => other.stations.some((st) => st.value === v))
    );
  });
  const dropped = segments.filter((s) => !kept.includes(s));

  // Disambiguate labels that are still repeated by their terminus pair, the way
  // branches are distinguished in real life. Unique labels are left alone.
  const labelCounts = new Map<string, number>();
  for (const s of kept) labelCounts.set(s.base, (labelCounts.get(s.base) || 0) + 1);

  const metroLines = kept
    .map((s) => ({
      cn: s.cn,
      en: s.en, // short form, used for the badges on listing cards
      label:
        (labelCounts.get(s.base) || 0) > 1 && s.stations.length > 1
          ? `${s.base} · ${s.stations[0].en.replace(/ Station$/, '')} ↔ ${s.stations[s.stations.length - 1].en.replace(/ Station$/, '')}`
          : s.base,
      filterValue: s.filterValue,
      stations: s.stations,
    }))
    .sort((a, b) => {
      // numeric lines first, in order; named lines (APM, Guangfo, tram) after
      const n = (x: string) =>
        x.match(/^Line (\d+)/) ? parseInt(x.match(/^Line (\d+)/)![1], 10) : 999;
      return n(a.en) - n(b.en) || a.label.localeCompare(b.label);
    });

  const missingWholeLine = metroLines.filter((l) => !l.filterValue).map((l) => l.label);

  // --- Districts -----------------------------------------------------------
  const districts = collect(findGroup(collect2(all), '行政区')).map((d) => ({
    value: d.value,
    cn: d.label,
    // translateDistrict knows the named districts; pinyin covers anything new.
    en: translateDistrict(d.label) === d.label ? romanizePlace(d.label) : translateDistrict(d.label),
  }));

  // --- Attractions (Tujia romanizes these itself) --------------------------
  // A handful have real English names that pinyin would bury — the Canton Fair is
  // the whole point of this proxy, and "Zhongguojinchukoushangpinjiaoyihuizhanguan"
  // is not how anyone refers to it.
  const ATTRACTION_EN: Record<string, string> = {
    '中国进出口商品交易会（广交会）展馆': 'Canton Fair Complex',
    '深圳国际会展中心': 'Shenzhen World Convention Centre',
    '国家会展中心(上海)': 'National Exhibition & Convention Centre',
    '上海新国际博览中心': 'Shanghai New International Expo Centre',
    '重庆国际博览中心': 'Chongqing International Expo Centre',
    '中国西部国际博览城': 'Western China International Expo City',
    '杭州国际博览中心': 'Hangzhou International Expo Centre',
    '西安国际会展中心': "Xi'an International Convention & Exhibition Centre",
    '南京国际博览中心': 'Nanjing International Expo Centre',
    '苏州国际博览中心': 'Suzhou International Expo Centre',
  };

  const attractions = collect(findGroup(collect2(all), '观光景点')).map((a) => ({
    value: a.value,
    cn: a.label,
    en: ATTRACTION_EN[a.label] || (a.pingYin ? romanize(a.label) : romanizePlace(a.label)),
    lng: a.longitude ?? 0,
    lat: a.latitude ?? 0,
  }));

  // --- Amenity-style filters, kept in their Tujia groups --------------------
  const filterRoot = findGroup(all, '筛选');
  const amenityGroups = (filterRoot?.subGroups || [])
    .filter((g) => !['总人数', '床铺数', '居室数', '价格区间'].includes(g.label || ''))
    .map((g) => ({
      cn: g.label || '',
      en: GROUP_EN[g.label || ''] || romanize(g.label || ''),
      // Some filters appear under two subgroups (基础设施 and 特色设施); dedupe by value.
      items: [
        ...new Map(
          collect(g)
            .filter((i) => i.type === 6)
            .map((i) => [
              i.value,
              {
                type: i.type,
                conditionType: i.conditionType ?? null,
                gType: i.gType,
                value: i.value,
                cn: i.label,
                en: amenityEn(i.label, g.label === '品牌民宿'),
              },
            ])
        ).values(),
      ],
    }))
    .filter((g) => g.items.length > 0);

  // --- Sort orders ----------------------------------------------------------
  const sorts = collect(findGroup(all, '排序')).map((s) => ({
    value: s.value,
    cn: s.label,
    en: SORT_EN[s.label] || romanize(s.label),
  }));

  // --- Price bands ----------------------------------------------------------
  const priceBands = collect(findGroup(collect2(all), '价格区间')).map((p) => {
    const [min, max] = p.value.split(',').map(Number);
    return { value: p.value, cn: p.label, min, max };
  });

  const out = `// GENERATED by scripts/generate-catalog.ts — do not edit by hand.
// Regenerate with: bun run catalog -- --city ${city.slug}
// Source: Tujia conditions/fetch taxonomy for city ${city.id} (${city.name} / ${city.nameCn}).
//
// Metro station and district English names are pinyin transliterations, since
// Tujia romanizes neither. Hand-correct them here only if you also teach the
// generator the correction, or the next run will overwrite it.

import type { Catalog } from './types';

export const CATALOG: Catalog = ${JSON.stringify(
    {
      cityId: city.id,
      generatedAt: new Date().toISOString(),
      metroLines,
      districts,
      attractions,
      amenityGroups,
      sortOptions: sorts,
      priceBands,
    },
    null,
    2
  )};

export default CATALOG;
`;

  mkdirSync('src/catalog', { recursive: true });
  const path = `src/catalog/${city.slug}.generated.ts`;
  writeFileSync(path, out);

  const stationCount = metroLines.reduce((n, l) => n + l.stations.length, 0);
  const amenityCount = amenityGroups.reduce((n, g) => n + g.items.length, 0);
  console.log(`[✓] ${path}`);
  console.log(`    ${metroLines.length} metro lines / ${stationCount} stations`);
  console.log(`    ${districts.length} districts, ${attractions.length} attractions`);
  console.log(`    ${amenityGroups.length} filter groups / ${amenityCount} filters`);
  console.log(`    ${sorts.length} sort orders, ${priceBands.length} price bands`);

  if (dropped.length) {
    console.log(
      `\n[i] dropped ${dropped.length} redundant line segment(s) fully covered by a longer one: ` +
        dropped.map((d) => `${d.en}(${d.stations.length} st)`).join(', ')
    );
  }
  if (missingWholeLine.length) {
    console.log(`\n[!] no whole-line filter id for: ${missingWholeLine.join(', ')}`);
  }

  const missing = [...new Set(untranslated)];
  if (missing.length) {
    console.log(
      `\n[!] ${missing.length} filters fell back to pinyin — add them to AMENITY_MAP in src/utils/translator.ts:`
    );
    console.log('    ' + missing.join('  '));
  }

  return `${city.name}: ${metroLines.length} lines / ${stationCount} stations, ${districts.length} districts, ${amenityCount} filters`;
}

/** Rewrite the registry module so a newly generated city is wired up automatically. */
function writeIndex(cities: City[]): void {
  const imports = cities
    .map((c) => `import ${c.slug.toUpperCase()} from './${c.slug}.generated';`)
    .join('\n');
  const entries = cities.map((c) => `  ${JSON.stringify(c.id)}: ${c.slug.toUpperCase()},`).join('\n');

  writeFileSync(
    'src/catalog/index.ts',
    `// GENERATED by scripts/generate-catalog.ts — do not edit by hand.
// Regenerate with: bun run catalog
//
// The registry of per-city catalogs. Keyed by Tujia cityId, so a search request's
// cityId picks its own metro network, districts and filter vocabulary.

import type { Catalog, CatalogPlace } from './types';
${imports}

export * from './types';
export * from './cities';

export const CATALOGS: Record<string, Catalog> = {
${entries}
};

/** Every catalog we shipped, in registry order. */
export const ALL_CATALOGS: Catalog[] = Object.values(CATALOGS);

/** Undefined for a city we have no generated catalog for. */
export function getCatalog(cityId: string): Catalog | undefined {
  return CATALOGS[cityId];
}

/**
 * Whether this city is actually searchable.
 *
 * A registered city always HAS a catalog module — the generator stubs an empty one so
 * the imports above resolve before its first run. An empty stub has no \`generatedAt\`,
 * and serving it would render a form with no metro, no districts and no filters, which
 * reads as a broken city rather than an ungenerated one. Check this, not existence.
 */
export function hasCatalog(cityId: string): boolean {
  return Boolean(CATALOGS[cityId]?.generatedAt);
}

/**
 * Flat station lookup for one city. Empty for a city with no metro, or one we have
 * not generated yet — callers degrade to "no nearest station" rather than throwing.
 */
export function allStations(cityId: string): (CatalogPlace & { line: string })[] {
  const catalog = CATALOGS[cityId];
  if (!catalog) return [];
  return catalog.metroLines.flatMap((l) => l.stations.map((s) => ({ ...s, line: l.en })));
}
`
  );
  console.log(`\n[✓] src/catalog/index.ts — ${cities.length} cities registered`);
}

/**
 * Write an empty catalog for any registered city that has never been generated, so
 * the index below can import it. Without this, adding a city to cities.ts and running
 * the generator fails at import time on the file the run is about to create.
 */
function ensureStubs(cities: City[]): void {
  mkdirSync('src/catalog', { recursive: true });
  for (const city of cities) {
    const path = `src/catalog/${city.slug}.generated.ts`;
    if (existsSync(path)) continue;
    writeFileSync(
      path,
      `// PLACEHOLDER written by scripts/generate-catalog.ts — run \`bun run catalog -- --city ${city.slug}\`.
import type { Catalog } from './types';

export const CATALOG: Catalog = {
  cityId: ${JSON.stringify(city.id)},
  generatedAt: "",
  metroLines: [],
  districts: [],
  attractions: [],
  amenityGroups: [],
  sortOptions: [],
  priceBands: [],
};

export default CATALOG;
`
    );
    console.log(`[i] stubbed ${path} (empty until generated)`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((a) => a === '--city' || a === '-c');
  const requested =
    idx >= 0 && argv[idx + 1]
      ? argv[idx + 1]
          .split(',')
          .map((k) => {
            const city = findCity(k.trim());
            if (!city) {
              throw new Error(
                `Unknown city "${k.trim()}". Add it to src/catalog/cities.ts first ` +
                  `(known: ${CITIES.map((c) => `${c.slug}=${c.id}`).join(', ')}).`
              );
            }
            return city;
          })
      : CITIES;

  // The index lists every registered city, not just the ones regenerated now, so a
  // single-city run does not drop the others from the registry.
  ensureStubs(CITIES);
  writeIndex(CITIES);

  const { TujiaClient } = await import('../src/services/tujiaClient');
  const client = new TujiaClient();
  const summaries: string[] = [];
  for (const [i, city] of requested.entries()) {
    if (i) await nap(8000); // space the calls out; a burst trips the 55999 throttle
    summaries.push(await generateCity(client, city));
  }

  console.log('\n' + summaries.map((s) => `  ${s}`).join('\n'));
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
