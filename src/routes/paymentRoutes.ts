import { Router } from 'express';
import { list, getOne } from '../controllers/paymentController';
import { listPaymentsValidation } from '../validators/paymentValidators';
import { validationMiddleware } from '../middleware/validationMiddleware';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/payments - List all payments across all applications
 */
router.get('/', listPaymentsValidation, validationMiddleware, list);

/**
 * GET /api/payments/:id - Get single payment transaction details
 */
router.get('/:id', getOne);

export default router;
