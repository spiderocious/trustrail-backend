import { Express } from 'express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      businessId?: string;
      businessEmail?: string;
      isAdmin?: boolean;
    }
  }
}

export {};
