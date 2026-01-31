import mongoose, { Schema, Document } from 'mongoose';

export interface IBusiness extends Document {
  businessId: string;
  businessName: string;
  email: string;
  password: string;
  phoneNumber: string;
  rcNumber: string;
  billerCode?: string;
  pwaMerchantId?: string;
  settlementAccountNumber: string;
  settlementBankCode: string;
  settlementAccountName: string;
  webhookUrl?: string;
  webhookSecret?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema: Schema = new Schema(
  {
    businessId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    rcNumber: {
      type: String,
      required: true,
      unique: true,
    },
    billerCode: {
      type: String,
      index: true,
    },
    pwaMerchantId: {
      type: String,
    },
    settlementAccountNumber: {
      type: String,
      required: true,
    },
    settlementBankCode: {
      type: String,
      required: true,
    },
    settlementAccountName: {
      type: String,
      required: true,
    },
    webhookUrl: {
      type: String,
    },
    webhookSecret: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
BusinessSchema.index({ businessId: 1 }, { unique: true });
BusinessSchema.index({ email: 1 }, { unique: true });
BusinessSchema.index({ billerCode: 1 });

export default mongoose.model<IBusiness>('Business', BusinessSchema);
