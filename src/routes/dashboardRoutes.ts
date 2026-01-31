import { Router } from 'express';
import { getOverview, getReports, getTrustWalletStats } from '../controllers/dashboardController';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/dashboard/overview - Get overall business statistics
 */
router.get('/overview', getOverview);

/**
 * GET /api/dashboard/reports - Generate downloadable reports
 */
router.get('/reports', getReports);

/**
 * GET /api/dashboard/trustwallet/:trustWalletId/analytics - Get TrustWallet analytics
 */
router.get('/trustwallet/:trustWalletId/analytics', getTrustWalletStats);

export default router;
