import { Router } from 'express';

const router = Router();

const CITIES = [
  { id: '45', name: 'Guangzhou', nameCN: '广州' },
  { id: '30', name: 'Shenzhen', nameCN: '深圳' },
  { id: '2', name: 'Beijing', nameCN: '北京' },
  { id: '7', name: 'Shanghai', nameCN: '上海' },
];

router.get('/', (_req, res) => {
  res.json(CITIES);
});

export default router;
