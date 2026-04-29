import { Router } from 'express';
import { getMyOrganization } from '../controllers/orgController';
import { activateTrial } from '../controllers/trialController';
import { requireAuth } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/gating';

const router = Router();

// Standard Auth Protected Routes
router.get('/me', requireAuth, getMyOrganization);
router.post('/trial', requireAuth, activateTrial);

// TIER GATED ROUTE: Requires Auth AND an Active Subscription/Trial
router.get('/secure-recovery-action', requireAuth, requireActiveSubscription, (req, res) => {
    res.json({ message: "[🔓] ACTION PERMITTED: Generating PDF Evidence..." });
});

export default router;
