import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
import { loggingMiddleware } from './middleware/loggingMiddleware';
import { errorMiddleware } from './middleware/errorMiddleware';
import logger from './config/logger';

/**
 * Create and configure Express application
 */
const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS middleware
  app.use(cors({
    origin: '*', // For MVP, allow all origins. In production, specify allowed origins
    credentials: true,
  }));

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging middleware (should be early in the chain)
  app.use(loggingMiddleware);

  // API routes
  app.use(routes);

  // 404 handler for undefined routes
  app.use((req, res) => {
    res.status(404).json({
      error: 'Route not found',
      path: req.path,
      method: req.method,
    });
  });

  // Global error handler (must be last)
  app.use(errorMiddleware);

  logger.info('Express app configured successfully');

  return app;
};

export default createApp;
