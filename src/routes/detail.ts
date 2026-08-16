import { Router } from 'express';

const router = Router();

/**
 * Not implemented.
 *
 * The path this route used to call — /bnbapp-node-h5/h5/unit/detail — was never a
 * real Tujia endpoint; it 404s with a Ctrip-style ResponseStatus envelope. The real
 * detail request has not been sniffed yet.
 *
 * To implement: open a listing on m.tujia.com with DevTools recording, copy the
 * detail XHR into requests.http, then wire it up here the way search() is wired.
 *
 * In the meantime the search endpoint already returns per-unit images, amenities,
 * occupancy, coordinates and pricing, which covers most of what a detail view needs.
 */
router.get('/:id', (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    message: 'The Tujia unit-detail endpoint has not been reverse-engineered yet.',
    unitId: req.params.id,
    bookUrl: `https://m.tujia.com/detail/${req.params.id}.htm`,
  });
});

export default router;
