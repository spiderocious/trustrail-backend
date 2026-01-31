import { Router } from 'express';
import { create, list, getOne, update, remove } from '../controllers/trustWalletController';
import { createTrustWalletValidation, updateTrustWalletValidation } from '../validators/trustWalletValidators';
import { validationMiddleware } from '../middleware/validationMiddleware';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/trustwallets - Create new TrustWallet
 */
router.post('/', createTrustWalletValidation, validationMiddleware, create);

/**
 * GET /api/trustwallets - List all TrustWallets for logged-in business
 */
router.get('/', list);

/**
 * GET /api/trustwallets/:id - Get single TrustWallet details
 */
router.get('/:id', getOne);

/**
 * PUT /api/trustwallets/:id - Update TrustWallet configuration
 */
router.put('/:id', updateTrustWalletValidation, validationMiddleware, update);

/**
 * DELETE /api/trustwallets/:id - Delete TrustWallet (soft delete)
 */
router.delete('/:id', remove);

export default router;
