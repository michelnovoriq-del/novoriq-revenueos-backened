import { Router } from 'express';
import { generateBleedReport } from '../controllers/auditController';

const router = Router();

router.post('/bleed-report', generateBleedReport);

export default router;