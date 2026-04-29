import { Router } from 'express';
import { redeemPromo } from '../controllers/promoController';

const router = Router();

// Endpoint: POST /api/promo/redeem
router.post('/redeem', redeemPromo);

export default router;
