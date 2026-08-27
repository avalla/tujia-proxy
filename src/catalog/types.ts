/**
 * Shapes shared by every generated per-city catalog.
 *
 * These live here, hand-written, rather than being re-emitted into each generated
 * file: the generator writes data, not types, so adding a city never duplicates an
 * interface and the compiler checks every catalog against the same contract.
 */

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
  /**
   * Unique picker label. Shenzhen names most lines after a corridor (1号罗宝线),
   * so the qualifier rides here ("Line 1 · Luobao"); where a name still covers
   * several segments, the terminus pair is appended instead.
   */
  label: string;
  /**
   * Tujia's 全线 condition value (`7_*`), which filters the whole line server-side.
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

/** One city's complete filter vocabulary, as generated from `conditions/fetch`. */
export interface Catalog {
  /** Tujia cityId this catalog was generated for. */
  cityId: string;
  generatedAt: string;
  metroLines: MetroLine[];
  districts: CatalogPlace[];
  attractions: CatalogPlace[];
  amenityGroups: FilterGroup[];
  sortOptions: SortOption[];
  priceBands: PriceBand[];
}
