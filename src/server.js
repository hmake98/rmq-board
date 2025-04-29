// src/server.js
require('dotenv').config();
const RabbitMQAdmin = require('./lib/RabbitMQAdmin');
const { createLogger } = require('./lib/Logger');
const { loadConfig } = require('./utils/config');

// Initialize logger
const logger = createLogger();

// Get configuration from environment variables
const config = loadConfig();

// Log startup configuration (without sensitive data)
logger.info('Starting RabbitMQ Board with configuration:', {
    rabbitMQUrl: config.rabbitMQUrl,
    amqpUrl: config.amqpUrl,
    username: config.username,
    refreshInterval: config.refreshInterval,
    basePath: config.basePath,
    port: config.port,
    maxRetries: config.maxRetries,
    retryTimeout: config.retryTimeout
});

// Track server state
let isShuttingDown = false;
let rabbitMQAdmin = null;

// Async IIFE to handle startup
(async () => {
    try {
        // Create the RabbitMQ Admin instance
        rabbitMQAdmin = new RabbitMQAdmin(config);

        // Create and start the server
        const { server } = await rabbitMQAdmin.createServer(config.port);

        logger.info(`RabbitMQ Board running at http://localhost:${config.port}${config.basePath}`);

        // Handle termination signals for graceful shutdown
        process.on('SIGINT', handleShutdown);
        process.on('SIGTERM', handleShutdown);

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            handleShutdown();
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection:', reason);
            // Don't exit immediately for unhandled rejections
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
})();

/**
 * Handle graceful shutdown
 */
async function handleShutdown() {
    if (isShuttingDown) {
        logger.info('Shutdown already in progress...');
        return;
    }

    isShuttingDown = true;
    logger.info('Received shutdown signal, initiating graceful shutdown...');

    // Prevent multiple shutdown attempts
    process.removeListener('SIGINT', handleShutdown);
    process.removeListener('SIGTERM', handleShutdown);

    try {
        // Set a timeout to force exit if graceful shutdown takes too long
        const forceExitTimeout = setTimeout(() => {
            logger.error('Forced exit due to shutdown timeout');
            process.exit(1);
        }, 10000); // Force exit after 10 seconds

        // Gracefully shutdown the app
        if (rabbitMQAdmin) {
            await rabbitMQAdmin.shutdown();
        }

        clearTimeout(forceExitTimeout);
        logger.info('Shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}