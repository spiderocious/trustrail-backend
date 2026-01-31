import { Request, Response, NextFunction } from 'express';
import { getBusinessOverview, getTrustWalletAnalytics } from '../services/dashboardService';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * Get overall business statistics
 * GET /api/dashboard/overview
 */
export const getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;

    const overview = await getBusinessOverview(businessId);

    res.status(200).json(
      ResponseFormatter.success(overview)
    );
  } catch (error: any) {
    logger.error('Get dashboard overview controller error:', error);
    next(error);
  }
};

/**
 * Generate downloadable reports
 * GET /api/dashboard/reports
 */
export const getReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const type = req.query.type as 'applications' | 'payments';
    const trustWalletId = req.query.trustWalletId as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const format = (req.query.format as 'json' | 'csv') || 'json';

    // For MVP, just return JSON format
    // CSV generation can be added later

    if (type === 'applications') {
      // Get applications data
      const { listApplications } = await import('../services/applicationService');
      const result = await listApplications(businessId, {
        trustWalletId,
        startDate,
        endDate,
        page: 1,
        limit: 10000, // Large limit for reports
      });

      if (format === 'csv') {
        // TODO: Implement CSV generation
        res.status(501).json(
          ResponseFormatter.error('CSV format not implemented yet')
        );
        return;
      }

      res.status(200).json(
        ResponseFormatter.success(result.applications)
      );
    } else if (type === 'payments') {
      // Get payments data
      const { getPayments } = await import('../services/paymentService');
      const result = await getPayments(businessId, {
        trustWalletId,
        startDate,
        endDate,
        page: 1,
        limit: 10000,
      });

      if (format === 'csv') {
        // TODO: Implement CSV generation
        res.status(501).json(
          ResponseFormatter.error('CSV format not implemented yet')
        );
        return;
      }

      res.status(200).json(
        ResponseFormatter.success(result.payments)
      );
    } else {
      res.status(400).json(
        ResponseFormatter.error('Invalid report type. Must be "applications" or "payments"')
      );
    }
  } catch (error: any) {
    logger.error('Get reports controller error:', error);
    next(error);
  }
};

/**
 * Get TrustWallet-specific analytics
 * GET /api/dashboard/trustwallet/:trustWalletId/analytics
 */
export const getTrustWalletStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const trustWalletId = req.params.trustWalletId;

    const dateRange = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const analytics = await getTrustWalletAnalytics(trustWalletId, businessId, dateRange);

    res.status(200).json(
      ResponseFormatter.success(analytics)
    );
  } catch (error: any) {
    logger.error('Get TrustWallet analytics controller error:', error);
    next(error);
  }
};
