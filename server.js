// server.js
require('dotenv').config();
const RabbitMQAdmin = require('./index');

// Get configuration from environment variables
const config = {
    rabbitMQUrl: process.env.RABBITMQ_URL || 'http://rabbitmq:15672',
    amqpUrl: process.env.RABBITMQ_AMQP_URL || 'amqp://rabbitmq:5672',
    username: process.env.RABBITMQ_USERNAME || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL || '5000', 10),
    basePath: process.env.BASE_PATH || '/',
    port: parseInt(process.env.PORT || '3000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
    retryTimeout: parseInt(process.env.RETRY_TIMEOUT || '3000', 10)
};

console.log('Starting RabbitMQ Admin UI with config:');
console.log({
    rabbitMQUrl: config.rabbitMQUrl,
    amqpUrl: config.amqpUrl,
    username: config.username,
    password: '********', // Don't log the actual password
    refreshInterval: config.refreshInterval,
    basePath: config.basePath,
    port: config.port,
    maxRetries: config.maxRetries,
    retryTimeout: config.retryTimeout
});

// Create the RabbitMQ Admin instance
const rabbitMQAdmin = new RabbitMQAdmin(config);

// Async IIFE to handle startup and graceful shutdown
(async () => {
    try {
        // Create and start the server
        await rabbitMQAdmin.createServer(config.port);

        // Handle termination signals for graceful shutdown
        process.on('SIGINT', handleShutdown);
        process.on('SIGTERM', handleShutdown);

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            handleShutdown();
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        async function handleShutdown() {
            console.log('Received shutdown signal...');

            // Prevent multiple shutdown attempts
            process.removeListener('SIGINT', handleShutdown);
            process.removeListener('SIGTERM', handleShutdown);

            try {
                // Gracefully shutdown the app
                await rabbitMQAdmin.shutdown();
                console.log('Shutdown complete');
                process.exit(0);
            } catch (error) {
                console.error('Error during shutdown:', error);
                process.exit(1);
            }
        }
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
})();