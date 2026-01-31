import { Router } from 'express';
import { list, getOne, approve, decline } from '../controllers/applicationController';
import { manualApproveValidation, manualDeclineValidation } from '../validators/applicationValidators';
import { validationMiddleware } from '../middleware/validationMiddleware';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/applications - List all applications for logged-in business
 */
router.get('/', list);

/**
 * GET /api/applications/:id - Get single application details
 */
router.get('/:id', getOne);

/**
 * POST /api/applications/:id/approve - Manually approve application
 */
router.post('/:id/approve', manualApproveValidation, validationMiddleware, approve);

/**
 * POST /api/applications/:id/decline - Manually decline application
 */
router.post('/:id/decline', manualDeclineValidation, validationMiddleware, decline);

export default router;
