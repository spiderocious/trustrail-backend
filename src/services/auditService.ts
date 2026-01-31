import AuditLog, { ActorType } from '../models/AuditLog';
import { generateAuditLogId } from '../utils/idGenerator';
import logger from '../config/logger';

export interface AuditActor {
  type: ActorType;
  id?: string;
  email?: string;
}

/**
 * Create audit log entry
 */
export const log = async (
  action: string,
  actor: AuditActor,
  resourceType: string,
  resourceId: string,
  changes?: any,
  metadata?: any
): Promise<void> => {
  try {
    const logId = generateAuditLogId();

    await AuditLog.create({
      logId,
      action,
      actor,
      resourceType,
      resourceId,
      changes,
      metadata,
      timestamp: new Date(),
    });

    logger.debug(`Audit log created: ${action} on ${resourceType}:${resourceId}`);
  } catch (error) {
    logger.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main flow
  }
};

/**
 * Log business action
 */
export const logBusinessAction = async (
  action: string,
  businessId: string,
  businessEmail: string,
  resourceType: string,
  resourceId: string,
  changes?: any,
  metadata?: any
): Promise<void> => {
  return log(
    action,
    { type: 'business', id: businessId, email: businessEmail },
    resourceType,
    resourceId,
    changes,
    metadata
  );
};

/**
 * Log system action
 */
export const logSystemAction = async (
  action: string,
  resourceType: string,
  resourceId: string,
  changes?: any,
  metadata?: any
): Promise<void> => {
  return log(
    action,
    { type: 'system' },
    resourceType,
    resourceId,
    changes,
    metadata
  );
};

/**
 * Log admin action
 */
export const logAdminAction = async (
  action: string,
  adminEmail: string,
  resourceType: string,
  resourceId: string,
  changes?: any,
  metadata?: any
): Promise<void> => {
  return log(
    action,
    { type: 'admin', email: adminEmail },
    resourceType,
    resourceId,
    changes,
    metadata
  );
};

/**
 * Get audit logs with filters
 */
export const getAuditLogs = async (filters: {
  action?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}): Promise<{
  logs: any[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}> => {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const query: any = {};

  if (filters.action) {
    query.action = filters.action;
  }
  if (filters.actorId) {
    query['actor.id'] = filters.actorId;
  }
  if (filters.resourceType) {
    query.resourceType = filters.resourceType;
  }
  if (filters.resourceId) {
    query.resourceId = filters.resourceId;
  }
  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) {
      query.timestamp.$gte = filters.startDate;
    }
    if (filters.endDate) {
      query.timestamp.$lte = filters.endDate;
    }
  }

  const [logs, totalCount] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export default {
  log,
  logBusinessAction,
  logSystemAction,
  logAdminAction,
  getAuditLogs,
};
