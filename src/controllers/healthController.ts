import { Request, Response, NextFunction } from 'express';
import Business from '../models/Business';
import logger from '../config/logger';

/**
 * Basic health check (for load balancers / monitoring)
 * GET /health
 */
export const healthCheck = async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    // Check database connection
    let dbStatus = 'disconnected';
    try {
      await Business.findOne().limit(1);
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
    }

    const healthData = {
      status: 'ok',
      timestamp: new Date(),
      database: dbStatus,
    };

    res.status(200).json(healthData);
  } catch (error: any) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date(),
      database: 'disconnected',
    });
  }
};
