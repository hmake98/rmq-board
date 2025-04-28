// server.js
require('dotenv').config();
const RabbitMQAdmin = require('./index');

// Get configuration from environment variables
const config = {
    rabbitMQUrl: process.env.RABBITMQ_URL || 'http://rabbitmq:15672',
    username: process.env.RABBITMQ_USERNAME || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL || '5000', 10),
    basePath: process.env.BASE_PATH || '/',
    port: parseInt(process.env.PORT || '3000', 10)
};

console.log('Starting RabbitMQ Admin UI with config:');
console.log({
    rabbitMQUrl: config.rabbitMQUrl,
    username: config.username,
    password: '********', // Don't log the actual password
    refreshInterval: config.refreshInterval,
    basePath: config.basePath,
    port: config.port
});

// Create and start the server
const rabbitMQAdmin = new RabbitMQAdmin(config);
rabbitMQAdmin.createServer(config.port);

// Handle termination signals
process.on('SIGINT', () => {
    console.log('Shutting down RabbitMQ Admin UI...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down RabbitMQ Admin UI...');
    process.exit(0);
});