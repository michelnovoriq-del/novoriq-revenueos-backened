import { Router } from 'express';
import { connectStripeKey, getMetrics, getDisputes, downloadEvidencePdf } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/gating';

const router = Router();
router.post('/keys', requireAuth, requireActiveSubscription, connectStripeKey);
router.get('/metrics', requireAuth, getMetrics);
router.get('/disputes', requireAuth, requireActiveSubscription, getDisputes);
router.get('/disputes/:id/pdf', requireAuth, requireActiveSubscription, downloadEvidencePdf);

export default router;
