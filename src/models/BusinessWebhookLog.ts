import mongoose, { Schema, Document } from 'mongoose';

export type BusinessWebhookStatus = 'pending' | 'delivered' | 'failed';

export interface IBusinessWebhookLog extends Document {
  logId: string;
  businessId: string;
  event: string;
  payload: any;
  url: string;
  status: BusinessWebhookStatus;
  httpStatus?: number;
  attempts: number;
  sentAt: Date;
  deliveredAt?: Date;
  errorMessage?: string;
}

const BusinessWebhookLogSchema: Schema = new Schema({
  logId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  businessId: {
    type: String,
    required: true,
    index: true,
  },
  event: {
    type: String,
    required: true,
    index: true,
  },
  payload: {
    type: Schema.Types.Mixed,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending',
    index: true,
  },
  httpStatus: {
    type: Number,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  deliveredAt: {
    type: Date,
  },
  errorMessage: {
    type: String,
  },
});

// Indexes
BusinessWebhookLogSchema.index({ logId: 1 }, { unique: true });
BusinessWebhookLogSchema.index({ businessId: 1 });
BusinessWebhookLogSchema.index({ event: 1 });
BusinessWebhookLogSchema.index({ status: 1 });

export default mongoose.model<IBusinessWebhookLog>('BusinessWebhookLog', BusinessWebhookLogSchema);
