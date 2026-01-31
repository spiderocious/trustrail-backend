import mongoose, { Schema, Document } from 'mongoose';

export type PaymentStatus = 'SCHEDULED' | 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export interface IPaymentTransaction extends Document {
  transactionId: string;
  applicationId: string;
  trustWalletId: string;
  businessId: string;
  amount: number;
  status: PaymentStatus;
  paymentNumber: number;
  totalPayments: number;
  scheduledDate: Date;
  paidDate?: Date;
  pwaPaymentId?: string;
  pwaTransactionRef?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema: Schema = new Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    applicationId: {
      type: String,
      required: true,
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
      enum: ['SCHEDULED', 'PENDING', 'SUCCESSFUL', 'FAILED'],
      default: 'SCHEDULED',
      index: true,
    },
    paymentNumber: {
      type: Number,
      required: true,
    },
    totalPayments: {
      type: Number,
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    paidDate: {
      type: Date,
    },
    pwaPaymentId: {
      type: String,
      index: true,
    },
    pwaTransactionRef: {
      type: String,
      index: true,
    },
    failureReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentTransactionSchema.index({ transactionId: 1 }, { unique: true });
PaymentTransactionSchema.index({ applicationId: 1 });
PaymentTransactionSchema.index({ trustWalletId: 1 });
PaymentTransactionSchema.index({ businessId: 1 });
PaymentTransactionSchema.index({ status: 1 });
PaymentTransactionSchema.index({ scheduledDate: 1 });
PaymentTransactionSchema.index({ pwaPaymentId: 1 });
PaymentTransactionSchema.index({ pwaTransactionRef: 1 });
PaymentTransactionSchema.index({ applicationId: 1, paymentNumber: 1 }, { unique: true });

export default mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);
