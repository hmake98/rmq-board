// src/utils/config.js
/**
 * Load configuration from environment variables with smart defaults
 * @returns {Object} Configuration object
 */
function loadConfig() {
    // Get the RabbitMQ URL - this is the only required parameter
    const rabbitMqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/';

    // Parse the URL to extract components
    let parsedUrl;
    try {
        parsedUrl = new URL(rabbitMqUrl);
    } catch (error) {
        console.error(`Invalid RABBITMQ_URL format: ${error.message}`);
        // Fallback to default
        parsedUrl = new URL('amqp://guest:guest@localhost:5672/');
    }

    // Extract connection details from URL
    const protocol = parsedUrl.protocol; // 'amqp:' or 'amqps:'
    const hostname = parsedUrl.hostname;
    const port = parsedUrl.port || (protocol === 'amqps:' ? '5671' : '5672');
    const username = parsedUrl.username ? decodeURIComponent(parsedUrl.username) : 'guest';
    const password = parsedUrl.password ? decodeURIComponent(parsedUrl.password) : 'guest';
    const vhost = parsedUrl.pathname.slice(1) || '/'; // Remove leading '/' and default to '/'

    // Determine if SSL is enabled from the protocol
    const sslEnabled = protocol === 'amqps:';

    // Build the management URL
    const mgmtProtocol = sslEnabled ? 'https:' : 'http:';
    const mgmtPort = sslEnabled ? '15671' : '15672';
    const rabbitMQUrl = `${mgmtProtocol}//${hostname}:${mgmtPort}`;

    // Build the AMQP URL (ensuring it's correct)
    const amqpUrl = rabbitMqUrl;

    // Build the final configuration object
    return {
        // Connection URLs with credentials
        amqpUrl: rabbitMqUrl,
        rabbitMQUrl: rabbitMQUrl,

        // Connection details
        protocol,
        hostname,
        port,
        username,
        password,
        vhost,

        // SSL settings
        sslEnabled,
        sslVerify: process.env.SSL_VERIFY !== 'false', // Default to true

        // Server settings
        refreshInterval: parseInt(process.env.REFRESH_INTERVAL || '5000', 10),
        basePath: normalizePath(process.env.BASE_PATH || '/'),
        port: parseInt(process.env.PORT || '3000', 10),

        // Connection resilience settings
        maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
        retryTimeout: parseInt(process.env.RETRY_TIMEOUT || '5000', 10),

        // Other settings
        logLevel: process.env.LOG_LEVEL || 'info'
    };
}

/**
 * Normalize a path for use in URLs
 * @param {string} path - Path to normalize
 * @returns {string} Normalized path
 */
function normalizePath(path) {
    path = path.startsWith('/') ? path : `/${path}`;
    path = path !== '/' && !path.endsWith('/') ? `${path}/` : path;
    return path;
}

module.exports = {
    loadConfig,
    normalizePath,
};