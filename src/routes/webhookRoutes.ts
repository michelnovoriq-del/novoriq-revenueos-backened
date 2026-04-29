import { Router } from 'express';
import { handleWhopWebhook } from '../webhooks/whopWebhook';

const router = Router();

// Route: POST /api/webhooks/whop
// Whop sends POST requests here
router.post('/whop', handleWhopWebhook);

export default router;