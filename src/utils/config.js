// src/utils/config.js
// Configuration utilities for RMQ Board

/**
 * Load configuration from environment variables with defaults
 * @returns {Object} Configuration object
 */
function loadConfig() {
    return {
        rabbitMQUrl: process.env.RABBITMQ_URL || 'http://localhost:15672',
        amqpUrl: process.env.RABBITMQ_AMQP_URL || 'amqp://localhost:5672',
        username: process.env.RABBITMQ_USERNAME || 'guest',
        password: process.env.RABBITMQ_PASSWORD || 'guest',
        refreshInterval: parseInt(process.env.REFRESH_INTERVAL || '5000', 10),
        basePath: normalizePath(process.env.BASE_PATH || '/'),
        port: parseInt(process.env.PORT || '3000', 10),
        maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
        retryTimeout: parseInt(process.env.RETRY_TIMEOUT || '3000', 10),
        logLevel: process.env.LOG_LEVEL || 'info'
    };
}

/**
 * Normalize a path to ensure it starts and ends with a slash if not root
 * @param {string} path - Path to normalize
 * @returns {string} Normalized path
 */
function normalizePath(path) {
    // Ensure path starts with a slash
    path = path.startsWith('/') ? path : `/${path}`;

    // Ensure path ends with a slash unless it's the root path '/'
    if (path !== '/' && !path.endsWith('/')) {
        path = `${path}/`;
    }

    return path;
}

/**
 * Build AMQP connection string with credentials
 * @param {Object} config - Configuration object
 * @returns {string} AMQP connection string
 */
function buildAmqpConnectionString(config) {
    const username = config.username;
    const password = config.password;

    // Parse the AMQP URL or construct it with credentials
    let amqpUrl = config.amqpUrl;

    if (!amqpUrl.includes('@')) {
        try {
            const urlObj = new URL(amqpUrl);
            urlObj.username = encodeURIComponent(username);
            urlObj.password = encodeURIComponent(password);
            amqpUrl = urlObj.toString();
        } catch (error) {
            throw new Error(`Invalid AMQP URL: ${error.message}`);
        }
    }

    return amqpUrl;
}

module.exports = {
    loadConfig,
    normalizePath,
    buildAmqpConnectionString
};