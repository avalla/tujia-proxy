import { HotelEn } from '../types';
import {
  translateDistrict,
  translateAmenity,
  parseOccupancy,
  parseLayout,
  Occupancy,
  Layout,
} from '../utils/translator';
import { distanceToLandmarkKm, findNearestMetro } from '../utils/geo';
import { cnyToEur, cnyToEurOrNull, parsePrice } from '../utils/currency';
import { cityOrDefault, resolveLandmark, DEFAULT_CITY_ID, type Landmark } from '../catalog';

/**
 * Which city the results belong to, and which anchor distances are measured from.
 * Passed in rather than sniffed off each item: the search request already knows,
 * and the per-item `cityName` is Chinese and occasionally absent.
 */
export interface MapContext {
  cityId: string;
  landmark: Landmark | null;
}

/** Build a mapping context from a cityId and an optional landmark key. */
export function mapContext(cityId: string, landmarkKey?: string): MapContext {
  const city = cityOrDefault(cityId);
  return { cityId: city.id, landmark: resolveLandmark(city, landmarkKey) };
}

/** One entry of `unitSummeries` on a search result item. */
interface UnitSummary {
  text?: string;
  textType?: string;
  landmarkDesc?: string | null;
  distance?: string | null;
}

const summaryText = (summaries: UnitSummary[], textType: string): string =>
  summaries.find((s) => s.textType === textType)?.text || '';

/**
 * Map one element of `data.items` from `search/v2/searchhouse/bnb` to English.
 *
 * Field names here are taken from a live response, not guessed — the list endpoint
 * carries `finalPrice`/`commentBrief`/`houseTagsForCD`, and does NOT carry the
 * `price`/`commentScore`/`facilityList` names the detail-style payloads use.
 *
 * `ctx` scopes the geo work to one city — nearest-station is looked up in that city's
 * metro catalog, and landmark distance against that city's anchor.
 */
export function mapToEnglish(raw: any, ctx: MapContext = mapContext(DEFAULT_CITY_ID)): HotelEn {
  const summaries: UnitSummary[] = Array.isArray(raw.unitSummeries) ? raw.unitSummeries : [];
  const occupancy: Occupancy = parseOccupancy(summaryText(summaries, 'CANLIVEDESC'));
  const layout: Layout = parseLayout(summaryText(summaries, 'HOUSELEVEL'));
  const navigation = summaries.find((s) => s.textType === 'NAVIGATIONINFO');

  const tagText = (list: any): string[] =>
    (Array.isArray(list) ? list : [])
      .map((t: any) => (typeof t === 'string' ? t : t?.text))
      .filter((t: any): t is string => typeof t === 'string' && t.length > 0);

  // `houseTagsForCD` is the amenity list. `houseTags` is the promo strip — it repeats a
  // few amenities but also carries discount copy ("连住优惠减53"), which is not an amenity.
  const amenitiesCn = [...new Set(tagText(raw.houseTagsForCD))];
  const promotionsCn = tagText(raw.houseTags).filter((t) => !amenitiesCn.includes(t));
  const has = (...needles: string[]): boolean =>
    amenitiesCn.some((tag) => needles.some((n) => tag.includes(n)));

  // Both fields arrive masked ("1??") on an anonymous session — see parsePrice.
  const price = parsePrice(raw.finalPrice);
  const original = parsePrice(raw.productPrice);
  const originalCNY =
    original.exact !== null && original.exact !== price.exact ? original.exact : null;

  const lng = typeof raw.longitude === 'number' ? raw.longitude : null;
  const lat = typeof raw.latitude === 'number' ? raw.latitude : null;

  const comment = raw.commentBrief || raw.commentBriefForCD || {};

  return {
    id: String(raw.unitId ?? ''),
    name: raw.unitName || 'Unnamed',
    nameOriginal: raw.unitName || '',

    price: {
      perNightCNY: price.exact,
      perNightEUR: cnyToEurOrNull(price.exact),
      originalCNY,
      originalEUR: cnyToEurOrNull(originalCNY),
      cleaningFeeCNY: raw.cleaningAmount ?? 0,
      extraGuestFeeCNY: raw.addPeopleAmount ?? 0,
      masked: price.masked,
      fromCNY: price.from,
      toCNY: price.to,
      fromEUR: cnyToEurOrNull(price.from),
      toEUR: cnyToEurOrNull(price.to),
    },
    currency: 'EUR',

    rating: typeof comment.overall === 'number' ? comment.overall : null,
    ratingLabel: comment.scoreTitle || null,
    reviewCount: comment.totalCount ?? 0,
    // Tujia wraps the quoted highlight in fullwidth quotes; strip them.
    reviewHighlight: comment.commentBrief ? String(comment.commentBrief).replace(/[“”"]/g, '') : null,
    favoriteCount: parseInt(raw.favoriteCount, 10) || 0,

    location: {
      district: raw.districtName || raw.cityName || '',
      districtEn: translateDistrict(raw.districtName || raw.cityName || ''),
      address: raw.address || '',
      lng,
      lat,
      nearestMetro: (() => {
        const m = findNearestMetro(ctx.cityId, lng ?? undefined, lat ?? undefined);
        return m
          ? {
              station: m.nameEn,
              stationCn: m.nameCn,
              lines: m.lines,
              distanceKm: m.distanceKm,
              walkMinutes: m.walkMinutes,
            }
          : null;
      })(),
      distanceToLandmarkKm: distanceToLandmarkKm(ctx.landmark, lng ?? undefined, lat ?? undefined),
      landmark: ctx.landmark?.name ?? null,
      distanceToSearchAnchorM: typeof raw.distance === 'number' ? raw.distance : null,
      searchAnchor: raw.navigation?.name || navigation?.landmarkDesc?.replace(/^距/, '') || null,
    },

    room: {
      type: layout.typeEn,
      entirePlace: layout.entirePlace,
      areaSqm: layout.areaSqm,
      bedrooms: occupancy.bedrooms,
      doubleBeds: occupancy.doubleBeds,
      singleBeds: occupancy.singleBeds,
      maxGuests: occupancy.maxGuests,
      privateBathroom: has('独立卫浴', '卫浴'),
      kitchen: has('可做饭', '厨房'),
      wifi: has('wifi', 'WiFi', '无线网络'),
      ac: has('空调'),
      washingMachine: has('洗衣机'),
      elevator: has('电梯'),
    },

    // `pictureList` is a plain array of URL strings on this endpoint.
    images: (Array.isArray(raw.pictureList) ? raw.pictureList : [])
      .map((p: any) => (typeof p === 'string' ? p : p?.url))
      .filter(Boolean),
    imageCount: raw.pictureCount ?? 0,

    // Verified: /detail/<unitId>.htm renders the listing (房屋详情). /product/ and
    // /unit_<id>/ return the SPA shell with no content — every m.tujia.com path answers
    // HTTP 200 with the same 12 KB shell, so only a rendered check distinguishes them.
    bookUrl: `https://m.tujia.com/detail/${raw.unitId}.htm`,

    acceptsForeigners: has('接待外宾', '外宾'),
    nearMetro: has('近地铁'),
    freeParking: has('免费停车'),
    instantConfirm: has('立即确认') || raw.expressBooking === true,
    freeCancellation: has('免费取消'),
    petsAllowed: has('可带宠物', '携带宠物'),
    // failType 0 + fitSearchCondition means Tujia can actually sell it for these dates.
    available: raw.failType === 0 && raw.fitSearchCondition !== false,

    amenities: amenitiesCn.map(translateAmenity),
    amenitiesOriginal: amenitiesCn,
    promotions: promotionsCn,
  };
}
