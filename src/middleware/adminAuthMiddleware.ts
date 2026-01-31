import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/environment';
import logger from '../config/logger';

/**
 * JWT Authentication Middleware for Admin APIs
 * Verifies admin JWT token and checks for admin role
 */
export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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

    // Verify token using admin JWT secret
    try {
      const decoded = jwt.verify(token, env.adminJwtSecret) as {
        role: string;
        email: string;
        iat: number;
        exp: number;
      };

      // Check if role is admin
      if (decoded.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
      }

      // Attach admin flag to request object
      req.isAdmin = true;

      // Continue to next middleware/controller
      next();
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Admin token expired' });
        return;
      }

      if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid admin token' });
        return;
      }

      logger.error('Admin JWT verification error:', jwtError);
      res.status(401).json({ error: 'Admin token verification failed' });
      return;
    }
  } catch (error: any) {
    logger.error('Admin auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error during admin authentication' });
    return;
  }
};

export default adminAuthMiddleware;
