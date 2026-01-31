import { Router } from 'express';
import multer from 'multer';
import { getTrustWallet, submitApplication, checkApplicationStatus } from '../controllers/publicController';
import { createApplicationValidation } from '../validators/applicationValidators';
import { validationMiddleware } from '../middleware/validationMiddleware';

const router = Router();

// Configure multer for in-memory file storage (not saving to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Accept both PDF and CSV files
    const allowedMimeTypes = ['text/csv', 'application/pdf'];
    const allowedExtensions = ['.csv', '.pdf'];

    const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext =>
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (hasValidMimeType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and CSV files are allowed'));
    }
  },
});

/**
 * GET /public/trustwallet/:trustWalletId - Get TrustWallet information
 */
router.get('/trustwallet/:trustWalletId', getTrustWallet);

/**
 * POST /public/trustwallet/:trustWalletId/apply - Customer submits application
 * Accepts multipart/form-data with PDF or CSV file
 */
router.post(
  '/trustwallet/:trustWalletId/apply',
  upload.single('bankStatement'),
  createApplicationValidation,
  validationMiddleware,
  submitApplication
);

/**
 * GET /public/application/:applicationId/status - Check application status
 */
router.get('/application/:applicationId/status', checkApplicationStatus);

export default router;
