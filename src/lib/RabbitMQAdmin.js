// src/lib/RabbitMQAdmin.js
// Ultra-simplified implementation using a single RABBITMQ_URL
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const exphbs = require('express-handlebars');
const amqp = require('amqplib');
const axios = require('axios');
const { loadConfig } = require('../utils/config');

/**
 * RabbitMQ Admin UI for monitoring and managing RabbitMQ servers
 * Simplified to work with a single RABBITMQ_URL environment variable
 */
class RabbitMQAdmin {
    /**
     * Create a new RabbitMQAdmin instance
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Load config from environment and merge with options
        const config = loadConfig();
        this.config = { ...config, ...options };

        // Set up logger
        this.logger = options.logger || console;

        // Initialize state
        this.app = null;
        this.server = null;
        this.io = null;
        this.router = express.Router();
        this.httpClient = null;
        this.amqpConnection = null;
        this.amqpChannel = null;
        this.connectedClients = new Set();
        this.updateIntervals = new Map();

        // Connection states
        this.httpConnected = false;
        this.amqpConnected = false;
        this.useHttpOnly = this.config.skipAmqpConnection || false;

        // Cache for API calls
        this.cache = {
            overview: null,
            queues: null,
            exchanges: null,
            bindings: null,
            lastUpdated: {}
        };

        // Set up routes
        this.setupRoutes();
    }

    /**
     * Initialize API clients
     */
    async initialize() {
        // Initialize HTTP client first
        try {
            await this._initializeHttpClient();
        } catch (error) {
            this.logger.error(`Failed to connect to RabbitMQ API: ${error.message}`);
            throw new Error('Cannot connect to RabbitMQ Management API');
        }

        // Skip AMQP if configured to do so
        if (this.config.skipAmqpConnection) {
            this.logger.info('AMQP connection disabled by configuration');
            this.useHttpOnly = true;
            return;
        }

        // Try to initialize AMQP client, but don't fail if unsuccessful
        try {
            await this._initializeAmqpClient();
        } catch (error) {
            this.logger.warn(`AMQP connection failed: ${error.message}. Using HTTP-only mode.`);
            this.useHttpOnly = true;
        }
    }

    /**
     * Initialize HTTP client
     * @private
     */
    async _initializeHttpClient() {
        // Create axios client with proper options
        const clientOptions = {
            baseURL: this.config.rabbitMQUrl,
            auth: {
                username: this.config.username,
                password: this.config.password
            },
            timeout: this.config.isAwsMq ? 30000 : 10000 // Longer timeout for AWS MQ
        };

        this.httpClient = axios.create(clientOptions);

        // Test connection to the API
        try {
            // Try standard endpoint
            try {
                await this.httpClient.get('/api/overview');
            } catch (error) {
                // For AWS MQ, try root endpoint if standard fails
                if (this.config.isAwsMq) {
                    this.logger.info('Trying alternative endpoint for AWS MQ');
                    await this.httpClient.get('/');
                } else {
                    throw error;
                }
            }

            this.httpConnected = true;
            this.logger.info('Connected to RabbitMQ Management API');
            return true;
        } catch (error) {
            this.httpConnected = false;
            throw error;
        }
    }

    /**
     * Initialize AMQP client
     * @private
     */
    async _initializeAmqpClient() {
        // Mask password in URL for logging
        const maskedUrl = this.config.amqpUrl.replace(/(\/\/[^:]+:)([^@]+)(@)/, '$1***$3');
        this.logger.info(`Connecting to RabbitMQ via AMQP: ${maskedUrl}`);

        // CloudAMQP fix: Make sure we're using the right vhost 
        // (CloudAMQP often uses the username as the vhost)
        let amqpOptions = {};

        // For CloudAMQP, the vhost is often the same as the username
        if (this.config.isCloudAMQP) {
            // Create a deep copy of the URL to avoid modifying the original
            const amqpUrl = new URL(this.config.amqpUrl);

            // Set the vhost to the username if not explicitly specified
            if (amqpUrl.pathname === '/' || amqpUrl.pathname === '') {
                amqpUrl.pathname = `/${amqpUrl.username}`;
                this.logger.info(`CloudAMQP detected, setting vhost to username: ${amqpUrl.pathname}`);
            }

            try {
                // Connect using the modified AMQP URL for CloudAMQP
                this.amqpConnection = await amqp.connect(amqpUrl.toString(), amqpOptions);
            } catch (error) {
                // Log the error with details but without credentials
                this.logger.error(`AMQP connection error to CloudAMQP: ${error.message}`);
                throw error;
            }
        } else {
            try {
                // Connect using the direct AMQP URL from config for non-CloudAMQP
                this.amqpConnection = await amqp.connect(this.config.amqpUrl, amqpOptions);
            } catch (error) {
                this.logger.error(`AMQP connection error: ${error.message}`);
                throw error;
            }
        }

        try {
            this.amqpChannel = await this.amqpConnection.createChannel();

            // Set up event handlers
            this.amqpConnection.on('error', (err) => {
                this.logger.error(`AMQP connection error: ${err.message}`);
                this.amqpConnected = false;
                this.useHttpOnly = true;
            });

            this.amqpConnection.on('close', () => {
                this.logger.info('AMQP connection closed');
                this.amqpConnected = false;
                this.useHttpOnly = true;
            });

            this.amqpConnected = true;
            this.logger.info('Successfully connected to RabbitMQ via AMQP');
            return true;
        } catch (error) {
            this.logger.error(`Failed to create AMQP channel: ${error.message}`);
            this.amqpConnected = false;
            this.useHttpOnly = true;
            throw error;
        }
    }

    /**
     * Configure Handlebars as the view engine
     * @param {Object} app - Express app instance
     * @private
     */
    _setupHandlebars(app) {
        const hbs = exphbs.create({
            defaultLayout: 'main',
            extname: '.hbs',
            layoutsDir: path.join(__dirname, '../../views/layouts'),
            partialsDir: path.join(__dirname, '../../views/partials'),
            helpers: {
                eq: function (a, b) { return a === b; },
                formatTimestamp: function (timestamp) {
                    return new Date(timestamp).toLocaleString();
                },
                formatRate: function (rate) {
                    return rate ? parseFloat(rate).toFixed(2) : '0.00';
                }
            }
        });

        app.engine('.hbs', hbs.engine);
        app.set('view engine', '.hbs');
        app.set('views', path.join(__dirname, '../../views'));
    }

    /**
     * Check if AMQP channel is available
     * @returns {boolean}
     */
    isAmqpConnected() {
        return this.amqpConnected && this.amqpChannel && !this.useHttpOnly;
    }

    /**
     * Set up Express routes
     */
    setupRoutes() {
        // Serve static files
        this.router.use('/static', express.static(path.join(__dirname, '../../public')));

        // Enable JSON parsing
        this.router.use(express.json());
        this.router.use(express.urlencoded({ extended: true }));

        // Security headers
        this.router.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });

        // Main dashboard route
        this.router.get('/', (req, res) => {
            res.render('dashboard', {
                title: 'RabbitMQ Dashboard',
                basePath: this.config.basePath,
                layout: 'main'
            });
        });

        // API routes
        this._setupApiRoutes();
    }

    /**
     * Set up API routes
     * @private
     */
    _setupApiRoutes() {
        // Overview API
        this.router.get('/api/overview', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/overview', 'overview');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Queues API
        this.router.get('/api/queues', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/queues', 'queues');

                // Enhance with AMQP data if available
                if (this.isAmqpConnected()) {
                    await this._enhanceQueuesWithAmqpData(data);
                }

                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Exchanges API
        this.router.get('/api/exchanges', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/exchanges', 'exchanges');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Bindings API
        this.router.get('/api/bindings', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/bindings', 'bindings');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get messages from queue API
        this.router.get('/api/queues/:vhost/:name/get', async (req, res) => {
            try {
                const { vhost, name } = req.params;
                let messages = [];

                // Try AMQP first if available
                if (this.isAmqpConnected()) {
                    try {
                        messages = await this._getMessagesViaAmqp(vhost, name, 10);
                    } catch (amqpError) {
                        this.logger.warn(`Error getting messages via AMQP: ${amqpError.message}. Falling back to HTTP.`);
                        messages = await this._getMessagesViaHttp(vhost, name);
                    }
                } else {
                    // Fall back to HTTP API
                    messages = await this._getMessagesViaHttp(vhost, name);
                }

                res.json(messages);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Purge queue API
        this.router.post('/api/queues/:vhost/:name/purge', async (req, res) => {
            try {
                const { vhost, name } = req.params;

                // Try AMQP first if available
                if (this.isAmqpConnected()) {
                    try {
                        await this.amqpChannel.purgeQueue(name);
                        this.logger.info(`Queue ${name} purged successfully via AMQP`);
                        res.json({ success: true, message: 'Queue purged successfully' });
                        return;
                    } catch (amqpError) {
                        this.logger.warn(`Error purging queue via AMQP: ${amqpError.message}. Falling back to HTTP.`);
                    }
                }

                // Fall back to HTTP API
                const encodedVhost = encodeURIComponent(vhost);
                const endpoint = `/api/queues/${encodedVhost}/${name}/purge`;
                await this.httpClient.post(endpoint);

                this.logger.info(`Queue ${name} purged successfully via HTTP API`);
                res.json({ success: true, message: 'Queue purged successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Health check API
        this.router.get('/api/health', async (req, res) => {
            const health = {
                status: 'UP',
                amqp: this.isAmqpConnected() ? 'CONNECTED' : 'DISCONNECTED',
                http: this.httpConnected,
                timestamp: new Date().toISOString()
            };

            if (!health.amqp && !health.http) {
                health.status = 'DOWN';
            } else if (!health.amqp) {
                health.status = 'DEGRADED';
            }

            res.json(health);
        });

        // Publish message API
        this.router.post('/api/exchanges/:vhost/:name/publish', async (req, res) => {
            try {
                const { vhost, name } = req.params;
                const { routingKey, payload, properties } = req.body;

                if (routingKey === undefined || payload === undefined) {
                    return res.status(400).json({ error: 'Routing key and payload are required' });
                }

                // Try AMQP first if available
                if (this.isAmqpConnected()) {
                    try {
                        const content = Buffer.from(
                            typeof payload === 'string' ? payload : JSON.stringify(payload)
                        );

                        await this.amqpChannel.publish(name, routingKey, content, properties || {});

                        this.logger.info(`Message published to exchange ${name} with routing key ${routingKey} via AMQP`);
                        res.json({ success: true, message: 'Message published successfully' });
                        return;
                    } catch (amqpError) {
                        this.logger.warn(`Error publishing message via AMQP: ${amqpError.message}. Falling back to HTTP.`);
                    }
                }

                // Fall back to HTTP API
                const encodedVhost = encodeURIComponent(vhost);
                const endpoint = `/api/exchanges/${encodedVhost}/${name}/publish`;

                const data = {
                    properties: properties || {},
                    routing_key: routingKey,
                    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
                    payload_encoding: 'string'
                };

                const result = await this.httpClient.post(endpoint, data);
                this.logger.info(`Message published to exchange ${name} with routing key ${routingKey} via HTTP API`);
                res.json(result.data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    /**
     * Fetch data from RabbitMQ API with caching
     * @param {string} endpoint - API endpoint
     * @param {string} cacheKey - Cache key for storing results
     * @param {number} cacheTTL - Cache time-to-live in milliseconds
     * @returns {Promise<Object>} API response data
     */
    async fetchFromRabbitMQ(endpoint, cacheKey, cacheTTL = 5000) {
        // Check cache if applicable
        if (cacheKey && this.cache[cacheKey] && this.cache.lastUpdated[cacheKey]) {
            const cacheAge = Date.now() - this.cache.lastUpdated[cacheKey];
            if (cacheAge < cacheTTL) {
                return this.cache[cacheKey];
            }
        }

        try {
            const response = await this.httpClient.get(endpoint);

            // Update cache if applicable
            if (cacheKey) {
                this.cache[cacheKey] = response.data;
                this.cache.lastUpdated[cacheKey] = Date.now();
            }

            return response.data;
        } catch (error) {
            // Return cached data if available, even if expired
            if (cacheKey && this.cache[cacheKey]) {
                this.logger.info(`Returning cached data for ${cacheKey} due to API error`);
                return this.cache[cacheKey];
            }

            throw error;
        }
    }

    /**
     * Get messages from a queue via HTTP API
     * @param {string} vhost - Virtual host
     * @param {string} name - Queue name
     * @returns {Promise<Array>} Array of messages
     * @private
     */
    async _getMessagesViaHttp(vhost, name) {
        const encodedVhost = encodeURIComponent(vhost);
        const endpoint = `/api/queues/${encodedVhost}/${name}/get`;

        const response = await this.httpClient.post(endpoint, {
            count: 10,
            requeue: true,
            encoding: 'auto',
            truncate: 50000
        });

        return response.data;
    }

    /**
     * Get messages from a queue via AMQP
     * @param {string} vhost - Virtual host (ignored, using connection's vhost)
     * @param {string} queueName - Queue name
     * @param {number} count - Maximum number of messages to get
     * @returns {Promise<Array>} Array of messages
     * @private
     */
    async _getMessagesViaAmqp(vhost, queueName, count = 10) {
        if (!this.isAmqpConnected()) {
            throw new Error('AMQP channel not available');
        }

        // Assert the queue exists
        await this.amqpChannel.checkQueue(queueName);

        const messages = [];

        for (let i = 0; i < count; i++) {
            // Get a message, don't acknowledge it (noAck: true means auto-ack)
            const msg = await this.amqpChannel.get(queueName, { noAck: true });

            if (!msg) {
                // No more messages
                break;
            }

            // Get content and try to parse it
            let content = msg.content.toString();
            try {
                content = JSON.parse(content);
            } catch (e) {
                // Not JSON, keep as string
            }

            messages.push({
                payload: content,
                properties: {
                    ...msg.properties
                },
                redelivered: msg.fields.redelivered,
                routing_key: msg.fields.routingKey,
                exchange: msg.fields.exchange
            });
        }

        return messages;
    }

    /**
     * Enhance queue data with AMQP information
     * @param {Array} queues - Array of queue objects
     * @private
     */
    async _enhanceQueuesWithAmqpData(queues) {
        if (!this.isAmqpConnected() || !queues.length) return;

        // Process queues in batches to avoid overwhelming the server
        const batchSize = 10;
        for (let i = 0; i < queues.length; i += batchSize) {
            const batch = queues.slice(i, i + batchSize);

            await Promise.all(batch.map(async (queue) => {
                try {
                    const queueInfo = await this.amqpChannel.checkQueue(queue.name);

                    // Update queue with AMQP data
                    queue.messages = queueInfo.messageCount;
                    queue.consumers = queueInfo.consumerCount;
                    queue.messages_details = {
                        ...queue.messages_details,
                        current: queueInfo.messageCount
                    };
                    queue.idle = queueInfo.consumerCount === 0 && queueInfo.messageCount === 0;

                    // Initialize message_stats if not present
                    if (!queue.message_stats) {
                        queue.message_stats = {};
                    }
                } catch (error) {
                    // Skip this queue if it can't be enhanced
                }
            }));
        }
    }

    /**
     * Set up WebSocket communications
     */
    setupWebsockets() {
        if (!this.server) {
            this.logger.error('Cannot set up WebSockets without an HTTP server');
            return;
        }

        this.io = socketIo(this.server, {
            path: `${this.config.basePath}socket.io`.replace(/\/+/g, '/'),
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        this.io.on('connection', (socket) => {
            this.logger.info(`Client connected: ${socket.id}`);
            this.connectedClients.add(socket.id);

            // Send initial connection status
            socket.emit('connection-status', {
                http: this.httpConnected,
                amqp: this.isAmqpConnected(),
                timestamp: new Date().toISOString()
            });

            // Start sending updates
            this._startSendingUpdates(socket);

            socket.on('disconnect', () => {
                this.logger.info(`Client disconnected: ${socket.id}`);
                this.connectedClients.delete(socket.id);

                // Clear update interval
                if (this.updateIntervals.has(socket.id)) {
                    clearInterval(this.updateIntervals.get(socket.id));
                    this.updateIntervals.delete(socket.id);
                }
            });
        });

        this.logger.info('WebSocket server initialized');
    }

    /**
     * Start sending periodic updates to a client
     * @param {Object} socket - Socket.IO socket
     * @private
     */
    _startSendingUpdates(socket) {
        // Function to fetch and send data
        const sendUpdates = async () => {
            try {
                // Fetch overview, queues and exchanges data
                const [overview, queues, exchanges] = await Promise.all([
                    this.fetchFromRabbitMQ('/api/overview', 'overview'),
                    this.fetchFromRabbitMQ('/api/queues', 'queues'),
                    this.fetchFromRabbitMQ('/api/exchanges', 'exchanges')
                ]);

                // If we have an AMQP connection, enhance the queue data
                if (this.isAmqpConnected()) {
                    await this._enhanceQueuesWithAmqpData(queues);
                }

                // Send to client
                socket.emit('rabbitmq-data', {
                    overview,
                    queues,
                    exchanges,
                    connectionStatus: {
                        http: this.httpConnected,
                        amqp: this.isAmqpConnected(),
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (error) {
                // Send error to client
                socket.emit('rabbitmq-error', {
                    message: error.message,
                    connectionStatus: {
                        http: this.httpConnected,
                        amqp: this.isAmqpConnected(),
                        timestamp: new Date().toISOString()
                    }
                });
            }
        };

        // Initial data
        sendUpdates().catch(() => { });

        // Set up interval for regular updates
        const intervalId = setInterval(() => {
            sendUpdates().catch(() => { });
        }, this.config.refreshInterval);

        // Store interval ID for cleanup
        this.updateIntervals.set(socket.id, intervalId);
    }

    /**
     * Create a standalone server
     * @param {number} port - Port to listen on
     * @returns {Promise<Object>} Object containing app and server
     */
    async createServer(port = 3000) {
        const actualPort = parseInt(port, 10) || 3000;

        // Create a new Express application
        this.app = express();

        // Configure Handlebars view engine
        this._setupHandlebars(this.app);

        // Security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });

        // Mount the router
        this.app.use(this.config.basePath, this.router);

        // Add 404 handler for unmatched routes
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not Found' });
        });

        // Create HTTP server
        this.server = http.createServer(this.app);

        // Initialize connections
        await this.initialize();

        // Setup WebSockets
        this.setupWebsockets();

        // Start server
        return new Promise((resolve, reject) => {
            try {
                const serverInstance = this.server.listen(actualPort, () => {
                    const address = serverInstance.address();
                    const host = address.address === '::' ? 'localhost' : address.address;
                    const port = address.port;

                    this.logger.info(`RabbitMQ Dashboard running at http://${host}:${port}${this.config.basePath}`);
                    resolve({
                        app: this.app,
                        server: this.server
                    });
                });

                this.server.on('error', (err) => {
                    reject(err);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Mount to an existing Express app
     * @param {Object} app - Express app
     * @param {Object} appServer - HTTP server
     * @returns {Promise<Object>} Router
     */
    async mountApp(app, appServer = null) {
        if (!app) {
            throw new Error('Express app is required');
        }

        this.app = app;

        // Configure Handlebars view engine
        this._setupHandlebars(app);

        // Initialize connections
        await this.initialize();

        // Mount the router
        this.app.use(this.config.basePath, this.router);

        // Setup WebSockets if server is provided
        if (appServer) {
            this.server = appServer;
            this.setupWebsockets();
        }

        return this.router;
    }

    /**
     * Graceful shutdown of all connections and server
     * @returns {Promise<void>}
     */
    async shutdown() {
        this.logger.info('Shutting down RabbitMQ Dashboard...');

        // Close WebSocket connections
        if (this.io) {
            // Notify clients that server is shutting down
            this.io.emit('server-shutdown', { message: 'Server shutting down' });

            // Disconnect all clients
            for (const socketId of this.connectedClients) {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.disconnect(true);
                }
            }

            // Clear all update intervals
            for (const [socketId, intervalId] of this.updateIntervals.entries()) {
                clearInterval(intervalId);
            }
            this.updateIntervals.clear();

            // Close IO server
            await new Promise(resolve => {
                this.io.close(() => resolve());
            });
        }

        // Close AMQP connection
        if (this.amqpChannel) {
            try {
                await this.amqpChannel.close();
            } catch (e) {
                // Ignore errors
            }
            this.amqpChannel = null;
        }

        if (this.amqpConnection) {
            try {
                await this.amqpConnection.close();
            } catch (e) {
                // Ignore errors
            }
            this.amqpConnection = null;
        }

        // Close HTTP server if it exists
        if (this.server) {
            await new Promise(resolve => {
                this.server.close(() => resolve());
            });
        }

        this.logger.info('Shutdown complete');
    }
}

module.exports = RabbitMQAdmin;