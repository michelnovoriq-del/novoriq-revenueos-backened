import { Router } from 'express';
import { connectStripeKey, getMetrics, getDisputes, downloadEvidencePdf } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.post('/keys', requireAuth, connectStripeKey);
router.get('/metrics', requireAuth, getMetrics);
router.get('/disputes', requireAuth, getDisputes);
router.get('/disputes/:id/pdf', requireAuth, downloadEvidencePdf);

export default router;
