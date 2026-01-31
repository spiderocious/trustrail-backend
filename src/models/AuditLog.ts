import mongoose, { Schema, Document } from 'mongoose';

export type ActorType = 'business' | 'admin' | 'system';

export interface IActor {
  type: ActorType;
  id?: string;
  email?: string;
}

export interface IAuditLog extends Document {
  logId: string;
  action: string;
  actor: IActor;
  resourceType: string;
  resourceId: string;
  changes?: any;
  metadata?: any;
  timestamp: Date;
}

const ActorSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['business', 'admin', 'system'],
      required: true,
    },
    id: {
      type: String,
    },
    email: {
      type: String,
    },
  },
  { _id: false }
);

const AuditLogSchema: Schema = new Schema({
  logId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  actor: {
    type: ActorSchema,
    required: true,
  },
  resourceType: {
    type: String,
    required: true,
    index: true,
  },
  resourceId: {
    type: String,
    required: true,
    index: true,
  },
  changes: {
    type: Schema.Types.Mixed,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Indexes
AuditLogSchema.index({ logId: 1 }, { unique: true });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ resourceType: 1 });
AuditLogSchema.index({ resourceId: 1 });
AuditLogSchema.index({ timestamp: 1 });
AuditLogSchema.index({ 'actor.id': 1, timestamp: 1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
