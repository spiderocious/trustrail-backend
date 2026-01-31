import createApp from './app';
import { connectDB, disconnectDB } from './config/database';
import { startBackgroundJobs } from './jobs/jobScheduler';
import env from './config/environment';
import logger from './config/logger';

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDB();
    logger.info('MongoDB connected successfully');

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(env.port, () => {
      logger.info(`🚀 TrustRail server running on port ${env.port}`);
      logger.info(`Environment: ${env.nodeEnv}`);
      logger.info(`API Base URL: http://localhost:${env.port}/api`);
      logger.info(`Public URL: http://localhost:${env.port}/public`);
      logger.info(`Admin URL: http://localhost:${env.port}/admin`);
      logger.info(`Health Check: http://localhost:${env.port}/health`);
    });

    // Start background jobs
    startBackgroundJobs();

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Close HTTP server
      server.close(async () => {
        logger.info('HTTP server closed');

        // Disconnect from database
        await disconnectDB();
        logger.info('Database disconnected');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
