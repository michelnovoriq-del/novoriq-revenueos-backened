import { Router } from 'express';
import { ingestTrackingData } from '../controllers/trackingController';

const router = Router();

// Endpoint for the merchant's website to post data to
router.post('/', ingestTrackingData);

export default router;
