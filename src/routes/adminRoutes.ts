import { Router } from 'express';
import { getAllOrganizations, markDisputeWon } from '../controllers/adminController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.get('/organizations', requireAuth, getAllOrganizations);
router.post('/resolve-won', requireAuth, markDisputeWon);

export default router;
