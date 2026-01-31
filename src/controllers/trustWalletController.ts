import { Request, Response, NextFunction } from 'express';
import {
  createTrustWallet,
  listTrustWallets,
  getTrustWalletById,
  updateTrustWallet,
  deleteTrustWallet,
} from '../services/trustWalletService';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * Create new TrustWallet
 * POST /api/trustwallets
 */
export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!; // From auth middleware
    const businessEmail = req.businessEmail!;

    const trustWalletData = {
      name: req.body.name,
      description: req.body.description,
      installmentPlan: req.body.installmentPlan,
      approvalWorkflow: req.body.approvalWorkflow,
    };

    const trustWallet = await createTrustWallet(businessId, businessEmail, trustWalletData);

    res.status(201).json(
      ResponseFormatter.success(trustWallet, 'TrustWallet created successfully')
    );
  } catch (error: any) {
    logger.error('Create TrustWallet controller error:', error);
    next(error);
  }
};

/**
 * List all TrustWallets for logged-in business
 * GET /api/trustwallets
 */
export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;

    const filters = {
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await listTrustWallets(businessId, filters);

    res.status(200).json(
      ResponseFormatter.successWithPagination(
        result.trustWallets,
        result.pagination
      )
    );
  } catch (error: any) {
    logger.error('List TrustWallets controller error:', error);
    next(error);
  }
};

/**
 * Get single TrustWallet details
 * GET /api/trustwallets/:id
 */
export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const trustWalletId = req.params.id;

    const trustWallet = await getTrustWalletById(trustWalletId, businessId);

    if (!trustWallet) {
      res.status(404).json(
        ResponseFormatter.error('TrustWallet not found')
      );
      return;
    }

    res.status(200).json(
      ResponseFormatter.success(trustWallet)
    );
  } catch (error: any) {
    logger.error('Get TrustWallet controller error:', error);
    next(error);
  }
};

/**
 * Update TrustWallet configuration
 * PUT /api/trustwallets/:id
 */
export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const businessEmail = req.businessEmail!;
    const trustWalletId = req.params.id;

    const updates = {
      name: req.body.name,
      description: req.body.description,
      installmentPlan: req.body.installmentPlan,
      approvalWorkflow: req.body.approvalWorkflow,
    };

    const trustWallet = await updateTrustWallet(trustWalletId, businessId, businessEmail, updates);

    res.status(200).json(
      ResponseFormatter.success(trustWallet, 'TrustWallet updated successfully')
    );
  } catch (error: any) {
    logger.error('Update TrustWallet controller error:', error);
    next(error);
  }
};

/**
 * Delete TrustWallet (soft delete)
 * DELETE /api/trustwallets/:id
 */
export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const businessEmail = req.businessEmail!;
    const trustWalletId = req.params.id;

    await deleteTrustWallet(trustWalletId, businessId, businessEmail);

    res.status(200).json(
      ResponseFormatter.success(null, 'TrustWallet deleted successfully')
    );
  } catch (error: any) {
    logger.error('Delete TrustWallet controller error:', error);
    next(error);
  }
};
