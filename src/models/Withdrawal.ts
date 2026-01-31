import mongoose, { Schema, Document } from 'mongoose';

export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IWithdrawal extends Document {
  withdrawalId: string;
  trustWalletId: string;
  businessId: string;
  amount: number;
  status: WithdrawalStatus;
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalSchema: Schema = new Schema(
  {
    withdrawalId: {
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
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
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
WithdrawalSchema.index({ withdrawalId: 1 }, { unique: true });
WithdrawalSchema.index({ trustWalletId: 1 });
WithdrawalSchema.index({ businessId: 1 });

export default mongoose.model<IWithdrawal>('Withdrawal', WithdrawalSchema);
