import { Request, Response, NextFunction } from 'express';
import {
  listApplications,
  getApplicationById,
  manuallyApprove,
  manuallyDecline,
} from '../services/applicationService';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * List all applications for logged-in business
 * GET /api/applications
 */
export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;

    const filters = {
      trustWalletId: req.query.trustWalletId as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await listApplications(businessId, filters);

    res.status(200).json(
      ResponseFormatter.successWithPagination(
        result.applications,
        result.pagination
      )
    );
  } catch (error: any) {
    logger.error('List applications controller error:', error);
    next(error);
  }
};

/**
 * Get single application details
 * GET /api/applications/:id
 */
export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const applicationId = req.params.id;

    const application = await getApplicationById(applicationId, businessId);

    if (!application) {
      res.status(404).json(
        ResponseFormatter.error('Application not found')
      );
      return;
    }

    res.status(200).json(
      ResponseFormatter.success(application)
    );
  } catch (error: any) {
    logger.error('Get application controller error:', error);
    next(error);
  }
};

/**
 * Manually approve application (for flagged applications)
 * POST /api/applications/:id/approve
 */
export const approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const businessEmail = req.businessEmail!;
    const applicationId = req.params.id;
    const notes = req.body.notes;

    const application = await manuallyApprove(applicationId, businessId, businessEmail, notes);

    res.status(200).json(
      ResponseFormatter.success(application, 'Application approved successfully')
    );
  } catch (error: any) {
    logger.error('Approve application controller error:', error);
    next(error);
  }
};

/**
 * Manually decline application
 * POST /api/applications/:id/decline
 */
export const decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const businessEmail = req.businessEmail!;
    const applicationId = req.params.id;
    const reason = req.body.reason;

    const application = await manuallyDecline(applicationId, businessId, businessEmail, reason);

    res.status(200).json(
      ResponseFormatter.success(application, 'Application declined successfully')
    );
  } catch (error: any) {
    logger.error('Decline application controller error:', error);
    next(error);
  }
};
