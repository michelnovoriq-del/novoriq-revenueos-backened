import { Router } from 'express';
import { login, register } from '../controllers/authController';

const router = Router();

router.post('/login', login);
// NEW: The route to handle new signups
router.post('/register', register);

export default router;