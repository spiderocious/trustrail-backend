import { Request, Response, NextFunction } from 'express';
import { requestWithdrawal, getWithdrawals } from '../services/withdrawalService';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * Request withdrawal of collected funds
 * POST /api/withdrawals
 */
export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const businessEmail = req.businessEmail!;
    const { trustWalletId, amount } = req.body;

    const withdrawal = await requestWithdrawal(businessId, businessEmail, trustWalletId, amount);

    res.status(201).json(
      ResponseFormatter.success(withdrawal, 'Withdrawal requested successfully')
    );
  } catch (error: any) {
    logger.error('Create withdrawal controller error:', error);
    next(error);
  }
};

/**
 * List withdrawal history
 * GET /api/withdrawals
 */
export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;

    const filters = {
      trustWalletId: req.query.trustWalletId as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await getWithdrawals(businessId, filters);

    const response: any = {
      data: result.withdrawals,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalCount: result.totalCount,
        totalPages: Math.ceil(result.totalCount / (filters.limit || 20)),
      },
    };

    // Include available balance if filtering by specific TrustWallet
    if (result.availableBalance !== undefined) {
      response.availableBalance = result.availableBalance;
    }

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('List withdrawals controller error:', error);
    next(error);
  }
};
