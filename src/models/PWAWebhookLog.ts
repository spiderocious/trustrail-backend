import mongoose, { Schema, Document } from 'mongoose';

export type PWAEventType = 'debit' | 'credit' | 'activate_mandate' | 'unknown';

export interface IPWAWebhookLog extends Document {
  logId: string;
  eventType: PWAEventType;
  requestType: string;
  requestRef: string;
  rawPayload: any;
  billerCode?: string;
  transactionRef?: string;
  status?: string;
  signatureValid: boolean;
  processedSuccessfully: boolean;
  errorMessage?: string;
  receivedAt: Date;
  processedAt?: Date;
}

const PWAWebhookLogSchema: Schema = new Schema({
  logId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  eventType: {
    type: String,
    enum: ['debit', 'credit', 'activate_mandate', 'unknown'],
    required: true,
    index: true,
  },
  requestType: {
    type: String,
    required: true,
  },
  requestRef: {
    type: String,
    required: true,
    index: true,
  },
  rawPayload: {
    type: Schema.Types.Mixed,
    required: true,
  },
  billerCode: {
    type: String,
    index: true,
  },
  transactionRef: {
    type: String,
    index: true,
  },
  status: {
    type: String,
  },
  signatureValid: {
    type: Boolean,
    required: true,
  },
  processedSuccessfully: {
    type: Boolean,
    required: true,
  },
  errorMessage: {
    type: String,
  },
  receivedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: {
    type: Date,
  },
});

// Indexes
PWAWebhookLogSchema.index({ logId: 1 }, { unique: true });
PWAWebhookLogSchema.index({ eventType: 1 });
PWAWebhookLogSchema.index({ requestRef: 1 });
PWAWebhookLogSchema.index({ billerCode: 1 });
PWAWebhookLogSchema.index({ transactionRef: 1 });

export default mongoose.model<IPWAWebhookLog>('PWAWebhookLog', PWAWebhookLogSchema);
