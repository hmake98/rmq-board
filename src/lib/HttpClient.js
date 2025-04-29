// src/lib/HttpClient.js
// HTTP Client for RabbitMQ Management API
const axios = require('axios');
const EventEmitter = require('events');

/**
 * HttpClient class for RabbitMQ Management API
 * @extends EventEmitter
 */
class HttpClient extends EventEmitter {
    /**
     * Create a new HttpClient
     * @param {Object} config - Configuration options
     * @param {Object} logger - Logger instance
     */
    constructor(config, logger) {
        super();

        this.config = config;
        this.logger = logger;
        this.baseUrl = config.rabbitMQUrl;
        this.username = config.username;
        this.password = config.password;

        // Cache for performance
        this.cache = {
            data: {},
            lastUpdated: {}
        };

        // Set up axios client with default config
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 5000, // 5 second timeout
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
            }
        });

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            response => response,
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
            this.logger.error(`API Error ${error.response.status}: ${error.response.statusText}`, {
                url: error.config.url,
                method: error.config.method,
                data: error.response.data
            });

            // Emit event based on status code
            if (error.response.status === 401) {
                this.emit('unauthorized');
            } else if (error.response.status >= 500) {
                this.emit('server-error', error.response);
            }
        } else if (error.request) {
            // Request was made but no response received
            this.logger.error('API No Response Error:', {
                url: error.config.url,
                method: error.config.method,
                message: error.message
            });

            this.emit('connection-error', error);
        } else {
            // Error in setting up the request
            this.logger.error('API Request Setup Error:', error.message);
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
            await this.client.get('/api/overview', { timeout: 2000 });
            this.emit('connected');
            return true;
        } catch (error) {
            this.emit('connection-error', error);
            return false;
        }
    }
}

module.exports = HttpClient;