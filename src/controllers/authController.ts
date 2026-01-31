import { Request, Response, NextFunction } from 'express';
import { registerBusiness, loginBusiness, loginAdmin } from '../services/authService';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * Register new business owner
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const registrationData = {
      businessName: req.body.businessName,
      email: req.body.email,
      password: req.body.password,
      phoneNumber: req.body.phoneNumber,
      rcNumber: req.body.rcNumber,
      settlementAccountNumber: req.body.settlementAccountNumber,
      settlementBankCode: req.body.settlementBankCode,
      settlementAccountName: req.body.settlementAccountName,
    };

    const result = await registerBusiness(registrationData);

    res.status(201).json(
      ResponseFormatter.success(result, 'Business registered successfully')
    );
  } catch (error: any) {
    logger.error('Register controller error:', error);
    next(error);
  }
};

/**
 * Business owner login
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await loginBusiness(email, password);

    res.status(200).json(
      ResponseFormatter.success(result, 'Login successful')
    );
  } catch (error: any) {
    logger.error('Login controller error:', error);
    next(error);
  }
};

/**
 * Logout (client-side only for MVP)
 * POST /api/auth/logout
 */
export const logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // For MVP, JWT is stateless, so logout is handled client-side
    // Client should delete the token from storage
    res.status(200).json(
      ResponseFormatter.success(null, 'Logged out successfully. Please delete your token.')
    );
  } catch (error: any) {
    logger.error('Logout controller error:', error);
    next(error);
  }
};

/**
 * Admin login
 * POST /admin/auth/login
 */
export const adminLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await loginAdmin(email, password);

    res.status(200).json(
      ResponseFormatter.success(result, 'Admin login successful')
    );
  } catch (error: any) {
    logger.error('Admin login controller error:', error);
    next(error);
  }
};
