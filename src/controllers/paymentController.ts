import { Request, Response, NextFunction } from 'express';
import { getPayments, getPaymentById } from '../services/paymentService';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * List all payments across all applications
 * GET /api/payments
 */
export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;

    const filters = {
      trustWalletId: req.query.trustWalletId as string | undefined,
      applicationId: req.query.applicationId as string | undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await getPayments(businessId, filters);

    res.status(200).json(
      ResponseFormatter.successWithPagination(
        result.payments,
        result.pagination
      )
    );
  } catch (error: any) {
    logger.error('List payments controller error:', error);
    next(error);
  }
};

/**
 * Get single payment transaction details
 * GET /api/payments/:id
 */
export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const transactionId = req.params.id;

    const payment = await getPaymentById(transactionId, businessId);

    if (!payment) {
      res.status(404).json(
        ResponseFormatter.error('Payment transaction not found')
      );
      return;
    }

    res.status(200).json(
      ResponseFormatter.success(payment)
    );
  } catch (error: any) {
    logger.error('Get payment controller error:', error);
    next(error);
  }
};
