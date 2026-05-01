import { Router } from 'express';
import { createCheckoutUrl } from '../controllers/billingController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/checkout', requireAuth, createCheckoutUrl);

export default router;
