// src/lib/Debugger.js
const EventEmitter = require('events');
const { createLogger } = require('./Logger');

/**
 * Advanced debugging utility for RabbitMQ connections and operations
 * @extends EventEmitter
 */
class Debugger extends EventEmitter {
    constructor(options = {}) {
        super();

        this.config = options.config || {};
        this.logger = options.logger || createLogger({ level: 'debug' });
        this.isEnabled = options.enabled !== false;
        this.debugLevel = options.debugLevel || 'detailed';
        
        // Debug data storage
        this.debugData = {
            connections: [],
            operations: [],
            errors: [],
            performance: [],
            amqpTraffic: [],
            httpTraffic: []
        };

        // Performance tracking
        this.performanceMetrics = {
            connectionAttempts: 0,
            successfulConnections: 0,
            failedConnections: 0,
            averageResponseTime: 0,
            totalOperations: 0
        };

        // Connection health tracking
        this.connectionHealth = {
            lastCheck: null,
            consecutiveFailures: 0,
            uptime: 0,
            lastError: null
        };

        // Debug session info
        this.sessionInfo = {
            startTime: new Date(),
            sessionId: this._generateSessionId(),
            version: '1.0.0'
        };

        this.logger.info(`Debugger initialized with session ID: ${this.sessionInfo.sessionId}`);
    }

    /**
     * Generate a unique session ID for debugging
     * @private
     */
    _generateSessionId() {
        return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Log connection attempt with detailed information
     * @param {Object} connectionInfo - Connection details
     */
    logConnectionAttempt(connectionInfo) {
        if (!this.isEnabled) return;

        const debugInfo = {
            timestamp: new Date(),
            type: 'connection_attempt',
            sessionId: this.sessionInfo.sessionId,
            details: {
                url: this.logger.maskUrl(connectionInfo.url),
                protocol: connectionInfo.protocol || 'unknown',
                host: connectionInfo.host,
                port: connectionInfo.port,
                vhost: connectionInfo.vhost,
                sslEnabled: connectionInfo.sslEnabled,
                retryCount: connectionInfo.retryCount || 0
            }
        };

        this.debugData.connections.push(debugInfo);
        this.performanceMetrics.connectionAttempts++;

        this.logger.debug('Connection attempt', debugInfo);
        this.emit('connection_attempt', debugInfo);
    }

    /**
     * Log successful connection
     * @param {Object} connectionInfo - Connection details
     */
    logSuccessfulConnection(connectionInfo) {
        if (!this.isEnabled) return;

        const debugInfo = {
            timestamp: new Date(),
            type: 'connection_success',
            sessionId: this.sessionInfo.sessionId,
            details: {
                url: this.logger.maskUrl(connectionInfo.url),
                protocol: connectionInfo.protocol,
                host: connectionInfo.host,
                port: connectionInfo.port,
                vhost: connectionInfo.vhost,
                connectionTime: connectionInfo.connectionTime,
                channelCreated: connectionInfo.channelCreated
            }
        };

        this.debugData.connections.push(debugInfo);
        this.performanceMetrics.successfulConnections++;
        this.connectionHealth.consecutiveFailures = 0;
        this.connectionHealth.lastCheck = new Date();

        this.logger.info('Connection successful', debugInfo);
        this.emit('connection_success', debugInfo);
    }

    /**
     * Log connection failure with detailed error information
     * @param {Object} errorInfo - Error details
     */
    logConnectionFailure(errorInfo) {
        if (!this.isEnabled) return;

        const debugInfo = {
            timestamp: new Date(),
            type: 'connection_failure',
            sessionId: this.sessionInfo.sessionId,
            error: {
                message: errorInfo.message,
                code: errorInfo.code,
                stack: errorInfo.stack,
                details: errorInfo.details
            },
            context: {
                url: this.logger.maskUrl(errorInfo.url),
                retryCount: errorInfo.retryCount,
                attemptNumber: errorInfo.attemptNumber
            }
        };

        this.debugData.connections.push(debugInfo);
        this.debugData.errors.push(debugInfo);
        this.performanceMetrics.failedConnections++;
        this.connectionHealth.consecutiveFailures++;
        this.connectionHealth.lastError = errorInfo;

        this.logger.error('Connection failed', debugInfo);
        this.emit('connection_failure', debugInfo);
    }

    /**
     * Log AMQP operation with performance metrics
     * @param {Object} operationInfo - Operation details
     */
    logAmqpOperation(operationInfo) {
        if (!this.isEnabled) return;

        const startTime = Date.now();
        const debugInfo = {
            timestamp: new Date(),
            type: 'amqp_operation',
            sessionId: this.sessionInfo.sessionId,
            operation: {
                type: operationInfo.type,
                queue: operationInfo.queue,
                exchange: operationInfo.exchange,
                routingKey: operationInfo.routingKey,
                messageCount: operationInfo.messageCount,
                payload: operationInfo.payload
            },
            performance: {
                startTime,
                duration: null // Will be updated when operation completes
            }
        };

        this.debugData.amqpTraffic.push(debugInfo);
        this.performanceMetrics.totalOperations++;

        this.logger.debug('AMQP operation started', debugInfo);
        this.emit('amqp_operation_start', debugInfo);

        // Return a function to mark operation as complete
        return (result) => {
            const endTime = Date.now();
            const duration = endTime - startTime;

            debugInfo.performance.duration = duration;
            debugInfo.result = result;

            // Update average response time
            this.performanceMetrics.averageResponseTime = 
                (this.performanceMetrics.averageResponseTime + duration) / 2;

            this.logger.debug('AMQP operation completed', debugInfo);
            this.emit('amqp_operation_complete', debugInfo);
        };
    }

    /**
     * Log HTTP operation with detailed request/response information
     * @param {Object} httpInfo - HTTP operation details
     */
    logHttpOperation(httpInfo) {
        if (!this.isEnabled) return;

        const startTime = Date.now();
        const debugInfo = {
            timestamp: new Date(),
            type: 'http_operation',
            sessionId: this.sessionInfo.sessionId,
            request: {
                method: httpInfo.method,
                url: this.logger.maskUrl(httpInfo.url),
                headers: httpInfo.headers,
                body: httpInfo.body
            },
            performance: {
                startTime,
                duration: null
            }
        };

        this.debugData.httpTraffic.push(debugInfo);
        this.performanceMetrics.totalOperations++;

        this.logger.debug('HTTP operation started', debugInfo);
        this.emit('http_operation_start', debugInfo);

        // Return a function to mark operation as complete
        return (response) => {
            const endTime = Date.now();
            const duration = endTime - startTime;

            debugInfo.performance.duration = duration;
            debugInfo.response = {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data
            };

            this.performanceMetrics.averageResponseTime = 
                (this.performanceMetrics.averageResponseTime + duration) / 2;

            this.logger.debug('HTTP operation completed', debugInfo);
            this.emit('http_operation_complete', debugInfo);
        };
    }

    /**
     * Log error with context and stack trace
     * @param {Error} error - Error object
     * @param {Object} context - Additional context
     */
    logError(error, context = {}) {
        if (!this.isEnabled) return;

        const debugInfo = {
            timestamp: new Date(),
            type: 'error',
            sessionId: this.sessionInfo.sessionId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context,
            performance: this.performanceMetrics
        };

        this.debugData.errors.push(debugInfo);
        this.logger.error('Debug error logged', debugInfo);
        this.emit('error_logged', debugInfo);
    }

    /**
     * Get comprehensive debug report
     * @returns {Object} Debug report
     */
    getDebugReport() {
        const uptime = Date.now() - this.sessionInfo.startTime.getTime();
        
        return {
            sessionInfo: this.sessionInfo,
            performanceMetrics: {
                ...this.performanceMetrics,
                uptime,
                successRate: this.performanceMetrics.connectionAttempts > 0 
                    ? (this.performanceMetrics.successfulConnections / this.performanceMetrics.connectionAttempts * 100).toFixed(2)
                    : 0
            },
            connectionHealth: {
                ...this.connectionHealth,
                uptime: uptime
            },
            debugData: {
                connectionsCount: this.debugData.connections.length,
                errorsCount: this.debugData.errors.length,
                amqpOperationsCount: this.debugData.amqpTraffic.length,
                httpOperationsCount: this.debugData.httpTraffic.length
            },
            recentErrors: this.debugData.errors.slice(-10),
            recentConnections: this.debugData.connections.slice(-10)
        };
    }

    /**
     * Get real-time debugging information for API endpoint
     * @returns {Object} Real-time debug info
     */
    getRealTimeDebugInfo() {
        return {
            sessionId: this.sessionInfo.sessionId,
            isEnabled: this.isEnabled,
            debugLevel: this.debugLevel,
            uptime: Date.now() - this.sessionInfo.startTime.getTime(),
            connectionHealth: this.connectionHealth,
            performanceMetrics: this.performanceMetrics,
            recentActivity: {
                lastConnectionAttempt: this.debugData.connections[this.debugData.connections.length - 1],
                lastError: this.debugData.errors[this.debugData.errors.length - 1],
                lastAmqpOperation: this.debugData.amqpTraffic[this.debugData.amqpTraffic.length - 1],
                lastHttpOperation: this.debugData.httpTraffic[this.debugData.httpTraffic.length - 1]
            }
        };
    }

    /**
     * Clear debug data (useful for memory management)
     */
    clearDebugData() {
        this.debugData = {
            connections: [],
            operations: [],
            errors: [],
            performance: [],
            amqpTraffic: [],
            httpTraffic: []
        };
        this.logger.info('Debug data cleared');
    }

    /**
     * Enable or disable debugging
     * @param {boolean} enabled - Whether to enable debugging
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.logger.info(`Debugging ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set debug level
     * @param {string} level - Debug level (basic, detailed, verbose)
     */
    setDebugLevel(level) {
        this.debugLevel = level;
        this.logger.info(`Debug level set to: ${level}`);
    }
}

module.exports = Debugger;