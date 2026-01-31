import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * HTTP Request/Response Logging Middleware
 * Logs all HTTP requests and responses with timing information
 * Should be applied early in the middleware chain (before routes)
 */
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Record request start time
  const startTime = Date.now();

  // Get client IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // Listen for response finish event
  res.on('finish', () => {
    // Calculate duration
    const duration = Date.now() - startTime;

    // Log request/response details
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent: req.get('user-agent') || 'unknown',
    });
  });

  // Continue to next middleware immediately (don't block request)
  next();
};

export default loggingMiddleware;
