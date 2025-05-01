// src/lib/Logger.js
const winston = require('winston');

/**
 * Create a configured logger instance
 * @param {Object} options - Logger options
 * @returns {winston.Logger} Configured logger instance
 */
function createLogger(options = {}) {
    const {
        level = process.env.LOG_LEVEL || 'info',
        console = true,
        file = false,
        filename = 'rabbitmq-board.log',
        dedupeInterval = 1000, // 1 second deduplication window
        silent = false
    } = options;

    // Configure transports
    const transports = [];

    // Custom format that includes message deduplication
    const messageCache = new Map();

    // Create a format that handles deduplication
    const dedupeFormat = winston.format((info) => {
        // Create a cache key from level and message
        const cacheKey = `${info.level}:${info.message}`;
        const now = Date.now();

        // Check if we've seen this message recently
        if (messageCache.has(cacheKey)) {
            const lastSeen = messageCache.get(cacheKey);
            if (now - lastSeen < dedupeInterval) {
                // Skip duplicates within the deduplication window
                return false;
            }
        }

        // Update the cache with the current timestamp
        messageCache.set(cacheKey, now);

        // Clean old entries from the cache periodically
        if (messageCache.size > 1000) {
            // Clear entries older than dedupeInterval
            for (const [key, timestamp] of messageCache.entries()) {
                if (now - timestamp > dedupeInterval) {
                    messageCache.delete(key);
                }
            }
        }

        return info;
    });

    // Format for console output
    const consoleFormat = winston.format.combine(
        dedupeFormat(),
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            // Nicer meta formatting
            let metaStr = '';

            // Handle module metadata specially
            if (Object.keys(meta).length > 0) {
                if (meta.module) {
                    metaStr += ` [${meta.module}]`;
                    delete meta.module;
                }

                // Format the remaining metadata if any exists
                if (Object.keys(meta).length > 0) {
                    try {
                        metaStr += ' ' + JSON.stringify(meta, null, 1)
                            .replace(/\n\s*/g, ' ')  // Remove newlines for cleaner output
                            .replace(/,\s+/g, ', '); // Clean up spacing
                    } catch (e) {
                        metaStr += ' [Error formatting metadata]';
                    }
                }
            }

            return `${timestamp} ${level}: ${message}${metaStr}`;
        })
    );

    // Add console transport if enabled
    if (console) {
        transports.push(new winston.transports.Console({
            format: consoleFormat
        }));
    }

    // Add file transport if enabled
    if (file) {
        transports.push(new winston.transports.File({
            filename,
            format: winston.format.combine(
                dedupeFormat(),
                winston.format.timestamp(),
                winston.format.json()
            )
        }));
    }

    // Create the logger
    const logger = winston.createLogger({
        level,
        levels: winston.config.npm.levels,
        transports,
        silent,
        exitOnError: false
    });

    // Add a masking helper to the logger
    logger.maskUrl = (url) => {
        if (!url) return 'undefined-url';
        return url.replace(/(\/\/[^:]+:)([^@]+)(@)/, '$1***$3');
    };

    // Add a method to create child loggers
    logger.child = (meta) => {
        return createChildLogger(logger, meta);
    };

    return logger;
}

/**
 * Create a child logger with a specific context
 * @param {winston.Logger} logger - Parent logger
 * @param {string|Object} meta - Module name or metadata object
 * @returns {winston.Logger} Child logger with context
 */
function createChildLogger(logger, meta) {
    // If no parent logger, create a new one
    if (!logger) {
        logger = createLogger();
    }

    // Convert string module name to object
    if (typeof meta === 'string') {
        meta = { module: meta };
    }

    // Create child logger with merged metadata
    const childLogger = logger.child(meta);

    // Make sure maskUrl is available on child loggers
    childLogger.maskUrl = logger.maskUrl;

    return childLogger;
}

module.exports = {
    createLogger,
    createChildLogger
};