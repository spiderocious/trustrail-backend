import { Router } from 'express';
import authRoutes from './authRoutes';
import trustWalletRoutes from './trustWalletRoutes';
import applicationRoutes from './applicationRoutes';
import paymentRoutes from './paymentRoutes';
import withdrawalRoutes from './withdrawalRoutes';
import dashboardRoutes from './dashboardRoutes';
import webhookRoutes from './webhookRoutes';
import publicRoutes from './publicRoutes';
import adminRoutes from './adminRoutes';
import healthRoutes from './healthRoutes';
import onepipeMockRoutes from './onepipeMockRoutes';

const router = Router();

/**
 * Route Aggregator
 * Combines all route modules
 */

// Health check (no prefix needed, mounted at /health)
router.use('/health', healthRoutes);

// Public routes (customer-facing)
router.use('/public', publicRoutes);

// API routes (business-facing, requires authentication)
router.use('/api/auth', authRoutes);
router.use('/api/trustwallets', trustWalletRoutes);
router.use('/api/applications', applicationRoutes);
router.use('/api/payments', paymentRoutes);
router.use('/api/withdrawals', withdrawalRoutes);
router.use('/api/dashboard', dashboardRoutes);
router.use('/api/webhooks', webhookRoutes);

// Webhook receiver (no auth, verified by signature)
router.use('/webhooks', webhookRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// OnePipe Mock (for testing/development)
router.use('/onepipe-mock', onepipeMockRoutes);

export default router;
