// src/lib/Logger.js
// Logging utilities for RMQ Board
const winston = require('winston');
const path = require('path');

/**
 * Create a configured logger instance
 * @param {Object} options - Logger options
 * @returns {winston.Logger} Configured logger instance
 */
function createLogger(options = {}) {
    const {
        level = process.env.LOG_LEVEL || 'info',
        console = true,
        file = true,
        filename = 'rmq-board.log'
    } = options;

    // Configure transports
    const transports = [];

    // Add console transport if enabled
    if (console) {
        transports.push(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                winston.format.printf(({ level, message, timestamp, ...meta }) => {
                    const metaStr = Object.keys(meta).length
                        ? `\n${JSON.stringify(meta, null, 2)}`
                        : '';
                    return `${timestamp} ${level}: ${message}${metaStr}`;
                })
            )
        }));
    }

    // Add file transport if enabled
    if (file) {
        transports.push(new winston.transports.File({
            filename,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }));
    }

    // Create and return logger
    return winston.createLogger({
        level,
        levels: winston.config.npm.levels,
        transports,
        exitOnError: false
    });
}

/**
 * Create a child logger with a specific context
 * @param {winston.Logger} logger - Parent logger
 * @param {string} moduleName - Module name for context
 * @returns {winston.Logger} Child logger with context
 */
function createChildLogger(logger, moduleName) {
    // If no parent logger, create a new one
    if (!logger) {
        logger = createLogger();
    }

    return logger.child({
        module: moduleName
    });
}

module.exports = {
    createLogger,
    createChildLogger
};