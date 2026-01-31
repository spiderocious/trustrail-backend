import mongoose, { Schema, Document } from 'mongoose';

export interface IInstallmentPlan {
  totalAmount: number;
  downPaymentPercentage: number;
  installmentCount: number;
  frequency: 'weekly' | 'monthly';
  interestRate: number;
}

export interface IApprovalWorkflow {
  autoApproveThreshold: number;
  autoDeclineThreshold: number;
  minTrustScore: number;
}

export interface ITrustWallet extends Document {
  trustWalletId: string;
  businessId: string;
  name: string;
  description?: string;
  installmentPlan: IInstallmentPlan;
  approvalWorkflow: IApprovalWorkflow;
  publicUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentPlanSchema = new Schema(
  {
    totalAmount: {
      type: Number,
      required: true,
    },
    downPaymentPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    installmentCount: {
      type: Number,
      required: true,
      min: 1,
    },
    frequency: {
      type: String,
      enum: ['weekly', 'monthly'],
      required: true,
    },
    interestRate: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const ApprovalWorkflowSchema = new Schema(
  {
    autoApproveThreshold: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    autoDeclineThreshold: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    minTrustScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const TrustWalletSchema: Schema = new Schema(
  {
    trustWalletId: {
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
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    installmentPlan: {
      type: InstallmentPlanSchema,
      required: true,
    },
    approvalWorkflow: {
      type: ApprovalWorkflowSchema,
      required: true,
    },
    publicUrl: {
      type: String,
      required: true,
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
TrustWalletSchema.index({ trustWalletId: 1 }, { unique: true });
TrustWalletSchema.index({ businessId: 1 });
TrustWalletSchema.index({ businessId: 1, name: 1 }, { unique: true });

// Validation
TrustWalletSchema.pre('save', function (this: ITrustWallet, next) {
  const workflow = this.approvalWorkflow;
  if (workflow.autoApproveThreshold <= workflow.autoDeclineThreshold) {
    return next(new Error('autoApproveThreshold must be greater than autoDeclineThreshold'));
  }
  if (workflow.minTrustScore > workflow.autoApproveThreshold) {
    return next(new Error('minTrustScore must be less than or equal to autoApproveThreshold'));
  }
  next();
});

export default mongoose.model<ITrustWallet>('TrustWallet', TrustWalletSchema);
