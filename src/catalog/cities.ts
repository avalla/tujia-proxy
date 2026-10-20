/**
 * The cities this proxy supports, hand-maintained.
 *
 * Everything here is small, stable, and not derivable from the taxonomy dump, so it
 * is written by hand rather than generated:
 *
 *  - `id` is Tujia's cityId. It is NOT guessable — the ids in the original code were
 *    wrong (30 is Weihai, not Shenzhen). Each one below was verified by searching it
 *    and reading `cityName` back off a result. Verify a new one the same way before
 *    adding it, then run `bun run catalog -- --city <id>`.
 *  - `lng`/`lat` fill the type-1 city condition. Tujia keys the search off `value`
 *    (cityId) — a search for city 49 with Guangzhou's coordinates still returns
 *    Shenzhen — so these are context, not a filter. Each is still a real bd09 point
 *    lifted from that city's own taxonomy (the source entry is named in a comment),
 *    rather than a WGS84 city centre converted by hand.
 *  - `landmarks` are the "how far is it from X" anchors the UI offers. Coordinates
 *    come from Tujia's own taxonomy (`value` names the entry), so they are bd09 by
 *    construction and measuring them against unit coordinates needs no conversion.
 */

import type { Catalog } from './types';

export interface Landmark {
  /** Stable key used on the wire (`landmarkKey` on a search request). */
  key: string;
  name: string;
  nameCn: string;
  /** The taxonomy entry these coordinates were lifted from. */
  value: string;
  lng: number;
  lat: number;
}

/**
 * A station that exists but that Tujia's taxonomy leaves out, so no generator run can
 * produce it. It has no Tujia filter id and so cannot be searched on; it exists for
 * geometry only — nearest-station on cards and the line advice in the UI.
 */
export interface ExtraStation {
  /** The line's Chinese name exactly as the catalog has it (`MetroLine.cn`). */
  line: string;
  cn: string;
  en: string;
  lng: number;
  lat: number;
  /** Where the coordinates come from, since they cannot come from a station entry. */
  source: string;
}

export interface City {
  /** Tujia cityId. */
  id: string;
  slug: string;
  name: string;
  nameCn: string;
  /** Goes into the type-1 condition as both `pingYin` and `pinYin`. */
  pinyin: string;
  lng: number;
  lat: number;
  /** First entry is the default anchor for distance filtering. Never empty. */
  landmarks: Landmark[];
  extraStations?: ExtraStation[];
}

export const CITIES: City[] = [
  {
    id: '45',
    slug: 'guangzhou',
    name: 'Guangzhou',
    nameCn: '广州',
    pinyin: 'guangzhou',
    // Sniffed from m.tujia.com's own type-1 condition for Guangzhou.
    lng: 113.27100372314453,
    lat: 23.135400772094727,
    landmarks: [
      {
        key: 'canton-fair',
        name: 'Canton Fair complex',
        nameCn: '中国进出口商品交易会展馆',
        value: '5_23158498',
        lng: 113.36747,
        lat: 23.106647,
      },
    ],
  },
  {
    id: '49',
    slug: 'shenzhen',
    name: 'Shenzhen',
    nameCn: '深圳',
    pinyin: 'shenzhen',
    // Futian CBD, from the 商圈 entry 会展中心/CBD (8_87274) — Tujia's own bd09 point.
    lng: 114.06739,
    lat: 22.536385,
    landmarks: [
      {
        // The big Bao'an venue (Shenzhen World), where the large trade fairs run.
        key: 'shenzhen-world',
        name: 'Shenzhen World Convention Centre',
        nameCn: '深圳国际会展中心',
        value: '5_65761211',
        lng: 113.77086,
        lat: 22.705263,
      },
      {
        // The older Futian venue, still used for smaller shows.
        key: 'futian-cec',
        name: 'Futian Convention Centre',
        nameCn: '深圳会展中心',
        value: '8_87274',
        lng: 114.06739,
        lat: 22.536385,
      },
      {
        key: 'baoan-airport',
        name: "Bao'an International Airport",
        nameCn: '深圳宝安国际机场',
        value: '2_10051',
        lng: 113.81841,
        lat: 22.637526,
      },
    ],
  },
  {
    id: '23',
    slug: 'shanghai',
    name: 'Shanghai',
    nameCn: '上海',
    pinyin: 'shanghai',
    // 上海火车站 (4_76335)
    lng: 121.4617,
    lat: 31.25503,
    landmarks: [
      {
        key: 'necc',
        name: 'National Exhibition & Convention Centre',
        nameCn: '国家会展中心(上海)',
        value: '5_756379',
        lng: 121.30838,
        lat: 31.19586,
      },
      {
        key: 'sniec',
        name: 'Shanghai New International Expo Centre',
        nameCn: '上海新国际博览中心',
        value: '5_3818620',
        lng: 121.5745,
        lat: 31.216602,
      },
      {
        key: 'pudong-airport',
        name: 'Pudong International Airport',
        nameCn: '上海浦东国际机场',
        value: '2_76340',
        lng: 121.81509,
        lat: 31.157478,
      },
    ],
  },
  {
    id: '48',
    slug: 'beijing',
    name: 'Beijing',
    nameCn: '北京',
    pinyin: 'beijing',
    // 北京火车站 (4_86615)
    lng: 116.4338,
    lat: 39.90977,
    landmarks: [
      {
        key: 'beijing-station',
        name: 'Beijing Railway Station',
        nameCn: '北京火车站',
        value: '4_86615',
        lng: 116.4338,
        lat: 39.90977,
      },
      {
        // Tujia has no standalone entry for 新国展. This used to be the 商圈 covering
        // the airport and the venue together (8_81728, 116.59454, 40.08726), which sat
        // ~3 km east beside Terminal 2 and made the airport line look like the way to
        // the fair. Guozhan station (Line 15) is the venue's own stop, at its south
        // gate, so it is the closer bd09 point Tujia actually ships.
        key: 'ciec-shunyi',
        name: 'New China Intl Exhibition Centre (Shunyi)',
        nameCn: '新国展 (国展地铁站)',
        value: '1_271105',
        lng: 116.56172,
        lat: 40.075928,
      },
      {
        key: 'capital-airport',
        name: 'Capital International Airport',
        nameCn: '北京首都国际机场',
        value: '2_86614',
        lng: 116.609566,
        lat: 40.083813,
      },
      {
        key: 'daxing-airport',
        name: 'Daxing International Airport',
        nameCn: '北京大兴国际机场',
        value: '2_70179291',
        lng: 116.43569,
        lat: 39.5199,
      },
    ],
    extraStations: [
      {
        // Tujia lists only Caoqiao and Daxingxincheng on 大兴机场线 (rechecked
        // 2026-10-20), dropping the terminus the line exists for. The station is
        // under the terminal, so the airport's own taxonomy point stands in for it.
        line: '大兴机场线',
        cn: '大兴机场地铁站',
        en: 'Daxing Airport Station',
        lng: 116.43569,
        lat: 39.5199,
        source: '2_70179291 (北京大兴国际机场)',
      },
    ],
  },
  {
    id: '22',
    slug: 'chongqing',
    name: 'Chongqing',
    nameCn: '重庆',
    pinyin: 'chongqing',
    // 重庆火车站 (4_72207)
    lng: 106.5541,
    lat: 29.55601,
    landmarks: [
      {
        key: 'ciec',
        name: 'Chongqing International Expo Centre',
        nameCn: '重庆国际博览中心',
        value: '5_756298',
        lng: 106.54818,
        lat: 29.724983,
      },
      {
        key: 'jiangbei-airport',
        name: 'Jiangbei International Airport',
        nameCn: '重庆江北国际机场',
        value: '2_756289',
        lng: 106.66132,
        lat: 29.72422,
      },
      {
        key: 'chongqing-station',
        name: 'Chongqing Railway Station',
        nameCn: '重庆火车站',
        value: '4_72207',
        lng: 106.5541,
        lat: 29.55601,
      },
    ],
  },
  {
    id: '10',
    slug: 'chengdu',
    name: 'Chengdu',
    nameCn: '成都',
    pinyin: 'chengdu',
    // 环球中心/世纪城新会展 (8_65359)
    lng: 104.07714,
    lat: 30.562103,
    landmarks: [
      {
        key: 'century-city',
        name: 'Century City Convention Centre',
        nameCn: '环球中心/世纪城新会展',
        value: '8_65359',
        lng: 104.07714,
        lat: 30.562103,
      },
      {
        key: 'western-expo',
        name: 'Western China International Expo City',
        nameCn: '中国西部国际博览城',
        value: '5_755320',
        lng: 104.08788,
        lat: 30.426514,
      },
      {
        key: 'shuangliu-airport',
        name: 'Shuangliu International Airport',
        nameCn: '成都双流国际机场',
        value: '2_755299',
        lng: 103.95817,
        lat: 30.565434,
      },
      {
        key: 'tianfu-airport',
        name: 'Tianfu International Airport',
        nameCn: '成都天府国际机场',
        value: '2_70179294',
        lng: 104.453,
        lat: 30.313843,
      },
    ],
  },
  {
    id: '7',
    slug: 'hangzhou',
    name: 'Hangzhou',
    nameCn: '杭州',
    pinyin: 'hangzhou',
    // 汽车北站/国际会展中心区域 (8_62476)
    lng: 120.11909,
    lat: 30.323261,
    landmarks: [
      {
        key: 'hiec',
        name: 'Hangzhou International Expo Centre',
        nameCn: '杭州国际博览中心',
        value: '5_62547',
        lng: 120.2452,
        lat: 30.23592,
      },
      {
        key: 'xiaoshan-airport',
        name: 'Xiaoshan International Airport',
        nameCn: '杭州萧山国际机场',
        value: '2_755155',
        lng: 120.44385,
        lat: 30.241833,
      },
    ],
  },
  {
    id: '17',
    slug: 'xian',
    name: "Xi'an",
    nameCn: '西安',
    pinyin: 'xian',
    // 西安国际会展中心 (5_831880)
    lng: 109.04766,
    lat: 34.34375,
    landmarks: [
      {
        key: 'xiecc',
        name: "Xi'an International Convention & Exhibition Centre",
        nameCn: '西安国际会展中心',
        value: '5_831880',
        lng: 109.04766,
        lat: 34.34375,
      },
    ],
  },
  {
    id: '9',
    slug: 'nanjing',
    name: 'Nanjing',
    nameCn: '南京',
    pinyin: 'nanjing',
    // 南京国际博览中心 (5_4579996)
    lng: 118.721695,
    lat: 31.998175,
    landmarks: [
      {
        key: 'niec',
        name: 'Nanjing International Expo Centre',
        nameCn: '南京国际博览中心',
        value: '5_4579996',
        lng: 118.721695,
        lat: 31.998175,
      },
      {
        key: 'lukou-airport',
        name: 'Lukou International Airport',
        nameCn: '南京禄口国际机场',
        value: '2_2462',
        lng: 118.87776,
        lat: 31.737257,
      },
    ],
  },
  {
    id: '11',
    slug: 'suzhou',
    name: 'Suzhou',
    nameCn: '苏州',
    pinyin: 'suzhou',
    // 苏州国际博览中心 (5_700724)
    lng: 120.71379,
    lat: 31.330019,
    landmarks: [
      {
        key: 'siec',
        name: 'Suzhou International Expo Centre',
        nameCn: '苏州国际博览中心',
        value: '5_700724',
        lng: 120.71379,
        lat: 31.330019,
      },
      {
        key: 'huaqiao-expo',
        name: 'Huaqiao International Expo Centre',
        nameCn: '花桥国际博览中心',
        value: '5_4735210',
        lng: 121.072945,
        lat: 31.306194,
      },
    ],
  },
];

/**
 * Splice a city's `extraStations` into its generated catalog, onto the line they
 * belong to. Called from `index.ts` for every city, so the generated files stay pure
 * Tujia output and a regeneration can never drop the fix. The added stations carry
 * an empty `value`: there is no Tujia filter id to search them by.
 */
export function withExtraStations(cityId: string, catalog: Catalog): Catalog {
  const extras = BY_ID.get(cityId)?.extraStations;
  if (!extras?.length) return catalog;
  const metroLines = catalog.metroLines.map((line) => {
    const add = extras.filter((x) => x.line === line.cn && !line.stations.some((s) => s.cn === x.cn));
    if (!add.length) return line; // Tujia has caught up, or the line is not this one
    return {
      ...line,
      stations: [...line.stations, ...add.map(({ cn, en, lng, lat }) => ({ value: '', cn, en, lng, lat }))],
    };
  });
  return { ...catalog, metroLines };
}

export const DEFAULT_CITY_ID = '45';

const BY_ID = new Map(CITIES.map((c) => [c.id, c]));
const BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));
const BY_NAME = new Map(CITIES.map((c) => [c.name.toLowerCase(), c]));
const BY_NAME_CN = new Map(CITIES.map((c) => [c.nameCn, c]));

/**
 * Look a city up by id, slug, English name, or Chinese name. Undefined when
 * unsupported. The trailing 市 ("city") is stripped, because payload fields spell it
 * both ways — the detail endpoint returns 深圳市 where search items return 深圳.
 */
export function findCity(key: string | undefined | null): City | undefined {
  if (!key) return undefined;
  const k = String(key).trim();
  return (
    BY_ID.get(k) ||
    BY_SLUG.get(k.toLowerCase()) ||
    BY_NAME.get(k.toLowerCase()) ||
    BY_NAME_CN.get(k) ||
    BY_NAME_CN.get(k.replace(/市$/, ''))
  );
}

/** Look a city up, falling back to the default rather than throwing. */
export function cityOrDefault(key: string | undefined | null): City {
  return findCity(key) || BY_ID.get(DEFAULT_CITY_ID)!;
}

/**
 * Resolve a distance anchor. An unknown key falls back to the city's default rather
 * than silently disabling the filter, which would return unfiltered results.
 */
export function resolveLandmark(
  city: City,
  key?: string | null
): Landmark | null {
  if (!city.landmarks.length) return null;
  if (!key) return city.landmarks[0];
  return city.landmarks.find((l) => l.key === key) || city.landmarks[0];
}
