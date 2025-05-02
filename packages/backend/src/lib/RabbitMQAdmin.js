// src/lib/RabbitMQAdmin.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const amqp = require('amqplib');
const axios = require('axios');
const cors = require('cors');
const { loadConfig } = require('../utils/config');

/**
 * RabbitMQ Admin UI for monitoring and managing RabbitMQ servers
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
        try {
            // Initialize HTTP client
            await this._initializeHttpClient();

            // Try to initialize AMQP client
            try {
                await this._initializeAmqpClient();
            } catch (error) {
                this.logger.warn(`AMQP connection failed: ${error.message}. Using HTTP-only mode.`);
            }

            return true;
        } catch (error) {
            this.logger.error(`Failed to initialize RabbitMQ connections: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize HTTP client
     * @private
     */
    async _initializeHttpClient() {
        const clientOptions = {
            baseURL: this.config.rabbitMQUrl,
            auth: {
                username: this.config.username,
                password: this.config.password
            },
            timeout: 10000
        };

        this.httpClient = axios.create(clientOptions);

        try {
            await this.httpClient.get('/api/overview');
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
        try {
            // Connect using the AMQP URL from config
            this.amqpConnection = await amqp.connect(this.config.amqpUrl);
            this.amqpChannel = await this.amqpConnection.createChannel();

            // Set up event handlers
            this.amqpConnection.on('error', (err) => {
                this.logger.error(`AMQP connection error: ${err.message}`);
                this.amqpConnected = false;
            });

            this.amqpConnection.on('close', () => {
                this.logger.info('AMQP connection closed');
                this.amqpConnected = false;
            });

            this.amqpConnected = true;
            this.logger.info('Successfully connected to RabbitMQ via AMQP');
            return true;
        } catch (error) {
            this.logger.error(`Failed to connect to RabbitMQ via AMQP: ${error.message}`);
            this.amqpConnected = false;
            throw error;
        }
    }

    /**
     * Safely serialize an object to prevent circular references
     * @param {Object} data - Data to serialize
     * @returns {Object} Serialized data without circular references
     * @private
     */
    _safeSerialize(data) {
        if (!data) return null;

        try {
            return JSON.parse(JSON.stringify(data));
        } catch (error) {
            this.logger.error(`Serialization error: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract essential data from a queue object to prevent circular references
     * @param {Object} queue - Queue object
     * @returns {Object} Queue object with only essential properties
     * @private
     */
    _extractQueueEssentials(queue) {
        if (!queue) return null;

        return {
            name: queue.name,
            vhost: queue.vhost,
            durable: queue.durable,
            auto_delete: queue.auto_delete,
            exclusive: queue.exclusive,
            state: queue.state,
            consumers: queue.consumers || 0,
            messages: queue.messages || 0,
            messages_ready: queue.messages_ready || 0,
            messages_unacknowledged: queue.messages_unacknowledged || 0,
            memory: queue.memory,
            message_stats: queue.message_stats ? {
                publish: queue.message_stats.publish,
                publish_details: queue.message_stats.publish_details ? {
                    rate: queue.message_stats.publish_details.rate
                } : undefined,
                deliver: queue.message_stats.deliver,
                deliver_details: queue.message_stats.deliver_details ? {
                    rate: queue.message_stats.deliver_details.rate
                } : undefined,
                ack: queue.message_stats.ack,
                ack_details: queue.message_stats.ack_details ? {
                    rate: queue.message_stats.ack_details.rate
                } : undefined
            } : undefined
        };
    }

    /**
     * Extract essential data from an exchange object to prevent circular references
     * @param {Object} exchange - Exchange object
     * @returns {Object} Exchange object with only essential properties
     * @private
     */
    _extractExchangeEssentials(exchange) {
        if (!exchange) return null;

        return {
            name: exchange.name,
            vhost: exchange.vhost,
            type: exchange.type,
            durable: exchange.durable,
            auto_delete: exchange.auto_delete,
            internal: exchange.internal,
            message_stats: exchange.message_stats ? {
                publish_in: exchange.message_stats.publish_in,
                publish_in_details: exchange.message_stats.publish_in_details ? {
                    rate: exchange.message_stats.publish_in_details.rate
                } : undefined,
                publish_out: exchange.message_stats.publish_out,
                publish_out_details: exchange.message_stats.publish_out_details ? {
                    rate: exchange.message_stats.publish_out_details.rate
                } : undefined
            } : undefined
        };
    }

    /**
     * Check if AMQP channel is available
     * @returns {boolean} Whether AMQP is connected
     */
    isAmqpConnected() {
        return this.amqpConnected && this.amqpChannel;
    }

    /**
     * Set up Express routes
     */
    setupRoutes() {
        // Enable JSON parsing
        this.router.use(express.json());
        this.router.use(express.urlencoded({ extended: true }));

        // CORS headers
        this.router.use(cors());

        // Set up API routes
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
                    await this._enhanceQueuesData(data);
                }

                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Individual queue API
        this.router.get('/api/queues/:vhost/:name', async (req, res) => {
            try {
                const { vhost, name } = req.params;

                // Fix double-encoding issue by decoding once if needed
                const decodedVhost = vhost.includes('%') ? decodeURIComponent(vhost) : vhost;
                const encodedVhost = encodeURIComponent(decodedVhost);
                const encodedName = encodeURIComponent(name);

                console.log(`Getting queue info for vhost: ${decodedVhost}, queue: ${name}`);
                console.log(`API endpoint: /api/queues/${encodedVhost}/${encodedName}`);

                const response = await this.httpClient.get(`/api/queues/${encodedVhost}/${encodedName}`);
                let queue = response.data;

                // Enhance with AMQP if available
                if (this.isAmqpConnected()) {
                    try {
                        const queueInfo = await this.amqpChannel.checkQueue(name);
                        queue.messages = queueInfo.messageCount;
                        queue.consumers = queueInfo.consumerCount;

                        // Add timestamp to queue info
                        queue.last_checked = new Date().toISOString();
                    } catch (e) {
                        console.error(`Error checking queue via AMQP: ${e.message}`);
                    }
                }

                res.json(queue);
            } catch (error) {
                console.error(`Error getting queue: ${error.message}`);
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
                        res.json({ success: true, message: 'Queue purged successfully' });
                        return;
                    } catch (amqpError) {
                        this.logger.warn(`Error purging queue via AMQP: ${amqpError.message}. Falling back to HTTP.`);
                    }
                }

                // Fall back to HTTP API
                const encodedVhost = encodeURIComponent(vhost);
                const endpoint = `/api/queues/${encodedVhost}/${name}/purge`;
                await this.httpClient.delete(endpoint);

                res.json({ success: true, message: 'Queue purged successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
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

                await this.httpClient.post(endpoint, data);
                res.json({ success: true, message: 'Message published successfully' });
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

        this._setupQueueInfoApi();
    }

    /**
     * Fetch data from RabbitMQ API with caching
     * @param {string} endpoint - API endpoint
     * @param {string} cacheKey - Cache key
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
     * @param {string} vhost - Virtual host
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

            // Current timestamp if not provided in properties
            const timestamp = msg.properties.timestamp || Date.now();

            messages.push({
                payload: content,
                properties: {
                    ...msg.properties,
                    timestamp: timestamp
                },
                redelivered: msg.fields.redelivered,
                routing_key: msg.fields.routingKey,
                exchange: msg.fields.exchange
            });
        }

        return messages;
    }

    /**
     * Get queue information API endpoint
     * @private
     */
    _setupQueueInfoApi() {
        // Get detailed queue information
        this.router.get('/api/queues/:vhost/:name/info', async (req, res) => {
            try {
                const { vhost, name } = req.params;
                const encodedVhost = encodeURIComponent(vhost);
                const encodedName = encodeURIComponent(name);

                // Get basic queue info from API
                const queueResponse = await this.httpClient.get(`/api/queues/${encodedVhost}/${encodedName}`);
                let queueInfo = queueResponse.data;

                // If AMQP is available, enhance with real-time data
                if (this.isAmqpConnected()) {
                    try {
                        const amqpQueueInfo = await this.amqpChannel.checkQueue(name);

                        // Enhance with more accurate message count and consumer count
                        queueInfo.messages = amqpQueueInfo.messageCount;
                        queueInfo.consumers = amqpQueueInfo.consumerCount;

                        // Add some extra stats
                        queueInfo.stats = {
                            last_checked: new Date().toISOString(),
                            connection_type: 'amqp+http',
                            uptime: this.processUptime ? process.uptime() * 1000 : null
                        };
                    } catch (amqpError) {
                        this.logger.warn(`Error enhancing queue info via AMQP: ${amqpError.message}`);
                        // Add fallback stats
                        queueInfo.stats = {
                            last_checked: new Date().toISOString(),
                            connection_type: 'http-only',
                            error: 'AMQP connection not available for enhanced data'
                        };
                    }
                }

                res.json(queueInfo);
            } catch (error) {
                this.logger.error(`Error getting queue info: ${error.message}`);
                res.status(500).json({ error: error.message });
            }
        });
    }

    /**
     * Enhance queue data with AMQP information
     * @param {Array} queues - Array of queue objects
     * @private
     */
    async _enhanceQueuesData(queues) {
        if (!this.isAmqpConnected() || !queues || !queues.length) {
            return;
        }

        // Process queues in smaller batches to avoid overwhelming the server
        const batchSize = 5;

        for (let i = 0; i < queues.length; i += batchSize) {
            const batch = queues.slice(i, i + batchSize);

            await Promise.all(batch.map(async (queue) => {
                try {
                    // Get queue info via AMQP - just simple stats
                    const queueInfo = await this.amqpChannel.checkQueue(queue.name);

                    // Update only simple numeric properties
                    queue.messages = queueInfo.messageCount;
                    queue.consumers = queueInfo.consumerCount;

                    // Be careful with nested objects
                    if (!queue.message_stats) {
                        queue.message_stats = {};
                    }
                } catch (error) {
                    // Skip errors for individual queues
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
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        this.io.on('connection', (socket) => {
            this.logger.info(`Client connected: ${socket.id}`);
            this.connectedClients.add(socket.id);

            // Send initial connection status
            this._sendConnectionStatus(socket);

            // Set up request handler
            socket.on('request-data', (type) => {
                this._handleDataRequest(socket, type);
            });

            // Set up lightweight periodic updates
            const intervalId = setInterval(() => {
                try {
                    this._sendLightweightUpdates(socket);
                } catch (error) {
                    this.logger.error(`Error in periodic update: ${error.message}`);
                    // Optionally notify the client of the error
                    socket.emit('error', { message: 'Internal server error during update' });
                }
            }, this.config.refreshInterval);

            // Store the interval for cleanup
            this.updateIntervals.set(socket.id, intervalId);

            socket.on('disconnect', () => {
                this.logger.info(`Client disconnected: ${socket.id}`);
                this.connectedClients.delete(socket.id);

                // Clear interval
                if (this.updateIntervals.has(socket.id)) {
                    clearInterval(this.updateIntervals.get(socket.id));
                    this.updateIntervals.delete(socket.id);
                }
            });
        });

        this.logger.info('WebSocket server initialized');
    }

    /**
     * Send connection status to client
     * @param {Object} socket - Socket.IO socket
     * @private
     */
    _sendConnectionStatus(socket) {
        try {
            // Create a new simple object with only primitive values
            // This breaks any circular references that might exist
            const status = {
                http: Boolean(this.httpConnected),
                amqp: Boolean(this.isAmqpConnected()),
                timestamp: new Date().toISOString()
            };

            // Send the safe status object
            socket.emit("connection-status", status);

            // Log successful transmission
            this.logger.debug(`Sent connection status to client ${socket.id}: HTTP=${status.http}, AMQP=${status.amqp}`);
        } catch (error) {
            this.logger.error(`Error sending connection status: ${error.message}`);

            // Try to send a basic version if the detailed one fails
            try {
                socket.emit("connection-status", {
                    http: Boolean(this.httpConnected),
                    amqp: false,
                    timestamp: new Date().toISOString(),
                    error: "Connection status error"
                });
            } catch (backupError) {
                this.logger.error(`Failed to send backup connection status: ${backupError.message}`);
            }
        }
    }

    /**
     * Send lightweight updates to client
     * @param {Object} socket - Socket.IO socket
     * @private
     */
    async _sendLightweightUpdates(socket) {
        try {
            // Always send connection status
            this._sendConnectionStatus(socket);

            // Send lightweight queue data
            try {
                const queues = await this.fetchFromRabbitMQ('/api/queues', 'queues');

                // Map to essential data only
                const lightQueueData = queues.map(queue => ({
                    name: queue.name,
                    vhost: queue.vhost,
                    state: queue.state,
                    messages: queue.messages,
                    consumers: queue.consumers
                }));

                socket.emit('rabbitmq-data', {
                    queues: lightQueueData,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                this.logger.debug(`Error sending lightweight queue data: ${error.message}`);
            }
        } catch (error) {
            this.logger.error(`Error in lightweight updates: ${error.message}`);
        }
    }

    /**
     * Handle data request from client
     * @param {Object} socket - Socket.IO socket
     * @param {string} type - Type of data requested
     * @private
     */
    async _handleDataRequest(socket, type) {
        try {
            switch (type) {
                case 'overview':
                    await this._sendOverviewData(socket);
                    break;

                case 'queues':
                    await this._sendQueuesData(socket);
                    break;

                case 'exchanges':
                    await this._sendExchangesData(socket);
                    break;

                case 'bindings':
                    await this._sendBindingsData(socket);
                    break;

                case 'all':
                    // Send each type separately to avoid large objects
                    await this._sendOverviewData(socket);
                    await this._sendQueuesData(socket);
                    await this._sendExchangesData(socket);
                    break;

                default:
                    this.logger.warn(`Unknown data type requested: ${type}`);
            }
        } catch (error) {
            this.logger.error(`Error handling data request for ${type}: ${error.message}`);
            socket.emit('rabbitmq-error', {
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Send overview data to client
     * @param {Object} socket - Socket.IO socket
     * @private
     */
    async _sendOverviewData(socket) {
        try {
            const overview = await this.fetchFromRabbitMQ('/api/overview', 'overview');

            // Get system uptime from node process if available
            const processUptime = process.uptime() * 1000; // Convert to milliseconds

            // Create an enhanced overview with uptime information
            const enhancedOverview = {
                ...overview,
                // Add uptime in milliseconds (if not already present)
                uptime: overview.uptime || processUptime,
                // Also add a more explicit property name as a backup
                uptime_in_ms: overview.uptime || processUptime,
                // Server information additional fields
                server_info: {
                    ...(overview.server_info || {}),
                    process_uptime_ms: processUptime,
                    start_time: new Date(Date.now() - processUptime).toISOString()
                }
            };

            // Create a simplified version with only what's needed
            const simpleOverview = {
                rabbitmq_version: enhancedOverview.rabbitmq_version,
                erlang_version: enhancedOverview.erlang_version,
                uptime: enhancedOverview.uptime,
                uptime_in_ms: enhancedOverview.uptime_in_ms,
                server_info: enhancedOverview.server_info,
                queue_totals: enhancedOverview.queue_totals,
                object_totals: enhancedOverview.object_totals,
                message_stats: enhancedOverview.message_stats ? {
                    publish: enhancedOverview.message_stats.publish,
                    publish_details: enhancedOverview.message_stats.publish_details ? {
                        rate: enhancedOverview.message_stats.publish_details.rate
                    } : undefined,
                    deliver: enhancedOverview.message_stats.deliver,
                    deliver_details: enhancedOverview.message_stats.deliver_details ? {
                        rate: enhancedOverview.message_stats.deliver_details.rate
                    } : undefined
                } : undefined
            };

            socket.emit('rabbitmq-data', {
                overview: simpleOverview,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error(`Error sending overview data: ${error.message}`);
            socket.emit('rabbitmq-error', {
                message: `Failed to fetch overview data: ${error.message}`,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Send queues data to client
     * @param {Object} socket - Socket.IO socket
     * @private
     */
    async _sendQueuesData(socket) {
        try {
            const queues = await this.fetchFromRabbitMQ('/api/queues', 'queues');

            // Enhance with AMQP data if available
            if (this.isAmqpConnected()) {
                await this._enhanceQueuesData(queues);
            }

            // Extract essential data
            const essentialQueues = queues.map(queue => this._extractQueueEssentials(queue));

            socket.emit('rabbitmq-data', {
                queues: essentialQueues,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error(`Error sending queues data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send exchanges data to client
     * @param {Object} socket - Socket.IO socket
     * @private
     */
    async _sendExchangesData(socket) {
        try {
            const exchanges = await this.fetchFromRabbitMQ('/api/exchanges', 'exchanges');

            // Extract essential data
            const essentialExchanges = exchanges.map(exchange => this._extractExchangeEssentials(exchange));

            socket.emit('rabbitmq-data', {
                exchanges: essentialExchanges,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error(`Error sending exchanges data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send bindings data to client
     * @param {Object} socket - Socket.IO socket
     * @private
     */
    async _sendBindingsData(socket) {
        try {
            const bindings = await this.fetchFromRabbitMQ('/api/bindings', 'bindings');

            socket.emit('rabbitmq-data', {
                bindings,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error(`Error sending bindings data: ${error.message}`);
            throw error;
        }
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

        // Mount the router
        this.app.use(this.config.basePath, this.router);

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