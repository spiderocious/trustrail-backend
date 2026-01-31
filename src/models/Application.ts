import mongoose, { Schema, Document } from 'mongoose';

export type ApplicationStatus =
  | 'PENDING_ANALYSIS'
  | 'ANALYZING'
  | 'APPROVED'
  | 'FLAGGED_FOR_REVIEW'
  | 'DECLINED'
  | 'MANDATE_CREATED'
  | 'MANDATE_ACTIVE'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DEFAULTED';

export interface ICustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  accountNumber: string;
  bankCode: string;
  bvn: string; // Encrypted
}

export interface IOpenAIData {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  analysisResponse?: any; // Full OpenAI response for debugging
  analysisCompletedAt?: Date;
}

export interface IApplication extends Document {
  applicationId: string;
  trustWalletId: string;
  businessId: string;
  customerDetails: ICustomerDetails;
  bankStatementCsvData?: Buffer; // DEPRECATED - kept for fallback
  openai?: IOpenAIData; // NEW - OpenAI file tracking
  status: ApplicationStatus;
  trustEngineOutputId?: string;
  pwaMandateRef?: string;
  pwaMandateId?: number;
  virtualAccountNumber?: string;
  downPaymentReceived: boolean;
  downPaymentAmount?: number;
  downPaymentReceivedAt?: Date;
  totalAmount: number;
  downPaymentRequired: number;
  installmentAmount: number;
  installmentCount: number;
  frequency: 'weekly' | 'monthly';
  paymentsCompleted: number;
  totalPaid: number;
  outstandingBalance: number;
  submittedAt: Date;
  analyzedAt?: Date;
  approvedAt?: Date;
  declinedAt?: Date;
  mandateActivatedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerDetailsSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    bankCode: {
      type: String,
      required: true,
    },
    bvn: {
      type: String,
      required: true, // Stored encrypted
    },
  },
  { _id: false }
);

const ApplicationSchema: Schema = new Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    trustWalletId: {
      type: String,
      required: true,
      index: true,
    },
    businessId: {
      type: String,
      required: true,
      index: true,
    },
    customerDetails: {
      type: CustomerDetailsSchema,
      required: true,
    },
    bankStatementCsvData: {
      type: Buffer,
      required: false,
    },
    openai: {
      fileId: { type: String, index: true },
      fileName: String,
      fileSize: Number,
      mimeType: String,
      uploadedAt: Date,
      analysisResponse: Schema.Types.Mixed,
      analysisCompletedAt: Date,
    },
    status: {
      type: String,
      enum: [
        'PENDING_ANALYSIS',
        'ANALYZING',
        'APPROVED',
        'FLAGGED_FOR_REVIEW',
        'DECLINED',
        'MANDATE_CREATED',
        'MANDATE_ACTIVE',
        'ACTIVE',
        'COMPLETED',
        'DEFAULTED',
      ],
      required: true,
      index: true,
    },
    trustEngineOutputId: {
      type: String,
      index: true,
    },
    pwaMandateRef: {
      type: String,
      index: true,
    },
    pwaMandateId: {
      type: Number,
      index: true,
    },
    virtualAccountNumber: {
      type: String,
      index: true,
    },
    downPaymentReceived: {
      type: Boolean,
      default: false,
    },
    downPaymentAmount: {
      type: Number,
    },
    downPaymentReceivedAt: {
      type: Date,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    downPaymentRequired: {
      type: Number,
      required: true,
    },
    installmentAmount: {
      type: Number,
      required: true,
    },
    installmentCount: {
      type: Number,
      required: true,
    },
    frequency: {
      type: String,
      enum: ['weekly', 'monthly'],
      required: true,
    },
    paymentsCompleted: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    outstandingBalance: {
      type: Number,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    analyzedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    declinedAt: {
      type: Date,
    },
    mandateActivatedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ApplicationSchema.index({ applicationId: 1 }, { unique: true });
ApplicationSchema.index({ trustWalletId: 1 });
ApplicationSchema.index({ businessId: 1 });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index({ businessId: 1, status: 1 });
ApplicationSchema.index({ trustEngineOutputId: 1 });
ApplicationSchema.index({ pwaMandateRef: 1 });
ApplicationSchema.index({ pwaMandateId: 1 });
ApplicationSchema.index({ virtualAccountNumber: 1 });
ApplicationSchema.index({ 'customerDetails.phoneNumber': 1 });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
