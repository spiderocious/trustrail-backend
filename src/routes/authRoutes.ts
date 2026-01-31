import { Router } from 'express';
import { register, login, logout } from '../controllers/authController';
import { registerValidation, loginValidation } from '../validators/authValidators';
import { validationMiddleware } from '../middleware/validationMiddleware';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

/**
 * POST /api/auth/register - Register new business
 */
router.post('/register', registerValidation, validationMiddleware, register);

/**
 * POST /api/auth/login - Business login
 */
router.post('/login', loginValidation, validationMiddleware, login);

/**
 * POST /api/auth/logout - Logout (client-side for MVP)
 */
router.post('/logout', authMiddleware, logout);

export default router;
