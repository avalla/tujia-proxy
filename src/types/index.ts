export interface SearchRequest {
  cityId: string;
  checkIn: string;
  checkOut: string;
  pageIndex?: number;
  pageSize?: number;
  priceMin?: number;
  priceMax?: number;
  district?: string;
  roomCount?: number;
  guestCount?: number;
  /** Arbitrary filter values from the catalog, e.g. ["237", "2301", "201"]. */
  amenities?: string[];
  /** Sort condition value from the catalog; "1" = most popular. */
  sort?: string;
  /** Convenience aliases; folded into `amenities`. */
  acceptForeigners?: boolean;
  nearMetro?: boolean;
  freeParking?: boolean;
  maxDistanceToFairKm?: number;
  metroStationId?: string;
  metroStationName?: string;
  metroLng?: number;
  metroLat?: number;
  /**
   * Whole-line filter: a `7_*` value from the catalog's `METRO_LINES[].filterValue`.
   * Filters to listings near any station on that line, server-side. Ignored when
   * `metroStationId` is set — a single station is the more specific request.
   */
  metroLineId?: string;
}

export interface NearestMetroEn {
  station: string;
  stationCn: string;
  /** Every line serving the station — interchanges list more than one. */
  lines: string[];
  distanceKm: number;
  walkMinutes: number;
}

export interface LocationEn {
  district: string;
  districtEn: string;
  address: string;
  lng: number | null;
  lat: number | null;
  /**
   * Closest metro station of the 406 in the catalog, by straight-line distance from the
   * unit's own coordinates. Independent of whether the search was anchored on a station.
   */
  nearestMetro: NearestMetroEn | null;
  /** Real haversine distance to the Canton Fair complex, in km. Null if the unit has no coordinates. */
  distanceToCantonFairKm: number | null;
  /** Tujia's own distance to whatever landmark the search was anchored on (metro station, etc.), in metres. */
  distanceToSearchAnchorM: number | null;
  /** The landmark that `distanceToSearchAnchorM` is measured from, e.g. "万胜围地铁站". */
  searchAnchor: string | null;
}

export interface RoomEn {
  type: string;
  entirePlace: boolean;
  areaSqm: number | null;
  bedrooms: number | null;
  doubleBeds: number | null;
  singleBeds: number | null;
  maxGuests: number | null;
  privateBathroom: boolean;
  kitchen: boolean;
  wifi: boolean;
  ac: boolean;
  washingMachine: boolean;
  elevator: boolean;
}

export interface PriceEn {
  /** What you actually pay per night, after discounts. */
  perNightCNY: number;
  perNightEUR: number;
  /** Pre-discount nightly rate, when Tujia reports one. */
  originalCNY: number | null;
  originalEUR: number | null;
  cleaningFeeCNY: number;
  extraGuestFeeCNY: number;
}

export interface HotelEn {
  id: string;
  name: string;
  nameOriginal: string;
  price: PriceEn;
  currency: 'EUR';
  rating: number | null;
  ratingLabel: string | null;
  reviewCount: number;
  reviewHighlight: string | null;
  favoriteCount: number;
  location: LocationEn;
  room: RoomEn;
  images: string[];
  imageCount: number;
  bookUrl: string;
  acceptsForeigners: boolean;
  nearMetro: boolean;
  freeParking: boolean;
  instantConfirm: boolean;
  freeCancellation: boolean;
  petsAllowed: boolean;
  /** True when Tujia says the unit is actually bookable for the requested dates. */
  available: boolean;
  amenities: string[];
  amenitiesOriginal: string[];
  /** Discount copy from Tujia's promo strip, e.g. "连住优惠减53". Left untranslated — the amounts are dynamic. */
  promotions: string[];
}

export interface NamedItem {
  en: string;
  cn: string;
}

/** Full listing detail, from `house/gethouse/v3/bnb`. Distinct shape from HotelEn. */
export interface HotelDetailEn {
  id: string;
  /** Synthesised English headline — Tujia ships no English title of any kind. */
  name: string;
  /** Tujia's short Chinese title, e.g. 清新二室一厅套房. */
  nameCn: string;
  /** The long keyword string used in search results. */
  nameOriginal: string;
  summary: string;
  layoutRaw: string;
  layout: {
    type: string;
    entirePlace: boolean;
    areaSqm: number | null;
    bedrooms: number | null;
    highlights: string[];
  };
  price: {
    perNightCNY: number;
    perNightEUR: number;
    originalCNY: number | null;
    originalEUR: number | null;
    discountLabel: string | null;
    minNights: number | null;
    bookable: boolean;
  };
  rating: number | null;
  ratingLabel: string | null;
  reviewCount: number;
  subScores: { name: string; score: number }[];
  reviewTags: { label: string; count: number }[];
  reviews: {
    id: string;
    author: string;
    score: number | null;
    date: string;
    text: string;
    textOriginal: string;
    translatedByTujia: boolean;
    /** A bucket phrase ("a few nights"), not a number — Tujia does not expose the count. */
    stayLength: string | null;
  }[];
  location: {
    address: string;
    district: string;
    districtEn: string;
    city: string;
    area: string;
    lng: number | null;
    lat: number | null;
    distanceToCantonFairKm: number | null;
    nearestMetro: NearestMetroEn | null;
    mapImageUrl: string | null;
  };
  host: {
    name: string;
    logo: string | null;
    level: number | null;
    repliesWithin5Min: boolean;
    tags: string[];
    stats: { label: string; value: string }[];
  };
  images: string[];
  amenities: { group: string; groupCn: string; items: NamedItem[] }[];
  /** Facilities Tujia explicitly marks as absent — shown so the list is honest. */
  amenitiesUnavailable: NamedItem[];
  tags: string[];
  rules: {
    checkIn: {
      label: string;
      labelCn: string;
      allowed: boolean;
      note: string | null;
      noteCn: string | null;
    }[];
    /** `partial` means some Chinese survived the phrase table — show the original too. */
    cancellation: {
      when: string;
      whenCn: string;
      note: string | null;
      noteCn: string | null;
      partial: boolean;
    }[];
    costs: {
      label: string;
      labelCn: string;
      detail: string;
      detailCn: string;
      partial: boolean;
    }[];
  };
  bookUrl: string;
}

export interface SearchResponse {
  query: SearchRequest;
  results: HotelEn[];
  /** Units returned on this page. */
  total: number;
  /** Tujia's total match count across all pages. */
  totalAvailable: number | null;
  /** Tujia's count of units actually bookable for these dates. */
  bookableCount: number | null;
  /**
   * Upstream page a follow-up request should resume from, or null when exhausted.
   * Not simply `pageIndex + 1`: applying a local-only filter walks several upstream
   * pages per response, so the client must echo this value back.
   */
  nextPageIndex: number | null;
  hasMore: boolean;
  /** Units pulled from Tujia while applying a local-only filter. Absent when none was applied. */
  scanned?: number;
  /** Upstream pages walked to fill this page. Absent when no local-only filter was applied. */
  pagesScanned?: number;
  cached: boolean;
}
