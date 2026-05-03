import { Router } from 'express';
import { 
    connectStripeKey, 
    getMetrics, 
    getDisputes, 
    downloadEvidencePdf,
    downloadPOVReport // [NEW] Added the POV controller import
} from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/gating';

const router = Router();

router.post('/keys', requireAuth, requireActiveSubscription, connectStripeKey);
router.get('/metrics', requireAuth, getMetrics);
router.get('/disputes', requireAuth, requireActiveSubscription, getDisputes);
router.get('/disputes/:id/pdf', requireAuth, requireActiveSubscription, downloadEvidencePdf);

// --- 📊 PHASE 4: PROOF OF VALUE (POV) DASHBOARD DOWNLOAD ---
// Note: I adjusted the middleware to use your existing 'requireAuth' to keep the code clean.
router.get('/reports/pov', requireAuth, requireActiveSubscription, downloadPOVReport);

export default router;