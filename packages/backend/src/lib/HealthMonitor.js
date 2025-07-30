// src/lib/HealthMonitor.js
const EventEmitter = require('events');
const { createLogger } = require('./Logger');

/**
 * Comprehensive health monitoring system for RabbitMQ connections
 * @extends EventEmitter
 */
class HealthMonitor extends EventEmitter {
    constructor(options = {}) {
        super();

        this.config = options.config || {};
        this.logger = options.logger || createLogger({ level: 'info' });
        this.debugger = options.debugger;
        
        // Health check intervals
        this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
        this.performanceCheckInterval = options.performanceCheckInterval || 60000; // 1 minute
        
        // Health state
        this.healthState = {
            status: 'unknown',
            lastCheck: null,
            uptime: 0,
            checks: {
                http: { status: 'unknown', lastCheck: null, responseTime: 0 },
                amqp: { status: 'unknown', lastCheck: null, responseTime: 0 },
                overall: { status: 'unknown', lastCheck: null }
            },
            metrics: {
                totalChecks: 0,
                successfulChecks: 0,
                failedChecks: 0,
                averageResponseTime: 0,
                consecutiveFailures: 0
            },
            alerts: []
        };

        // Performance tracking
        this.performanceMetrics = {
            connectionLatency: [],
            operationLatency: [],
            errorRates: [],
            throughput: []
        };

        // Alert thresholds
        this.alertThresholds = {
            responseTime: options.responseTimeThreshold || 5000, // 5 seconds
            errorRate: options.errorRateThreshold || 0.1, // 10%
            consecutiveFailures: options.consecutiveFailureThreshold || 3,
            memoryUsage: options.memoryUsageThreshold || 0.8 // 80%
        };

        // Monitoring intervals
        this.healthCheckTimer = null;
        this.performanceCheckTimer = null;
        this.startTime = new Date();

        this.logger.info('Health monitor initialized');
    }

    /**
     * Start health monitoring
     */
    start() {
        this.logger.info('Starting health monitoring');
        
        // Start health checks
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckInterval);

        // Start performance monitoring
        this.performanceCheckTimer = setInterval(() => {
            this.performPerformanceCheck();
        }, this.performanceCheckInterval);

        this.emit('monitoring_started');
    }

    /**
     * Stop health monitoring
     */
    stop() {
        this.logger.info('Stopping health monitoring');
        
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        if (this.performanceCheckTimer) {
            clearInterval(this.performanceCheckTimer);
            this.performanceCheckTimer = null;
        }

        this.emit('monitoring_stopped');
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const checkStartTime = Date.now();
        const checkResults = {
            timestamp: new Date(),
            http: { status: 'unknown', responseTime: 0, error: null },
            amqp: { status: 'unknown', responseTime: 0, error: null },
            overall: { status: 'unknown', responseTime: 0 }
        };

        try {
            // Check HTTP connection
            if (this.config.httpClient) {
                checkResults.http = await this._checkHttpConnection();
            }

            // Check AMQP connection
            if (this.config.amqpClient) {
                checkResults.amqp = await this._checkAmqpConnection();
            }

            // Determine overall health
            checkResults.overall = this._determineOverallHealth(checkResults);

            // Update health state
            this._updateHealthState(checkResults);

            // Log results
            this.logger.debug('Health check completed', checkResults);

            // Emit health check event
            this.emit('health_check', checkResults);

            // Check for alerts
            this._checkForAlerts(checkResults);

        } catch (error) {
            this.logger.error('Health check failed', error);
            this.emit('health_check_error', error);
        }
    }

    /**
     * Check HTTP connection health
     * @private
     */
    async _checkHttpConnection() {
        const startTime = Date.now();
        
        try {
            const response = await this.config.httpClient.get('/api/overview', {
                timeout: 5000
            });

            const responseTime = Date.now() - startTime;
            
            return {
                status: 'healthy',
                responseTime,
                error: null
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                status: 'unhealthy',
                responseTime,
                error: error.message
            };
        }
    }

    /**
     * Check AMQP connection health
     * @private
     */
    async _checkAmqpConnection() {
        const startTime = Date.now();
        
        try {
            if (!this.config.amqpClient || !this.config.amqpClient.isChannelAvailable()) {
                return {
                    status: 'unhealthy',
                    responseTime: Date.now() - startTime,
                    error: 'AMQP channel not available'
                };
            }

            // Perform a simple operation to test the connection
            const testQueue = `health_check_${Date.now()}`;
            await this.config.amqpClient.channel.assertQueue(testQueue, { autoDelete: true });
            await this.config.amqpClient.channel.deleteQueue(testQueue);

            const responseTime = Date.now() - startTime;
            
            return {
                status: 'healthy',
                responseTime,
                error: null
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                status: 'unhealthy',
                responseTime,
                error: error.message
            };
        }
    }

    /**
     * Determine overall health status
     * @private
     */
    _determineOverallHealth(checkResults) {
        const httpHealthy = checkResults.http.status === 'healthy';
        const amqpHealthy = checkResults.amqp.status === 'healthy';
        
        let overallStatus = 'unknown';
        let responseTime = 0;

        if (httpHealthy && amqpHealthy) {
            overallStatus = 'healthy';
        } else if (httpHealthy || amqpHealthy) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'unhealthy';
        }

        responseTime = Math.max(checkResults.http.responseTime, checkResults.amqp.responseTime);

        return {
            status: overallStatus,
            responseTime,
            details: {
                http: httpHealthy,
                amqp: amqpHealthy
            }
        };
    }

    /**
     * Update health state with check results
     * @private
     */
    _updateHealthState(checkResults) {
        this.healthState.lastCheck = new Date();
        this.healthState.uptime = Date.now() - this.startTime.getTime();
        this.healthState.metrics.totalChecks++;

        // Update individual check states
        this.healthState.checks.http = {
            status: checkResults.http.status,
            lastCheck: new Date(),
            responseTime: checkResults.http.responseTime
        };

        this.healthState.checks.amqp = {
            status: checkResults.amqp.status,
            lastCheck: new Date(),
            responseTime: checkResults.amqp.responseTime
        };

        this.healthState.checks.overall = {
            status: checkResults.overall.status,
            lastCheck: new Date()
        };

        // Update metrics
        if (checkResults.overall.status === 'healthy') {
            this.healthState.metrics.successfulChecks++;
            this.healthState.metrics.consecutiveFailures = 0;
        } else {
            this.healthState.metrics.failedChecks++;
            this.healthState.metrics.consecutiveFailures++;
        }

        // Update average response time
        const totalResponseTime = checkResults.http.responseTime + checkResults.amqp.responseTime;
        this.healthState.metrics.averageResponseTime = 
            (this.healthState.metrics.averageResponseTime + totalResponseTime) / 2;

        // Update overall status
        this.healthState.status = checkResults.overall.status;
    }

    /**
     * Check for alerts based on thresholds
     * @private
     */
    _checkForAlerts(checkResults) {
        const alerts = [];

        // Check response time
        if (checkResults.overall.responseTime > this.alertThresholds.responseTime) {
            alerts.push({
                type: 'high_response_time',
                severity: 'warning',
                message: `Response time (${checkResults.overall.responseTime}ms) exceeds threshold (${this.alertThresholds.responseTime}ms)`,
                timestamp: new Date()
            });
        }

        // Check consecutive failures
        if (this.healthState.metrics.consecutiveFailures >= this.alertThresholds.consecutiveFailures) {
            alerts.push({
                type: 'consecutive_failures',
                severity: 'critical',
                message: `${this.healthState.metrics.consecutiveFailures} consecutive health check failures`,
                timestamp: new Date()
            });
        }

        // Check error rate
        const errorRate = this.healthState.metrics.totalChecks > 0 
            ? this.healthState.metrics.failedChecks / this.healthState.metrics.totalChecks 
            : 0;

        if (errorRate > this.alertThresholds.errorRate) {
            alerts.push({
                type: 'high_error_rate',
                severity: 'warning',
                message: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.alertThresholds.errorRate * 100).toFixed(2)}%)`,
                timestamp: new Date()
            });
        }

        // Add new alerts
        this.healthState.alerts.push(...alerts);

        // Keep only recent alerts (last 50)
        if (this.healthState.alerts.length > 50) {
            this.healthState.alerts = this.healthState.alerts.slice(-50);
        }

        // Emit alerts
        alerts.forEach(alert => {
            this.emit('alert', alert);
            this.logger.warn(`Health alert: ${alert.message}`);
        });
    }

    /**
     * Perform performance check
     */
    async performPerformanceCheck() {
        try {
            const performanceData = {
                timestamp: new Date(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                uptime: process.uptime(),
                healthMetrics: this.healthState.metrics
            };

            // Store performance data
            this.performanceMetrics.connectionLatency.push({
                timestamp: new Date(),
                value: this.healthState.metrics.averageResponseTime
            });

            // Keep only recent data (last 100 entries)
            if (this.performanceMetrics.connectionLatency.length > 100) {
                this.performanceMetrics.connectionLatency = 
                    this.performanceMetrics.connectionLatency.slice(-100);
            }

            this.emit('performance_check', performanceData);
            this.logger.debug('Performance check completed', performanceData);

        } catch (error) {
            this.logger.error('Performance check failed', error);
        }
    }

    /**
     * Get comprehensive health report
     * @returns {Object} Health report
     */
    getHealthReport() {
        return {
            status: this.healthState.status,
            uptime: this.healthState.uptime,
            lastCheck: this.healthState.lastCheck,
            checks: this.healthState.checks,
            metrics: this.healthState.metrics,
            alerts: this.healthState.alerts.slice(-10), // Last 10 alerts
            performance: {
                connectionLatency: this.performanceMetrics.connectionLatency.slice(-20),
                averageLatency: this.healthState.metrics.averageResponseTime
            },
            thresholds: this.alertThresholds
        };
    }

    /**
     * Get real-time health status
     * @returns {Object} Real-time health status
     */
    getRealTimeStatus() {
        return {
            status: this.healthState.status,
            uptime: this.healthState.uptime,
            lastCheck: this.healthState.lastCheck,
            checks: this.healthState.checks,
            recentAlerts: this.healthState.alerts.slice(-5)
        };
    }

    /**
     * Update alert thresholds
     * @param {Object} thresholds - New threshold values
     */
    updateAlertThresholds(thresholds) {
        this.alertThresholds = { ...this.alertThresholds, ...thresholds };
        this.logger.info('Alert thresholds updated', this.alertThresholds);
    }

    /**
     * Clear alerts
     */
    clearAlerts() {
        this.healthState.alerts = [];
        this.logger.info('Alerts cleared');
    }

    /**
     * Get alert statistics
     * @returns {Object} Alert statistics
     */
    getAlertStatistics() {
        const alerts = this.healthState.alerts;
        const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
        const warningAlerts = alerts.filter(a => a.severity === 'warning').length;

        return {
            total: alerts.length,
            critical: criticalAlerts,
            warning: warningAlerts,
            recentAlerts: alerts.slice(-10)
        };
    }
}

module.exports = HealthMonitor;