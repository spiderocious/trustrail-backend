import { Router } from 'express';
import { create, list } from '../controllers/withdrawalController';
import { createWithdrawalValidation, listWithdrawalsValidation } from '../validators/paymentValidators';
import { validationMiddleware } from '../middleware/validationMiddleware';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/withdrawals - Request withdrawal of collected funds
 */
router.post('/', createWithdrawalValidation, validationMiddleware, create);

/**
 * GET /api/withdrawals - List withdrawal history
 */
router.get('/', listWithdrawalsValidation, validationMiddleware, list);

export default router;
