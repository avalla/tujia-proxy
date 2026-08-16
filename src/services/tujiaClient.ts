import axios, { AxiosInstance } from 'axios';
import { CONFIG } from '../config';
import { SearchRequest } from '../types';
import { AMENITY_GROUPS, SORT_OPTIONS, METRO_LINES } from '../catalog/filters.generated';
import { cookieHeader } from './cookieJar';

/** Flat lookup of every catalog filter by its condition value. */
const AMENITY_BY_VALUE = new Map(
  AMENITY_GROUPS.flatMap((g) => g.items).map((i) => [i.value, i])
);

/** Whole-line filters, keyed by their `7_*` condition value. */
const LINE_BY_VALUE = new Map(
  METRO_LINES.filter((l) => l.filterValue).map((l) => [l.filterValue as string, l])
);

/** Opaque page ids the H5 app sends. They are not validated, but are echoed into feLog. */
const PID_SEARCH = 'RRW27ih0WwAKjzNd2iPTXAzcMG0e';
const PID_LIST = 'AHr1pThCXTp5f4nHT0fABYp5p7NY';

/** Listings. Returns `data.items`. */
const PATH_SEARCH = '/bnbapp-node-h5/h5/search/v2/searchhouse/bnb';
/** Filter taxonomy only — no listings. Returns `data.allConditions`. */
const PATH_CONDITIONS = '/bnbapp-node-h5/h5/search/conditions/fetch';

interface Condition {
  label: string;
  type: number;
  value: string;
  gType: number;
  longitude: number;
  latitude: number;
  hotRecommend: null;
  redPoint: false;
  selectedType: 0;
  isDirectCondition: false;
  conditionType?: number;
  labelDesc?: string;
  sort?: number;
  pingYin?: string;
  pinYin?: string;
  /** Set on user-chosen filters; omitted on implicit context (city, dates). */
  selected?: true;
}

const base = (
  label: string,
  type: number,
  value: string,
  gType: number,
  extra: Partial<Condition> = {}
): Condition => ({
  label,
  type,
  value,
  gType,
  longitude: 0,
  latitude: 0,
  hotRecommend: null,
  redPoint: false,
  selectedType: 0,
  isDirectCondition: false,
  ...extra,
});

export class TujiaClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: CONFIG.TUJIA_API_URL,
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=UTF-8',
        Origin: 'https://m.tujia.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'X-App-Stats': 'curPage=unitList',
      },
    });
  }

  /**
   * Tujia encodes the active filter set into the page URL as `<type>-<value>` pairs:
   *   /hotel_city45_5-1_268263/6-237_6-2301_6-502_7-0,300/
   * The metro condition rides in the first segment alongside the city; everything
   * else is underscore-joined in the second. The API reads the Referer, so this is
   * reconstructed rather than hardcoded.
   */
  private buildReferer(params: SearchRequest, conditions: Condition[]): string {
    const metro = conditions.find((c) => c.type === 5);
    const head = `hotel_city${params.cityId}${metro ? `_5-${metro.value}` : ''}`;
    const rest = conditions
      .filter((c) => (c.type === 6 || c.type === 7) && c.selected)
      .map((c) => `${c.type}-${c.value}`)
      .join('_');
    return `https://m.tujia.com/${head}/${rest ? `${rest}/` : ''}`;
  }

  private buildConditions(params: SearchRequest): Condition[] {
    const conditions: Condition[] = [];
    const sort = Date.now();

    // 1. Location anchor (type 5). A specific station wins over a whole line — it is
    //    the more specific request, and Tujia honours only one type-5 geo condition.
    if (params.metroStationId) {
      conditions.push(
        base(params.metroStationName || '地铁站', 5, params.metroStationId, 2, {
          longitude: params.metroLng || 0,
          latitude: params.metroLat || 0,
          conditionType: 1,
          selected: true,
        })
      );
    } else if (params.metroLineId) {
      const line = LINE_BY_VALUE.get(params.metroLineId);
      if (line) {
        // 全线 / whole-line condition: conditionType -1, no coordinates.
        conditions.push(
          base(line.cn, 5, line.filterValue!, 2, { conditionType: -1, selected: true })
        );
      } else {
        console.warn(`[tujia] unknown metro line "${params.metroLineId}" — not in catalog, ignoring`);
      }
    }

    // 2. Sort order (type 4). Defaults to 欢迎度排序 (most popular).
    const sortOption =
      SORT_OPTIONS.find((s) => s.value === params.sort) ||
      SORT_OPTIONS.find((s) => s.value === '1');
    conditions.push(
      base(sortOption?.cn || '欢迎度排序', 4, sortOption?.value || '1', 4, { selected: true })
    );

    // 3. Amenities (type 6). Each value's conditionType/gType/label comes from the
    // generated catalog, so any of Tujia's ~100 filters works, not just a hardcoded few.
    const amenityValues = new Set(params.amenities || []);
    if (params.freeParking) amenityValues.add('218');
    if (params.acceptForeigners) amenityValues.add('237');
    if (params.nearMetro) amenityValues.add('2301');

    for (const value of amenityValues) {
      const known = AMENITY_BY_VALUE.get(value);
      if (!known) {
        console.warn(`[tujia] unknown filter value "${value}" — not in catalog, skipping`);
        continue;
      }
      conditions.push(
        base(known.cn, known.type, known.value, known.gType, {
          conditionType: known.conditionType ?? undefined,
          labelDesc: known.cn,
          sort,
          selected: true,
        })
      );
    }

    // 4. Guest count (type 6, conditionType 5). Values are 500 + n, for n in 1..15.
    const guests = Math.min(Math.max(params.guestCount || 1, 1), 15);
    const guestLabel = `${guests}人`;
    conditions.push(
      base(guestLabel, 6, String(500 + guests), 1, {
        conditionType: 5,
        labelDesc: guestLabel,
        sort,
        selected: true,
      })
    );

    // 5. Price range (type 7, conditionType 101).
    const priceMin = params.priceMin || 0;
    const priceMax = params.priceMax || 300;
    conditions.push(
      base(`${priceMin}-${priceMax}`, 7, `${priceMin},${priceMax}`, 1, {
        conditionType: 101,
        selected: true,
      })
    );

    // 6. City (type 1) — implicit context, not marked selected.
    conditions.push(
      base(params.district || '广州', 1, params.cityId, 0, {
        longitude: 113.27100372314453,
        latitude: 23.135400772094727,
        pingYin: 'guangzhou',
        pinYin: 'guangzhou',
      })
    );

    // 7 & 8. Dates (types 3 and 2) — implicit context.
    conditions.push(base('离店日期', 3, params.checkOut, 0));
    conditions.push(base('入住日期', 2, params.checkIn, 0));

    return conditions;
  }

  private traceId(): string {
    return `${Date.now()}hKpdWM91_${PID_SEARCH}_RN8MGXByKHhC`;
  }

  private query(pid: string, refPid: string): string {
    return `pid=${pid}&refPid=${refPid}&act=keyword_search&_apitsp=${Date.now()}&_fasTraceId=${this.traceId()}`;
  }

  private async post(
    path: string,
    pid: string,
    refPid: string,
    payload: any,
    referer: string,
    dates?: { checkIn?: string; checkOut?: string }
  ) {
    const { data } = await this.http.post(`${path}?${this.query(pid, refPid)}`, payload, {
      // Built per request so an expired session can be refreshed on disk without a restart,
      // and so the stay-context cookies match the dates being queried.
      headers: { Referer: referer, Cookie: cookieHeader(dates) },
    });
    if (data.errcode && data.errcode !== 0) {
      const err: any = new Error(`Tujia API error ${data.errcode}: ${data.errmsg}`);
      err.code = data.errcode;
      // 55004 and friends mean the COOKIES constant above has expired.
      err.status = data.errcode === 55004 ? 401 : 502;
      throw err;
    }
    return data;
  }

  /** Search listings. Units come back in `data.items`. */
  async search(params: SearchRequest): Promise<any> {
    const conditions = this.buildConditions(params);
    const payload = {
      pageIndex: params.pageIndex ?? 0,
      pageSize: params.pageSize ?? 10,
      conditions,
      returnFilterConditions: true,
      returnGeoConditions: true,
      specialKeyType: 0,
      returnNavigations: true,
      excludeUnitIdSet: [],
      isGetFilterTips: false,
      urlCode: null,
      feLog: {
        h5_base_log: JSON.stringify({
          checkInDate: params.checkIn,
          checkOutDate: params.checkOut,
          cityId: params.cityId,
          lat: 'null',
          lng: 'null',
          pname: 'unitList',
          refpname: 'unitList',
          pid: PID_SEARCH,
          refPid: PID_LIST,
          positionErrorMsg: '用户48小时内拒绝过使用定位',
        }),
      },
    };
    return this.post(
      PATH_SEARCH,
      PID_SEARCH,
      PID_LIST,
      payload,
      this.buildReferer(params, conditions),
      { checkIn: params.checkIn, checkOut: params.checkOut }
    );
  }

  /**
   * Fetch the filter taxonomy for the current filter context.
   * Returns `data.allConditions` — a group/subGroup tree of ~880 filter items.
   * This endpoint returns NO listings; use `search()` for those.
   */
  async fetchConditions(params: SearchRequest): Promise<any> {
    const conditions = this.buildConditions(params).map(({ selected, ...c }) => ({
      ...c,
      hotRecommend: false,
    }));
    const payload = {
      pageIndex: 0,
      pageSize: 10,
      conditions,
      returnFilterConditions: true,
      returnGeoConditions: true,
      specialKeyType: 0,
      returnNavigations: true,
      excludeUnitIdSet: [],
      isGetFilterTips: false,
      urlCode: null,
    };
    return this.post(
      PATH_CONDITIONS,
      PID_LIST,
      PID_LIST,
      payload,
      this.buildReferer(params, this.buildConditions(params)),
      { checkIn: params.checkIn, checkOut: params.checkOut }
    );
  }
}
