// src/lib/HttpClient.js
const axios = require('axios');
const EventEmitter = require('events');
const https = require('https');

/**
 * HttpClient class for RabbitMQ Management API
 * @extends EventEmitter
 */
class HttpClient extends EventEmitter {
    /**
     * Create a new HttpClient
     * @param {Object} config - Configuration options from loadConfig()
     * @param {Object} logger - Logger instance
     */
    constructor(config, logger) {
        super();

        this.config = config;
        this.logger = logger;

        // Cache for performance
        this.cache = {
            data: {},
            lastUpdated: {}
        };

        // Set up axios client with default config
        this.setupClient();
    }

    /**
     * Set up the HTTP client with proper configuration
     */
    setupClient() {
        // Create client options
        const clientOptions = {
            baseURL: this.config.rabbitMQUrl,
            timeout: this.config.isAwsMq ? 30000 : 10000, // Longer timeout for AWS MQ
            auth: {
                username: this.config.username,
                password: this.config.password
            },
            headers: {
                'Content-Type': 'application/json'
            },
            validateStatus: null // Handle status in interceptor
        };

        // Add HTTPS agent if SSL is enabled
        if (this.config.sslEnabled) {
            const httpsAgent = new https.Agent({
                rejectUnauthorized: this.config.sslVerify,
                // For AWS MQ, disable hostname verification
                checkServerIdentity: this.config.isAwsMq ? () => undefined : undefined
            });
            clientOptions.httpsAgent = httpsAgent;

            if (this.config.isAwsMq) {
                this.logger.debug('AWS MQ detected, adjusted SSL settings for HTTP client');
            }
        }

        // Mask password in URL for logging
        const maskedUrl = this.config.rabbitMQUrl.replace(/(\/\/[^:]+:)([^@]+)(@)/, '$1***$3');
        this.logger.info(`HTTP client initialized for ${maskedUrl}`);

        // Create axios client
        this.client = axios.create(clientOptions);

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            response => {
                // Only consider 2xx responses as successful
                if (response.status >= 200 && response.status < 300) {
                    return response;
                }

                // For AWS MQ, check for specific status codes
                if (this.config.isAwsMq && response.status === 401) {
                    this.logger.warn('Received 401 from AWS MQ, port may be incorrect. Try port 443 instead.');
                }

                // Handle unsuccessful responses
                this.handleApiError({ response });

                // Convert to a rejected promise for unsuccessful responses
                return Promise.reject(new Error(`Status ${response.status}: ${response.statusText}`));
            },
            error => {
                this.handleApiError(error);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Handle API errors
     * @param {Error} error - Error object
     * @private
     */
    handleApiError(error) {
        if (error.response) {
            // Server responded with an error status
            this.logger.error(`API Error ${error.response.status}: ${error.response.statusText}`);

            // Emit event based on status code
            if (error.response.status === 401) {
                this.emit('unauthorized');
            } else if (error.response.status >= 500) {
                this.emit('server-error', error.response);
            }
        } else if (error.request) {
            // Request was made but no response received
            this.logger.error(`API No Response Error: ${error.message}`);
            this.emit('connection-error', error);

            // For connection issues to cloud brokers, provide specific tips
            if (this.config.isAwsMq) {
                this.logger.warn('Connection to AWS MQ failed. Check:');
                this.logger.warn('1. Security group allows access to management port (443)');
                this.logger.warn('2. Try setting SSL_VERIFY=false in your .env file');
            }
        } else {
            // Error in setting up the request
            this.logger.error(`API Request Setup Error: ${error.message}`);
        }
    }

    /**
     * Get data from API with caching
     * @param {string} endpoint - API endpoint
     * @param {string|null} cacheKey - Cache key to use
     * @param {number} cacheTTL - Cache time-to-live in milliseconds
     * @returns {Promise<any>} API response data
     */
    async get(endpoint, cacheKey = null, cacheTTL = 5000) {
        // Check cache if applicable
        if (cacheKey && this.cache.data[cacheKey] && this.cache.lastUpdated[cacheKey]) {
            const cacheAge = Date.now() - this.cache.lastUpdated[cacheKey];
            if (cacheAge < cacheTTL) {
                return this.cache.data[cacheKey];
            }
        }

        try {
            const response = await this.client.get(endpoint);

            // Update cache if applicable
            if (cacheKey) {
                this.cache.data[cacheKey] = response.data;
                this.cache.lastUpdated[cacheKey] = Date.now();
            }

            return response.data;
        } catch (error) {
            // Return cached data if available, even if expired
            if (cacheKey && this.cache.data[cacheKey]) {
                this.logger.info(`Returning cached data for ${cacheKey} due to API error`);
                return this.cache.data[cacheKey];
            }

            throw error;
        }
    }

    /**
     * Post data to API
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Data to post
     * @returns {Promise<any>} API response data
     */
    async post(endpoint, data) {
        try {
            const response = await this.client.post(endpoint, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete resource via API
     * @param {string} endpoint - API endpoint
     * @returns {Promise<any>} API response data
     */
    async delete(endpoint) {
        try {
            const response = await this.client.delete(endpoint);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Put data to API
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Data to put
     * @returns {Promise<any>} API response data
     */
    async put(endpoint, data) {
        try {
            const response = await this.client.put(endpoint, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.data = {};
        this.cache.lastUpdated = {};
    }

    /**
     * Clear specific cache entry
     * @param {string} cacheKey - Cache key to clear
     */
    clearCacheEntry(cacheKey) {
        if (this.cache.data[cacheKey]) {
            delete this.cache.data[cacheKey];
            delete this.cache.lastUpdated[cacheKey];
        }
    }

    /**
     * Check API connection
     * @returns {Promise<boolean>} Connection status
     */
    async checkConnection() {
        try {
            // Try endpoints in order - for AWS MQ we may need to try alternatives
            const endpoints = ['/api/overview'];

            // For AWS MQ, also try root endpoint
            if (this.config.isAwsMq) {
                endpoints.push('/');  // AWS MQ sometimes uses root endpoint
            }

            // Try each endpoint in order until one works
            for (const endpoint of endpoints) {
                try {
                    await this.client.get(endpoint, { timeout: 5000 });
                    this.logger.debug(`Connection successful using endpoint: ${endpoint}`);
                    this.emit('connected');
                    return true;
                } catch (error) {
                    this.logger.debug(`Endpoint ${endpoint} failed, trying next if available`);
                    // Continue to next endpoint
                }
            }

            // If we get here, all endpoints failed
            throw new Error('All API endpoints failed');
        } catch (error) {
            this.emit('connection-error', error);
            return false;
        }
    }
}

module.exports = HttpClient;