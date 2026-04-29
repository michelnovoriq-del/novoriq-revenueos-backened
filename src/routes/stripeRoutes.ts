import { Router } from 'express';
import { handleStripeWebhook } from '../controllers/dashboardController';

const router = Router();

// Multi-tenant endpoint: Captures the organization ID directly from the URL.
// 🚨 FIXED: Changed from :organizationId to :orgId to match the webhook code perfectly.
router.post('/:orgId', handleStripeWebhook);

export default router;