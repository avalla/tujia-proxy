import { HotelDetailEn } from '../types';
import {
  translateAmenity,
  translateDistrict,
  translateFacilityGroup,
  translateRule,
  translateScoreName,
  translateHostStat,
  translatePolicyText,
  translateSummaryItem,
  translateRatingLabel,
  translateReviewMeta,
  hasChinese,
  parseLayout,
} from '../utils/translator';
import { distanceToCantonFairKm, findNearestMetro } from '../utils/geo';
import { cnyToEur } from '../utils/currency';

/** "¥267" / "187" / 187 → 187 */
function toNumber(v: any): number {
  if (typeof v === 'number') return v;
  const m = String(v ?? '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

/** "如实描述 4.9" → { name: "Accuracy", score: 4.9 } */
function parseSubScore(s: string): { name: string; score: number } | null {
  const m = String(s).trim().match(/^(.+?)\s+([\d.]+)$/);
  if (!m) return null;
  return { name: translateScoreName(m[1]), score: parseFloat(m[2]) };
}

/** "干净卫生(6)" → { label: "Clean", count: 6 } */
function parseTag(t: any): { label: string; count: number } | null {
  const parts: string[] = Array.isArray(t?.texts) ? t.texts : [];
  const raw = parts[0] || String(t?.text ?? '').replace(/\(\d+\)$/, '');
  if (!raw) return null;
  const countStr = parts[1] || String(t?.text ?? '').match(/\((\d+)\)$/)?.[0] || '';
  return { label: translateAmenity(raw), count: parseInt(countStr.replace(/\D/g, ''), 10) || 0 };
}

/**
 * Map `house/gethouse/v3/bnb` to English.
 *
 * The shape is completely different from the search-list item, so this is a separate
 * mapper from `mapper.ts` on purpose — see CLAUDE.md.
 */
export function mapDetailToEnglish(raw: any, unitId: string): HotelDetailEn {
  const data = raw?.data ?? {};
  const main = data.mainPart ?? {};
  const top = main.topModule ?? {};
  const dyn = main.dynamicModule ?? {};
  const house = data.currentHouse ?? {};

  const position = dyn.positionModule ?? {};
  const facility = dyn.facilityModule ?? {};
  const comments = dyn.commentModule ?? {};
  const landlord = dyn.landlordModule ?? {};
  const rules = dyn.rulesModule ?? {};

  const lng = typeof position.longitude === 'number' ? position.longitude : null;
  const lat = typeof position.latitude === 'number' ? position.latitude : null;

  const finalPrice = toNumber(house.finalPrice);
  const originalPrice = toNumber(house.productPrice);

  // `deleted: true` means the property does NOT have it. Listing those as amenities
  // would advertise things the place lacks, so they are split out explicitly.
  const groups = (facility.houseFacility?.houseFacilitys ?? []) as any[];
  const facilityGroups = groups
    .map((g) => ({
      group: translateFacilityGroup(g.groupName || ''),
      groupCn: g.groupName || '',
      items: (g.facilitys ?? [])
        .filter((f: any) => f?.deleted === false)
        .map((f: any) => ({ en: translateAmenity(f.name), cn: f.name })),
    }))
    .filter((g) => g.items.length > 0);

  const unavailable = groups
    .flatMap((g) => (g.facilitys ?? []).filter((f: any) => f?.deleted === true))
    .map((f: any) => ({ en: translateAmenity(f.name), cn: f.name }));

  const layout = parseLayout(String(house.houseSummary || ''));
  const nearest = findNearestMetro(lng ?? undefined, lat ?? undefined);

  const bedrooms = typeof house.bedRoomCount === 'number' ? house.bedRoomCount : null;
  const district = translateDistrict(position.areaName || '');

  // Neither name Tujia ships is English: `currentHouse.houseName` is a short Chinese
  // title (清新二室一厅套房) and `topModule.houseName` is the keyword string from search.
  // Synthesise the headline from structured facts, as the result cards do, and keep
  // both Chinese forms so nothing is hidden.
  const headline =
    [
      layout.typeEn,
      layout.areaSqm ? `${layout.areaSqm} m²` : '',
      bedrooms ? `${bedrooms} bedroom${bedrooms === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' · ') + (district ? ` in ${district}` : '');

  return {
    id: String(data.houseId ?? unitId),
    name: headline.trim() || 'Stay',
    /** Tujia's short Chinese title — more readable than the search keyword string. */
    nameCn: house.houseName || '',
    nameOriginal: top.houseName || house.houseName || '',
    summary: house.houseSummary || '',
    /** "2室 1厅 1卫 1厨 28㎡ 可住4人 2床" — kept raw, it is dense and hard to translate faithfully. */
    layoutRaw: facility.houseContent || '',
    layout: {
      type: layout.typeEn,
      entirePlace: layout.entirePlace,
      areaSqm: layout.areaSqm,
      bedrooms,
      highlights: (facility.houseSummary ?? [])
        .map((s: any) => translateSummaryItem([s.title, s.text].filter(Boolean).join('·').trim()))
        .filter(Boolean),
    },

    price: {
      perNightCNY: finalPrice,
      perNightEUR: cnyToEur(finalPrice),
      originalCNY: originalPrice && originalPrice !== finalPrice ? originalPrice : null,
      originalEUR:
        originalPrice && originalPrice !== finalPrice ? cnyToEur(originalPrice) : null,
      // Tujia's `discount` is a 折 figure: 7.0 means you pay 70% of list, i.e. 30% off.
      discountLabel: (() => {
        const d = parseFloat(house.discount);
        if (!Number.isFinite(d) || d <= 0 || d >= 10) return null;
        return `${Math.round((10 - d) * 10)}% off`;
      })(),
      minNights: typeof house.minRequireNights === 'number' ? house.minRequireNights : null,
      bookable: house.allowBooking === true && data.canSale === true,
    },

    rating: typeof comments.overall === 'number' ? comments.overall : null,
    ratingLabel: translateRatingLabel(comments.scoreTitleV2 || comments.scoreTitle || '') || null,
    reviewCount: comments.totalCount ?? 0,
    subScores: (comments.subScores ?? []).map(parseSubScore).filter(Boolean) as {
      name: string;
      score: number;
    }[],
    reviewTags: (comments.commentTagVo ?? []).map(parseTag).filter(Boolean) as {
      label: string;
      count: number;
    }[],
    reviews: (comments.commentList ?? []).map((c: any) => ({
      id: String(c.commentId ?? ''),
      author: translateReviewMeta(c.userName || '') || 'Guest',
      score: typeof c.overall === 'number' ? c.overall : null,
      date: c.checkInDate || '',
      // The translation fields exist on every review but Tujia never populates them
      // (commentDetailHasTranslation is always false), so this is the Chinese original.
      text: c.commentDetailTranslation || c.commentDetail || '',
      textOriginal: c.commentDetail || '',
      translatedByTujia: Boolean(c.commentDetailTranslation),
      // Not a count — a bucket phrase like 小住几晚 ("a few nights").
      stayLength: c.orderTotalStayNight ? translateReviewMeta(String(c.orderTotalStayNight)) : null,
    })),

    location: {
      address: position.address || '',
      district: position.areaName || '',
      districtEn: district,
      city: position.cityName || '',
      area: position.tradeArea || position.poi || '',
      lng,
      lat,
      distanceToCantonFairKm: distanceToCantonFairKm(lng ?? undefined, lat ?? undefined),
      nearestMetro: nearest
        ? {
            station: nearest.nameEn,
            stationCn: nearest.nameCn,
            lines: nearest.lines,
            distanceKm: nearest.distanceKm,
            walkMinutes: nearest.walkMinutes,
          }
        : null,
      /** Baidu static map image Tujia renders on its own page. */
      mapImageUrl: position.mapUrl || null,
    },

    host: {
      name: landlord.hotelName || 'Host',
      logo: landlord.hotelLogo || null,
      level: typeof landlord.landlordLevel === 'number' ? landlord.landlordLevel : null,
      repliesWithin5Min: landlord.isReplyTimeMoreThan5Min === false,
      tags: (landlord.hotelTags ?? [])
        .map((t: any) => translateAmenity(t?.tagText?.text || t?.text || ''))
        .filter(Boolean),
      stats: (landlord.hotelSummary ?? []).map((s: any) => ({
        label: translateHostStat(s.title || ''),
        value: s.introduction || '',
      })),
    },

    images: (top.housePicture?.housePics ?? [])
      .map((p: any) => (typeof p === 'string' ? p : p?.url || p?.pictureURL))
      .filter(Boolean),

    amenities: facilityGroups,
    amenitiesUnavailable: unavailable,
    tags: (top.houseTags ?? [])
      .map((t: any) => translateAmenity(t?.text || t?.name || t?.tagText?.text || ''))
      .filter(Boolean),

    rules: {
      checkIn: (rules.checkInRules ?? []).flatMap((section: any) =>
        (section.items ?? []).map((i: any) => ({
          label: translateRule(i.introduction || ''),
          labelCn: i.introduction || '',
          // isDeleted marks a rule as NOT permitted (no pets, no cooking, …).
          allowed: i.isDeleted !== true,
          note: i.tip ? translatePolicyText(i.tip) : null,
          noteCn: i.tip || null,
        }))
      ),
      cancellation: (rules.cancelRules ?? []).map((r: any) => ({
        when: translatePolicyText(r.introduction || ''),
        whenCn: r.introduction || '',
        note: r.tip ? translatePolicyText(r.tip) : null,
        noteCn: r.tip || null,
        // Flag anything the phrase table could not fully render, so the UI can offer
        // the Chinese original instead of silently showing a half-translated string.
        partial: hasChinese(
          translatePolicyText(r.introduction || '') + translatePolicyText(r.tip || '')
        ),
      })),
      costs: (rules.costVO?.rules ?? []).map((r: any) => ({
        label: translateRule(r.title || ''),
        labelCn: r.title || '',
        detail: translatePolicyText(r.introduction || ''),
        detailCn: r.introduction || '',
        partial: hasChinese(translatePolicyText(r.introduction || '')),
      })),
    },

    bookUrl: `https://m.tujia.com/detail/${data.houseId ?? unitId}.htm`,
  };
}
