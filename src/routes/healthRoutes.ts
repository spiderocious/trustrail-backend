import { Router } from 'express';
import { healthCheck } from '../controllers/healthController';

const router = Router();

/**
 * GET /health - Basic health check (for load balancers / monitoring)
 */
router.get('/', healthCheck);

export default router;
