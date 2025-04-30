// server.js - Ultra-simplified version using a single RABBITMQ_URL
require('dotenv').config();
const RabbitMQAdmin = require('./src/lib/RabbitMQAdmin');
const { createLogger } = require('./src/lib/Logger');

// Initialize logger
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    console: true
});

// Track server state
let rabbitMQAdmin = null;

// Main function to start the server
async function startServer() {
    try {
        logger.info('Starting RabbitMQ Dashboard...');

        // Mask password in URL for logging
        const maskedUrl = process.env.RABBITMQ_URL ?
            process.env.RABBITMQ_URL.replace(/(\/\/[^:]+:)([^@]+)(@)/, '$1***$3') :
            'No URL provided';

        logger.info(`RabbitMQ URL: ${maskedUrl}`);

        // Create RabbitMQ Admin instance
        rabbitMQAdmin = new RabbitMQAdmin({
            logger: logger
        });

        // Start the server
        const { server } = await rabbitMQAdmin.createServer(process.env.PORT);

        // Return the server instance
        return server;
    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}

// Handle shutdown gracefully
function handleShutdown() {
    logger.info('Shutting down...');

    if (rabbitMQAdmin) {
        rabbitMQAdmin.shutdown()
            .then(() => {
                logger.info('Shutdown complete');
                process.exit(0);
            })
            .catch(err => {
                logger.error(`Error during shutdown: ${err.message}`);
                process.exit(1);
            });
    } else {
        process.exit(0);
    }
}

// Register signal handlers
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    handleShutdown();
});

// Start the server
startServer().catch(err => {
    logger.error(`Startup error: ${err.message}`);
    process.exit(1);
});