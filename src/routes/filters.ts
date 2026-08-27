import { Router } from 'express';
import { CITIES, DEFAULT_CITY_ID, findCity, getCatalog, hasCatalog } from '../catalog';

const router = Router();

/**
 * The English filter catalog that drives the UI, for one city.
 * Regenerate from Tujia with `bun run catalog`.
 *
 *   GET /api/v1/filters            → the default city (Guangzhou)
 *   GET /api/v1/filters?city=49    → Shenzhen; slug ("shenzhen") also accepted
 *
 * The city list rides along on every response so the UI can populate its city picker
 * from the same request that fills the rest of the form.
 */
router.get('/', (req, res) => {
  const key = (req.query.city ?? req.query.cityId ?? DEFAULT_CITY_ID) as string;
  const city = findCity(key);
  const catalog = city && hasCatalog(city.id) ? getCatalog(city.id) : undefined;

  if (!city || !catalog) {
    res.status(400).json({
      error: 'Unsupported city',
      message: `No catalog for city "${key}". Add it to src/catalog/cities.ts and run \`bun run catalog\`.`,
      supported: CITIES.filter((c) => hasCatalog(c.id)).map((c) => ({ id: c.id, name: c.name })),
    });
    return;
  }

  res.json({
    city: {
      id: city.id,
      slug: city.slug,
      name: city.name,
      nameCn: city.nameCn,
      // Coordinates ride along so the UI can rank stations by distance to the anchor
      // (the "stations near the fair" shortcut) without a second round trip.
      landmarks: city.landmarks,
    },
    // Only cities we actually shipped a catalog for are offered — a registry entry
    // whose generator run has not happened yet would render an empty form.
    cities: CITIES.filter((c) => hasCatalog(c.id)).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      nameCn: c.nameCn,
    })),
    generatedAt: catalog.generatedAt,
    metroLines: catalog.metroLines,
    districts: catalog.districts,
    attractions: catalog.attractions,
    amenityGroups: catalog.amenityGroups,
    sortOptions: catalog.sortOptions,
    priceBands: catalog.priceBands,
  });
});

export default router;
