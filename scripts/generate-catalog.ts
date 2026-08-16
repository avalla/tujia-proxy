#!/usr/bin/env bun
/**
 * Generates src/catalog/filters.generated.ts from Tujia's live filter taxonomy.
 *
 *   bun run catalog
 *
 * Tujia ships an `englishName` on every filter item and always leaves it null, and
 * only romanizes attractions/universities/hospitals (never metro stations or
 * districts). So English names come from three sources, in priority order:
 *   1. GROUP_EN / LINE_EN / hand dictionaries below, for anything with a real name
 *   2. translateAmenity(), so the mapper and the UI share one vocabulary
 *   3. pinyin transliteration, for the ~400 metro stations nobody has translated
 *
 * Transliteration happens here rather than at runtime so the output is committed,
 * diffable, and hand-correctable.
 */
import { pinyin } from 'pinyin-pro';
import { writeFileSync, mkdirSync } from 'fs';
import { TujiaClient } from '../src/services/tujiaClient';
import { translateAmenity, translateDistrict } from '../src/utils/translator';

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
    [/区$/, ' District'],
  ];
  for (const [re, en] of suffixes) {
    if (re.test(cn)) return romanize(cn.replace(re, '')) + en;
  }
  return romanize(cn);
}

/** 1号线 -> Line 1; 广佛线 -> Guangfo Line; APM线 -> APM Line */
function lineName(cn: string): string {
  const numbered = cn.match(/^(\d+)号线(.*)$/);
  if (numbered) {
    const branch = numbered[2] ? ` ${romanize(numbered[2].replace(/支线$/, ''))} Branch` : '';
    return `Line ${numbered[1]}${branch}`;
  }
  if (cn === 'APM线') return 'APM Line';
  if (cn === '海珠有轨电车') return 'Haizhu Tram';
  if (cn.endsWith('线')) return `${romanize(cn.slice(0, -1))} Line`;
  return romanize(cn);
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

const untranslated: string[] = [];

/**
 * Amenity English name, falling back to pinyin and recording the miss.
 * `isBrand` suppresses the warning for 品牌民宿 — those are B&B brand names,
 * where transliteration is the correct treatment, not a gap.
 */
function amenityEn(cn: string, isBrand = false): string {
  const en = translateAmenity(cn);
  if (en === cn) {
    if (!isBrand) untranslated.push(cn);
    return romanize(cn);
  }
  return en;
}

async function main() {
  const client = new TujiaClient();
  console.log('[*] Fetching filter taxonomy from Tujia...');
  const raw = await client.fetchConditions({
    cityId: '45',
    checkIn: '2026-10-10',
    checkOut: '2026-11-05',
    guestCount: 2,
  });

  const all: RawGroup[] = raw.data?.allConditions || [];
  if (!all.length) throw new Error('No allConditions in response — did the session expire?');

  // --- Metro lines and stations -------------------------------------------
  // Each line subgroup carries a "全线" (whole-line) pseudo-entry whose value is a
  // `7_*` condition that filters the whole line server-side — that is the id behind
  // the "near line X" feature. The remaining `1_*` entries are the stations.
  //
  // Tujia lists some names twice, and those are NOT duplicates to merge: Line 3
  // genuinely branches at Tiyu Xilu, and 广佛线/2号线 have short stub segments. Each
  // segment has its own whole-line id, and sending two of them does NOT OR — Tujia
  // honours only the last. So keep them separate and disambiguate by terminus.
  const metroGroup = findGroup(collect2(all), '地铁线路');
  const segments = (metroGroup?.subGroups || []).map((line) => {
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
    return {
      cn: line.label || '',
      en: lineName(line.label || ''),
      filterValue: whole?.value ?? null,
      stations,
    };
  }).filter((l) => l.stations.length > 0);

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

  // Disambiguate repeated line names by their terminus pair, the way branches are
  // distinguished in real life. Unique names keep the plain label.
  const nameCounts = new Map<string, number>();
  for (const s of kept) nameCounts.set(s.en, (nameCounts.get(s.en) || 0) + 1);

  const metroLines = kept
    .map((s) => ({
      cn: s.cn,
      en: s.en, // short form, used for the badges on listing cards
      label:
        (nameCounts.get(s.en) || 0) > 1 && s.stations.length > 1
          ? `${s.en} · ${s.stations[0].en.replace(/ Station$/, '')} ↔ ${s.stations[s.stations.length - 1].en.replace(/ Station$/, '')}`
          : s.en,
      filterValue: s.filterValue,
      stations: s.stations,
    }))
    .sort((a, b) => {
      // numeric lines first, in order; named lines (APM, Guangfo, tram) after
      const n = (x: string) => (x.match(/^Line (\d+)/) ? parseInt(x.match(/^Line (\d+)/)![1], 10) : 999);
      return n(a.en) - n(b.en) || a.label.localeCompare(b.label);
    });

  const missingWholeLine = metroLines.filter((l) => !l.filterValue).map((l) => l.label);

  // --- Districts -----------------------------------------------------------
  const districts = collect(findGroup(collect2(all), '行政区')).map((d) => ({
    value: d.value,
    cn: d.label,
    // translateDistrict knows the 11 Guangzhou districts; pinyin covers anything new.
    en: translateDistrict(d.label) === d.label ? romanizePlace(d.label) : translateDistrict(d.label),
  }));

  // --- Attractions (Tujia romanizes these itself) --------------------------
  const attractions = collect(findGroup(collect2(all), '观光景点')).map((a) => ({
    value: a.value,
    cn: a.label,
    en: a.pingYin ? romanize(a.label) : romanizePlace(a.label),
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
// Regenerate with: bun run catalog
// Source: Tujia conditions/fetch taxonomy for city 45 (Guangzhou).
//
// Metro station and district English names are pinyin transliterations, since
// Tujia romanizes neither. Hand-correct them here only if you also teach the
// generator the correction, or the next run will overwrite it.

export interface CatalogPlace {
  value: string;
  cn: string;
  en: string;
  lng?: number;
  lat?: number;
}

export interface CatalogFilter {
  type: number;
  conditionType: number | null;
  gType: number;
  value: string;
  cn: string;
  en: string;
}

export interface MetroLine {
  cn: string;
  /** Short name for badges, e.g. "Line 3". Not unique — branches share it. */
  en: string;
  /** Unique picker label; adds the terminus pair when a name covers several segments. */
  label: string;
  /**
   * Tujia's 全线 condition value (\`7_*\`), which filters the whole line server-side.
   * Send at most ONE of these per search: Tujia honours only the last if several are sent.
   */
  filterValue: string | null;
  stations: CatalogPlace[];
}

export interface FilterGroup {
  cn: string;
  en: string;
  items: CatalogFilter[];
}

export interface PriceBand {
  value: string;
  cn: string;
  min: number;
  max: number;
}

export interface SortOption {
  value: string;
  cn: string;
  en: string;
}

export const GENERATED_AT = ${JSON.stringify(new Date().toISOString())};

export const METRO_LINES: MetroLine[] = ${JSON.stringify(metroLines, null, 2)};

export const DISTRICTS: CatalogPlace[] = ${JSON.stringify(districts, null, 2)};

export const ATTRACTIONS: CatalogPlace[] = ${JSON.stringify(attractions, null, 2)};

export const AMENITY_GROUPS: FilterGroup[] = ${JSON.stringify(amenityGroups, null, 2)};

export const SORT_OPTIONS: SortOption[] = ${JSON.stringify(sorts, null, 2)};

export const PRICE_BANDS: PriceBand[] = ${JSON.stringify(priceBands, null, 2)};

/** Flat station lookup across every line. */
export const ALL_STATIONS: (CatalogPlace & { line: string })[] = METRO_LINES.flatMap((l) =>
  l.stations.map((s) => ({ ...s, line: l.en }))
);
`;

  mkdirSync('src/catalog', { recursive: true });
  writeFileSync('src/catalog/filters.generated.ts', out);

  const stationCount = metroLines.reduce((n, l) => n + l.stations.length, 0);
  const amenityCount = amenityGroups.reduce((n, g) => n + g.items.length, 0);
  console.log(`[✓] src/catalog/filters.generated.ts`);
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
}

/** Groups nest one level deeper than the top level; flatten for lookup by label. */
function collect2(all: RawGroup[]): RawGroup[] {
  return all.flatMap((g) => [g, ...(g.subGroups || [])]);
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
