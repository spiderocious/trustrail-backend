import { Router } from 'express';
import { adminLogin } from '../controllers/authController';
import { getSystemHealth, getPWAHealth, getAuditLogs, getAllApplications } from '../controllers/adminController';
import { adminLoginValidation } from '../validators/authValidators';
import { validationMiddleware } from '../middleware/validationMiddleware';
import adminAuthMiddleware from '../middleware/adminAuthMiddleware';

const router = Router();

/**
 * POST /admin/auth/login - Admin login (no auth required)
 */
router.post('/auth/login', adminLoginValidation, validationMiddleware, adminLogin);

/**
 * All routes below require admin authentication
 */
router.use(adminAuthMiddleware);

/**
 * GET /admin/health - System health check with detailed metrics
 */
router.get('/health', getSystemHealth);

/**
 * GET /admin/pwa-health - Check PWA API connectivity and webhook status
 */
router.get('/pwa-health', getPWAHealth);

/**
 * GET /admin/audit-logs - View system audit logs with filters
 */
router.get('/audit-logs', getAuditLogs);

/**
 * GET /admin/applications - View all applications across all businesses
 */
router.get('/applications', getAllApplications);

export default router;
