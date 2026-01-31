import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/environment';
import logger from '../config/logger';

/**
 * JWT Authentication Middleware for Business APIs
 * Verifies JWT token and attaches businessId and businessEmail to request
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'No authorization header provided' });
      return;
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
      return;
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, env.jwtSecret) as {
        businessId: string;
        email: string;
        iat: number;
        exp: number;
      };

      // Attach businessId and businessEmail to request object
      req.businessId = decoded.businessId;
      req.businessEmail = decoded.email;

      // Continue to next middleware/controller
      next();
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
        return;
      }

      if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      logger.error('JWT verification error:', jwtError);
      res.status(401).json({ error: 'Token verification failed' });
      return;
    }
  } catch (error: any) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
    return;
  }
};

export default authMiddleware;
