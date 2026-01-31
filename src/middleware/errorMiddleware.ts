import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import env from '../config/environment';

/**
 * Global Error Handler Middleware
 * Catches all errors thrown in the application
 * Should be applied last in the middleware chain (after all routes)
 */
export const errorMiddleware = (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error to winston
  logger.error('Global error handler caught error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Extract status code (default to 500)
  const statusCode = error.statusCode || error.status || 500;

  // Extract error message
  const message = error.message || 'Internal server error';

  // Prepare error response
  const errorResponse: any = {
    error: message,
  };

  // In development, include stack trace
  if (env.nodeEnv === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error.details || undefined;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export default errorMiddleware;
