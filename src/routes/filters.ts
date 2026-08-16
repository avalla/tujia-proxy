import { Router } from 'express';
import {
  METRO_LINES,
  DISTRICTS,
  ATTRACTIONS,
  AMENITY_GROUPS,
  SORT_OPTIONS,
  PRICE_BANDS,
  GENERATED_AT,
} from '../catalog/filters.generated';

const router = Router();

/**
 * The English filter catalog that drives the UI.
 * Regenerate from Tujia with `bun run catalog`.
 */
router.get('/', (_req, res) => {
  res.json({
    generatedAt: GENERATED_AT,
    metroLines: METRO_LINES,
    districts: DISTRICTS,
    attractions: ATTRACTIONS,
    amenityGroups: AMENITY_GROUPS,
    sortOptions: SORT_OPTIONS,
    priceBands: PRICE_BANDS,
  });
});

export default router;
