import { Router } from 'express';
import { CITIES, hasCatalog } from '../catalog';

const router = Router();

/**
 * The cities this proxy can search.
 *
 * `catalog: false` means the city is registered but its taxonomy has never been
 * generated — `/api/v1/search` rejects it. Run `bun run catalog -- --city <slug>`.
 */
router.get('/', (_req, res) => {
  res.json(
    CITIES.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      nameCN: c.nameCn,
      catalog: hasCatalog(c.id),
      landmarks: c.landmarks.map((l) => ({ key: l.key, name: l.name, nameCn: l.nameCn })),
    }))
  );
});

export default router;
