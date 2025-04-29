// RabbitMQAdmin.js
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const amqp = require('amqplib');
const winston = require('winston');
const exphbs = require('express-handlebars'); // Require handlebars

/**
 * RabbitMQ Admin UI for monitoring and managing RabbitMQ servers
 * @class
 */
class RabbitMQAdmin {
    /**
     * Create a new RabbitMQAdmin instance
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Configure logger
        this.logger = this._setupLogger(options.logger);

        // Configuration options with defaults
        this.options = {
            rabbitMQUrl: options.rabbitMQUrl || 'http://localhost:15672',
            amqpUrl: options.amqpUrl || 'amqp://localhost:5672',
            username: options.username || 'guest',
            password: options.password || 'guest',
            refreshInterval: options.refreshInterval || 5000, // 5 seconds
            basePath: this._normalizePath(options.basePath || '/'),
            maxRetries: options.maxRetries || 5,
            retryTimeout: options.retryTimeout || 3000, // 3 seconds initial retry timeout
            ...options
        };

        // Infrastructure components
        this.app = null;
        this.server = null;
        this.io = null;
        this.router = express.Router();

        // Connection state
        this.amqpConnection = null;
        this.amqpChannel = null;
        this.retryCount = 0;
        this.isConnecting = false;
        this.connectedClients = new Set();
        this.reconnectTimer = null;
        this.updateIntervals = new Map();

        // Cache for performance
        this.cache = {
            overview: null,
            queues: null,
            exchanges: null,
            bindings: null,
            lastUpdated: {
                overview: null,
                queues: null,
                exchanges: null,
                bindings: null
            }
        };

        // Set up API routes
        this.setupRoutes();
    }

    /**
     * Set up a configured logger
     * @param {Object} customLogger - Optional external logger
     * @returns {Object} Configured logger
     * @private
     */
    _setupLogger(customLogger) {
        if (customLogger) return customLogger;

        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ level, message, timestamp }) => {
                    return `${timestamp} ${level.toUpperCase()}: ${message}`;
                })
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    /**
     * Normalize path to ensure it starts with a slash
     * @param {string} path - Path to normalize
     * @returns {string} Normalized path
     * @private
     */
    _normalizePath(path) {
        // Ensure path starts with a slash
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        // Ensure path ends with a slash if not root
        if (path !== '/' && !path.endsWith('/')) {
            path += '/';
        }
        return path;
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
                // Custom Handlebars helpers
                eq: function (a, b) {
                    return a === b;
                },
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
     * Connect to RabbitMQ via AMQP
     * @returns {Promise<boolean>} Success status
     */
    async connect() {
        if (this.isConnecting) {
            this.logger.debug('Connection attempt already in progress');
            return false;
        }

        this.isConnecting = true;

        try {
            // Build connection string with credentials
            const amqpConnectionString = this._buildAmqpConnectionString();

            this.logger.info('Connecting to RabbitMQ via AMQP...');
            this.amqpConnection = await amqp.connect(amqpConnectionString);
            this.amqpChannel = await this.amqpConnection.createChannel();

            // Reset retry counter on successful connection
            this.retryCount = 0;
            this.isConnecting = false;

            // Set up connection event handlers
            this._setupConnectionHandlers();

            this.logger.info('Successfully connected to RabbitMQ via AMQP');

            // Notify connected clients about the successful connection
            this._broadcastConnectionStatus();

            return true;
        } catch (error) {
            this.isConnecting = false;
            this.logger.error('Failed to connect to RabbitMQ via AMQP:', error.message);
            this._reconnect();
            return false;
        }
    }

    /**
     * Set up AMQP connection event handlers
     * @private
     */
    _setupConnectionHandlers() {
        if (!this.amqpConnection) return;

        this.amqpConnection.on('error', (err) => {
            this.logger.error('AMQP connection error:', err.message);
            this._reconnect();
        });

        this.amqpConnection.on('close', () => {
            if (this.amqpConnection) { // Only reconnect if not deliberately closed
                this.logger.info('AMQP connection closed, attempting to reconnect...');
                this._reconnect();
            }
        });
    }

    /**
     * Build AMQP connection string with credentials
     * @returns {string} AMQP connection string
     * @private
     */
    _buildAmqpConnectionString() {
        const username = encodeURIComponent(this.options.username);
        const password = encodeURIComponent(this.options.password);

        // Parse the AMQP URL or construct it
        let amqpUrl = this.options.amqpUrl;
        if (!amqpUrl.includes('@')) {
            try {
                const urlObj = new URL(amqpUrl);
                urlObj.username = username;
                urlObj.password = password;
                amqpUrl = urlObj.toString();
            } catch (error) {
                throw new Error(`Invalid AMQP URL: ${error.message}`);
            }
        }

        return amqpUrl;
    }

    /**
     * Attempt to reconnect to RabbitMQ with exponential backoff
     * @private
     */
    _reconnect() {
        if (this.isConnecting || this.reconnectTimer) {
            return;
        }

        if (this.retryCount >= this.options.maxRetries) {
            this.logger.error(`Failed to connect to RabbitMQ after ${this.options.maxRetries} attempts. Giving up.`);
            this._broadcastConnectionStatus(false, `Failed to connect after ${this.options.maxRetries} attempts`);
            return;
        }

        // Exponential backoff with jitter
        const baseTimeout = this.options.retryTimeout * Math.pow(2, this.retryCount);
        const jitter = Math.floor(Math.random() * 1000); // Add up to 1 second of jitter
        const timeout = baseTimeout + jitter;

        this.retryCount++;

        this.logger.info(`Attempting to reconnect to RabbitMQ in ${(timeout / 1000).toFixed(1)} seconds (attempt ${this.retryCount}/${this.options.maxRetries})...`);

        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        // Schedule reconnection attempt
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;

            // Close existing connections if they exist
            await this.closeConnection();

            // Try to connect again
            this.connect();
        }, timeout);
    }

    /**
     * Close the AMQP connection and channel
     * @returns {Promise<void>}
     */
    async closeConnection() {
        // Clear any reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Close channel if it exists
        if (this.amqpChannel) {
            try {
                this.logger.debug('Closing AMQP channel...');
                await this.amqpChannel.close();
                this.logger.debug('AMQP channel closed');
            } catch (err) {
                this.logger.warn('Error closing AMQP channel:', err.message);
            } finally {
                this.amqpChannel = null;
            }
        }

        // Close connection if it exists
        if (this.amqpConnection) {
            try {
                this.logger.debug('Closing AMQP connection...');
                await this.amqpConnection.close();
                this.logger.debug('AMQP connection closed');
            } catch (err) {
                this.logger.warn('Error closing AMQP connection:', err.message);
            } finally {
                this.amqpConnection = null;
            }
        }
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

        // Add headers for security
        this.router.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });

        // Main dashboard route
        this.router.get('/', (req, res) => {
            res.render('dashboard', {
                title: 'RabbitMQ Board',
                basePath: this.options.basePath,
                layout: 'main' // Specify handlebars layout
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
                this.logger.error('Error fetching overview:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        // Queues API
        this.router.get('/api/queues', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/queues', 'queues');

                // Enhance with AMQP data if available
                if (this.amqpChannel) {
                    await this.enhanceQueuesWithAmqpData(data);
                }

                res.json(data);
            } catch (error) {
                this.logger.error('Error fetching queues:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        // Exchanges API
        this.router.get('/api/exchanges', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/exchanges', 'exchanges');
                res.json(data);
            } catch (error) {
                this.logger.error('Error fetching exchanges:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        // Bindings API
        this.router.get('/api/bindings', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/bindings', 'bindings');
                res.json(data);
            } catch (error) {
                this.logger.error('Error fetching bindings:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        // Get messages from queue API
        this.router.get('/api/queues/:vhost/:name/get', async (req, res) => {
            try {
                const { vhost, name } = req.params;
                let messages = [];

                // Try AMQP first if available
                if (this.amqpChannel) {
                    try {
                        messages = await this.getMessagesViaAmqp(vhost, name, 10);
                    } catch (amqpError) {
                        this.logger.warn(`Error getting messages via AMQP: ${amqpError.message}. Falling back to HTTP API.`);
                        messages = await this.getMessagesViaHttp(vhost, name);
                    }
                } else {
                    // Fall back to HTTP API
                    messages = await this.getMessagesViaHttp(vhost, name);
                }

                res.json(messages);
            } catch (error) {
                this.logger.error('Error getting queue messages:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        // Purge queue API
        this.router.post('/api/queues/:vhost/:name/purge', async (req, res) => {
            try {
                const { vhost, name } = req.params;

                // Try AMQP first if available
                if (this.amqpChannel) {
                    try {
                        await this.amqpChannel.purgeQueue(name);
                        this.logger.info(`Queue ${name} purged successfully via AMQP`);
                        res.json({ success: true, message: 'Queue purged successfully' });
                        return;
                    } catch (amqpError) {
                        this.logger.warn(`Error purging queue via AMQP: ${amqpError.message}. Falling back to HTTP API.`);
                    }
                }

                // Fall back to HTTP API
                const encodedVhost = encodeURIComponent(vhost);
                const endpoint = `/api/queues/${encodedVhost}/${name}/purge`;
                await this.postToRabbitMQ(endpoint, {});

                this.logger.info(`Queue ${name} purged successfully via HTTP API`);
                res.json({ success: true, message: 'Queue purged successfully' });
            } catch (error) {
                this.logger.error('Error purging queue:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        // Health check API
        this.router.get('/api/health', async (req, res) => {
            const health = {
                status: 'UP',
                amqp: this.amqpChannel ? 'CONNECTED' : 'DISCONNECTED',
                http: true, // We'll test this below
                timestamp: new Date().toISOString()
            };

            try {
                // Quick test of the HTTP API
                await this.fetchFromRabbitMQ('/api/overview', null, 0);
            } catch (error) {
                health.http = false;
                health.status = 'DEGRADED';
            }

            if (!health.amqp && !health.http) {
                health.status = 'DOWN';
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
                if (this.amqpChannel) {
                    try {
                        const content = Buffer.from(
                            typeof payload === 'string' ? payload : JSON.stringify(payload)
                        );

                        await this.amqpChannel.publish(name, routingKey, content, properties || {});

                        this.logger.info(`Message published to exchange ${name} with routing key ${routingKey} via AMQP`);
                        res.json({ success: true, message: 'Message published successfully' });
                        return;
                    } catch (amqpError) {
                        this.logger.warn(`Error publishing message via AMQP: ${amqpError.message}. Falling back to HTTP API.`);
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

                const result = await this.postToRabbitMQ(endpoint, data);
                this.logger.info(`Message published to exchange ${name} with routing key ${routingKey} via HTTP API`);
                res.json(result);
            } catch (error) {
                this.logger.error('Error publishing message:', error.message);
                res.status(500).json({ error: error.message });
            }
        });
    }

    /**
     * Get messages from a queue via HTTP API
     * @param {string} vhost - Virtual host
     * @param {string} name - Queue name
     * @returns {Promise<Array>} Array of messages
     */
    async getMessagesViaHttp(vhost, name) {
        const encodedVhost = encodeURIComponent(vhost);
        const endpoint = `/api/queues/${encodedVhost}/${name}/get`;

        const data = await this.postToRabbitMQ(endpoint, {
            count: 10,
            requeue: true,
            encoding: 'auto',
            truncate: 50000
        });

        return data;
    }

    /**
     * Get messages from a queue via AMQP
     * @param {string} vhost - Virtual host
     * @param {string} queueName - Queue name
     * @param {number} count - Maximum number of messages to get
     * @returns {Promise<Array>} Array of messages
     */
    async getMessagesViaAmqp(vhost, queueName, count = 10) {
        if (!this.amqpChannel) {
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

            // Parse content
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
     */
    async enhanceQueuesWithAmqpData(queues) {
        if (!this.amqpChannel) return;

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
                    this.logger.debug(`Could not enhance queue ${queue.name} with AMQP data: ${error.message}`);
                }
            }));
        }
    }

    /**
     * Fetch data from RabbitMQ API with caching
     * @param {string} endpoint - API endpoint
     * @param {string|null} cacheKey - Cache key for storing results
     * @param {number} cacheTTL - Cache time-to-live in milliseconds
     * @returns {Promise<Object>} API response data
     */
    async fetchFromRabbitMQ(endpoint, cacheKey = null, cacheTTL = 5000) {
        // Check cache if applicable
        if (cacheKey && this.cache[cacheKey] && this.cache.lastUpdated[cacheKey]) {
            const cacheAge = Date.now() - this.cache.lastUpdated[cacheKey];
            if (cacheAge < cacheTTL) {
                return this.cache[cacheKey];
            }
        }

        try {
            const url = `${this.options.rabbitMQUrl}${endpoint}`;
            const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000 // 5 second timeout
            });

            // Update cache if applicable
            if (cacheKey) {
                this.cache[cacheKey] = response.data;
                this.cache.lastUpdated[cacheKey] = Date.now();
            }

            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching from RabbitMQ (${endpoint}):`, error.message);

            // Return cached data if available, even if expired
            if (cacheKey && this.cache[cacheKey]) {
                this.logger.info(`Returning cached data for ${cacheKey} due to API error`);
                return this.cache[cacheKey];
            }

            throw error;
        }
    }

    /**
     * Post data to RabbitMQ API
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Data to send
     * @returns {Promise<Object>} API response data
     */
    async postToRabbitMQ(endpoint, data) {
        try {
            const url = `${this.options.rabbitMQUrl}${endpoint}`;
            const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');

            const response = await axios.post(url, data, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000 // 5 second timeout
            });

            return response.data;
        } catch (error) {
            this.logger.error(`Error posting to RabbitMQ (${endpoint}):`, error.message);
            throw error;
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
            path: `${this.options.basePath}socket.io`.replace(/\/+/g, '/'),
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
                http: true,
                amqp: !!this.amqpChannel,
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
                if (this.amqpChannel) {
                    await this.enhanceQueuesWithAmqpData(queues);
                }

                // Send to client
                socket.emit('rabbitmq-data', {
                    overview,
                    queues,
                    exchanges,
                    connectionStatus: {
                        http: true,
                        amqp: !!this.amqpChannel,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (error) {
                this.logger.error('Error sending RabbitMQ updates:', error.message);

                socket.emit('rabbitmq-error', {
                    message: error.message,
                    connectionStatus: {
                        http: false,
                        amqp: !!this.amqpChannel,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        };

        // Initial data
        sendUpdates().catch(err => {
            this.logger.error('Error sending initial update:', err.message);
        });

        // Set up interval for regular updates
        const intervalId = setInterval(() => {
            sendUpdates().catch(err => {
                this.logger.error('Error sending periodic update:', err.message);
            });
        }, this.options.refreshInterval);

        // Store interval ID for cleanup
        this.updateIntervals.set(socket.id, intervalId);
    }

    /**
     * Broadcast connection status to all connected clients
     * @param {boolean} connected - Whether connection is active
     * @param {string} message - Optional status message
     * @private
     */
    _broadcastConnectionStatus(connected = true, message = '') {
        if (this.io) {
            this.io.emit('connection-status', {
                http: true,
                amqp: connected,
                message,
                timestamp: new Date().toISOString()
            });
        }
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

        // Mount the router
        this.app.use(this.options.basePath, this.router);

        // Setup WebSockets if server is provided
        if (appServer) {
            this.server = appServer;
            this.setupWebsockets();
        }

        // Connect to RabbitMQ via AMQP (don't await to prevent blocking)
        this.connect().catch(err => {
            this.logger.warn('Initial RabbitMQ connection failed, will retry in background:', err.message);
        });

        return this.router;
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

        // Additional security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });

        // Mount the router
        this.app.use(this.options.basePath, this.router);

        // Add 404 handler for unmatched routes
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not Found' });
        });

        // Create HTTP server
        this.server = http.createServer(this.app);

        // Monitor server events
        this.server.on('error', (err) => {
            this.logger.error('HTTP server error:', err.message);
        });

        // Setup WebSockets
        this.setupWebsockets();

        // Connect to RabbitMQ via AMQP (don't await to prevent blocking)
        this.connect().catch(err => {
            this.logger.warn('Initial RabbitMQ connection failed, will retry in background:', err.message);
        });

        // Start server
        return new Promise((resolve, reject) => {
            try {
                const serverInstance = this.server.listen(actualPort, () => {
                    const address = serverInstance.address();
                    const host = address.address === '::' ? 'localhost' : address.address;
                    const port = address.port;

                    this.logger.info(`RabbitMQ Board running at http://${host}:${port}${this.options.basePath}`);
                    resolve({
                        app: this.app,
                        server: this.server
                    });
                });

                this.server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        this.logger.error(`Port ${actualPort} is already in use`);
                    } else {
                        this.logger.error(`Server error: ${err.message}`);
                    }
                    reject(err);
                });
            } catch (error) {
                this.logger.error('Failed to start server:', error);
                reject(error);
            }
        });
    }

    /**
     * Graceful shutdown of all connections and server
     * @param {number} timeout - Maximum time to wait for graceful shutdown in ms
     * @returns {Promise<void>}
     */
    async shutdown(timeout = 10000) {
        this.logger.info('Shutting down RabbitMQ Board...');

        // Create a promise that will resolve after the timeout
        const timeoutPromise = new Promise(resolve => {
            setTimeout(() => {
                this.logger.warn(`Shutdown timed out after ${timeout}ms`);
                resolve();
            }, timeout);
        });

        // Create shutdown promises
        const shutdownPromises = [];

        // Close WebSocket connections
        if (this.io) {
            this.logger.debug('Closing WebSocket connections...');

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
            shutdownPromises.push(new Promise(resolve => {
                this.io.close(() => {
                    this.logger.debug('WebSocket server closed');
                    resolve();
                });
            }));
        }

        // Close AMQP connection
        shutdownPromises.push(this.closeConnection());

        // Close HTTP server if it exists
        if (this.server) {
            shutdownPromises.push(new Promise(resolve => {
                this.server.close(() => {
                    this.logger.info('HTTP server closed');
                    resolve();
                });
            }));
        }

        // Wait for all shutdowns or timeout
        await Promise.race([
            Promise.all(shutdownPromises),
            timeoutPromise
        ]);

        this.logger.info('Shutdown complete');
    }
}

module.exports = RabbitMQAdmin;