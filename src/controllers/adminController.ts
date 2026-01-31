import { Request, Response, NextFunction } from 'express';
import Business from '../models/Business';
import Application from '../models/Application';
import PWAWebhookLog from '../models/PWAWebhookLog';
import BusinessWebhookLog from '../models/BusinessWebhookLog';
import AuditLog from '../models/AuditLog';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * System health check with detailed metrics
 * GET /admin/health
 */
export const getSystemHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check database connection
    let dbStatus = 'disconnected';
    let dbResponseTime = 0;
    try {
      const startTime = Date.now();
      await Business.findOne().limit(1);
      dbResponseTime = Date.now() - startTime;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
    }

    // Get system metrics
    const [totalBusinesses, totalApplications, pendingAnalysis, activePayments] = await Promise.all([
      Business.countDocuments(),
      Application.countDocuments(),
      Application.countDocuments({ status: { $in: ['PENDING_ANALYSIS', 'ANALYZING'] } }),
      Application.countDocuments({ status: 'ACTIVE' }),
    ]);

    // Determine overall health status
    let overallStatus = 'healthy';
    if (dbStatus === 'disconnected') {
      overallStatus = 'unhealthy';
    } else if (dbResponseTime > 1000) {
      overallStatus = 'degraded';
    }

    const healthData = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
      },
      metrics: {
        totalBusinesses,
        totalApplications,
        pendingAnalysis,
        activePayments,
      },
    };

    res.status(200).json(healthData);
  } catch (error: any) {
    logger.error('System health check error:', error);
    next(error);
  }
};

/**
 * Check PWA API connectivity and webhook status
 * GET /admin/pwa-health
 */
export const getPWAHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get webhook stats
    const [
      receivedLast24h,
      lastReceivedWebhook,
      signatureFailures,
      processingErrors,
      sentLast24h,
      deliverySuccessCount,
      _deliveryFailureCount,
      pendingRetries,
    ] = await Promise.all([
      PWAWebhookLog.countDocuments({ receivedAt: { $gte: oneDayAgo } }),
      PWAWebhookLog.findOne().sort({ receivedAt: -1 }),
      PWAWebhookLog.countDocuments({ receivedAt: { $gte: oneDayAgo }, signatureValid: false }),
      PWAWebhookLog.countDocuments({ receivedAt: { $gte: oneDayAgo }, processedSuccessfully: false }),
      BusinessWebhookLog.countDocuments({ sentAt: { $gte: oneDayAgo } }),
      BusinessWebhookLog.countDocuments({ sentAt: { $gte: oneDayAgo }, status: 'delivered' }),
      BusinessWebhookLog.countDocuments({ sentAt: { $gte: oneDayAgo }, status: 'failed' }),
      BusinessWebhookLog.countDocuments({ status: 'failed', attempts: { $lt: 4 } }),
    ]);

    const deliverySuccessRate = sentLast24h > 0
      ? (deliverySuccessCount / sentLast24h) * 100
      : 0;

    const pwaHealthData = {
      pwaApi: {
        status: 'unknown', // For MVP, we don't test PWA API connectivity
        lastTestAt: new Date(),
      },
      webhooks: {
        received: {
          last24Hours: receivedLast24h,
          lastReceived: lastReceivedWebhook?.receivedAt,
          signatureFailures,
          processingErrors,
        },
        sent: {
          last24Hours: sentLast24h,
          deliverySuccessRate: parseFloat(deliverySuccessRate.toFixed(2)),
          pendingRetries,
        },
      },
    };

    res.status(200).json(
      ResponseFormatter.success(pwaHealthData)
    );
  } catch (error: any) {
    logger.error('PWA health check error:', error);
    next(error);
  }
};

/**
 * View system audit logs with filters
 * GET /admin/audit-logs
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = {
      action: req.query.action as string | undefined,
      actorId: req.query.actorId as string | undefined,
      resourceType: req.query.resourceType as string | undefined,
      resourceId: req.query.resourceId as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    };

    const query: any = {};

    if (filters.action) query.action = filters.action;
    if (filters.actorId) query['actor.id'] = filters.actorId;
    if (filters.resourceType) query.resourceType = filters.resourceType;
    if (filters.resourceId) query.resourceId = filters.resourceId;

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [logs, totalCount] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json(
      ResponseFormatter.successWithPagination(logs, {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / filters.limit),
      })
    );
  } catch (error: any) {
    logger.error('Get audit logs error:', error);
    next(error);
  }
};

/**
 * View all applications across all businesses with filters
 * GET /admin/applications
 */
export const getAllApplications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = {
      businessId: req.query.businessId as string | undefined,
      trustWalletId: req.query.trustWalletId as string | undefined,
      status: req.query.status as string | undefined,
      minTrustScore: req.query.minTrustScore ? parseFloat(req.query.minTrustScore as string) : undefined,
      maxTrustScore: req.query.maxTrustScore ? parseFloat(req.query.maxTrustScore as string) : undefined,
      search: req.query.search as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    };

    const query: any = {};

    if (filters.businessId) query.businessId = filters.businessId;
    if (filters.trustWalletId) query.trustWalletId = filters.trustWalletId;
    if (filters.status) query.status = filters.status;

    if (filters.search) {
      query.$or = [
        { 'customerDetails.firstName': { $regex: filters.search, $options: 'i' } },
        { 'customerDetails.lastName': { $regex: filters.search, $options: 'i' } },
        { 'customerDetails.email': { $regex: filters.search, $options: 'i' } },
        { 'customerDetails.phoneNumber': { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.submittedAt = {};
      if (filters.startDate) query.submittedAt.$gte = filters.startDate;
      if (filters.endDate) query.submittedAt.$lte = filters.endDate;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [applications, totalCount] = await Promise.all([
      Application.find(query)
        .populate('trustEngineOutputId')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean(),
      Application.countDocuments(query),
    ]);

    // Filter by trust score if specified
    let filteredApplications = applications;
    if (filters.minTrustScore !== undefined || filters.maxTrustScore !== undefined) {
      filteredApplications = applications.filter((app: any) => {
        if (!app.trustEngineOutputId) return false;
        const score = app.trustEngineOutputId.trustScore;
        if (filters.minTrustScore !== undefined && score < filters.minTrustScore) return false;
        if (filters.maxTrustScore !== undefined && score > filters.maxTrustScore) return false;
        return true;
      });
    }

    // Calculate status counts
    const statusCounts = await Application.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const summary = {
      totalCount: filteredApplications.length,
      statusCounts: statusCounts.reduce((acc: any, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    res.status(200).json({
      data: filteredApplications,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / filters.limit),
      },
      summary,
    });
  } catch (error: any) {
    logger.error('Get all applications error:', error);
    next(error);
  }
};
