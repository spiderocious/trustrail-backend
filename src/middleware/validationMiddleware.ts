import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Validation Middleware
 * Handles express-validator validation errors
 * Should be used after validation chains in routes
 */
export const validationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Check for validation errors
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format error messages
    const formattedErrors = errors.array().map((error) => ({
      field: error.type === 'field' ? (error as any).path : undefined,
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));

    // Return 400 Bad Request with error details
    res.status(400).json({
      error: 'Validation failed',
      errors: formattedErrors,
    });
    return;
  }

  // No errors, proceed to next middleware/controller
  next();
};

export default validationMiddleware;
