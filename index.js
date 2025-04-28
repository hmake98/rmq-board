// index.js
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const amqp = require('amqplib');

class RabbitMQAdmin {
    constructor(options = {}) {
        this.options = {
            rabbitMQUrl: options.rabbitMQUrl || 'http://localhost:15672',
            amqpUrl: options.amqpUrl || 'amqp://localhost:5672',
            username: options.username || 'guest',
            password: options.password || 'guest',
            refreshInterval: options.refreshInterval || 5000, // 5 seconds
            basePath: options.basePath || '/rabbitmq-admin',
            ...options
        };

        this.app = null;
        this.server = null;
        this.io = null;
        this.router = express.Router();
        this.amqpConnection = null;
        this.amqpChannel = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryTimeout = 3000; // 3 seconds initial retry timeout

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

        this.setupRoutes();
    }

    async connect() {
        try {
            // Connect to RabbitMQ via AMQP
            const amqpConnectionString = this.buildAmqpConnectionString();
            this.amqpConnection = await amqp.connect(amqpConnectionString);
            this.amqpChannel = await this.amqpConnection.createChannel();

            // Reset retry counter on successful connection
            this.retryCount = 0;

            // Setup connection event handlers
            this.amqpConnection.on('error', (err) => {
                console.error('AMQP connection error:', err.message);
                this.reconnect();
            });

            this.amqpConnection.on('close', () => {
                console.log('AMQP connection closed, attempting to reconnect...');
                this.reconnect();
            });

            console.log('Successfully connected to RabbitMQ via AMQP');
            return true;
        } catch (error) {
            console.error('Failed to connect to RabbitMQ via AMQP:', error.message);
            this.reconnect();
            return false;
        }
    }

    buildAmqpConnectionString() {
        // Extract credentials from rabbitMQUrl if not explicitly provided
        const username = this.options.username;
        const password = this.options.password;

        // Parse the AMQP URL or construct it
        let amqpUrl = this.options.amqpUrl;
        if (!amqpUrl.includes('@')) {
            // Add credentials to the URL
            const urlObj = new URL(amqpUrl);
            urlObj.username = username;
            urlObj.password = password;
            amqpUrl = urlObj.toString();
        }

        return amqpUrl;
    }

    reconnect() {
        if (this.retryCount >= this.maxRetries) {
            console.error(`Failed to connect to RabbitMQ after ${this.maxRetries} attempts. Giving up.`);
            return;
        }

        // Exponential backoff
        const timeout = this.retryTimeout * Math.pow(2, this.retryCount);
        this.retryCount++;

        console.log(`Attempting to reconnect to RabbitMQ in ${timeout / 1000} seconds (attempt ${this.retryCount}/${this.maxRetries})...`);

        setTimeout(async () => {
            if (this.amqpConnection) {
                try {
                    // Close the old connection if it's still around
                    await this.amqpConnection.close();
                } catch (e) {
                    // Ignore errors when closing a possibly already closed connection
                }
                this.amqpConnection = null;
                this.amqpChannel = null;
            }

            // Try to connect again
            this.connect();
        }, timeout);
    }

    async closeConnection() {
        if (this.amqpChannel) {
            try {
                await this.amqpChannel.close();
            } catch (e) {
                console.error('Error closing AMQP channel:', e.message);
            }
        }

        if (this.amqpConnection) {
            try {
                await this.amqpConnection.close();
            } catch (e) {
                console.error('Error closing AMQP connection:', e.message);
            }
        }

        this.amqpChannel = null;
        this.amqpConnection = null;
    }

    setupRoutes() {
        // Serve static files
        this.router.use('/static', express.static(path.join(__dirname, 'public')));

        // Main dashboard route
        this.router.get('/', (req, res) => {
            res.render('dashboard', {
                title: 'RabbitMQ Board',
                basePath: this.options.basePath
            });
        });

        // API routes
        this.router.get('/api/overview', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/overview', 'overview');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.router.get('/api/queues', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/queues', 'queues');

                // If we have an AMQP connection, enhance the queue data with additional info
                if (this.amqpChannel) {
                    await this.enhanceQueuesWithAmqpData(data);
                }

                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.router.get('/api/exchanges', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/exchanges', 'exchanges');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.router.get('/api/bindings', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/bindings', 'bindings');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // View message in a queue with improved reliability
        this.router.get('/api/queues/:vhost/:name/get', async (req, res) => {
            try {
                const { vhost, name } = req.params;
                let messages = [];

                // Try to get messages via AMQP connection first (more reliable)
                if (this.amqpChannel) {
                    try {
                        messages = await this.getMessagesViaAmqp(vhost, name, 10);
                    } catch (amqpError) {
                        console.error(`Error getting messages via AMQP: ${amqpError.message}. Falling back to HTTP API.`);
                        // Fall back to HTTP API if AMQP fails
                        messages = await this.getMessagesViaHttp(vhost, name);
                    }
                } else {
                    // No AMQP connection, use HTTP API
                    messages = await this.getMessagesViaHttp(vhost, name);
                }

                res.json(messages);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Purge queue endpoint
        this.router.post('/api/queues/:vhost/:name/purge', async (req, res) => {
            try {
                const { vhost, name } = req.params;
                const encodedVhost = encodeURIComponent(vhost);
                const endpoint = `/api/queues/${encodedVhost}/${name}/purge`;

                // Try AMQP first if available
                if (this.amqpChannel) {
                    try {
                        await this.amqpChannel.purgeQueue(name);
                        res.json({ success: true, message: 'Queue purged successfully' });
                        return;
                    } catch (amqpError) {
                        console.error(`Error purging queue via AMQP: ${amqpError.message}. Falling back to HTTP API.`);
                    }
                }

                // Fall back to HTTP API
                await this.postToRabbitMQ(endpoint, {});
                res.json({ success: true, message: 'Queue purged successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Health check endpoint
        this.router.get('/api/health', async (req, res) => {
            const health = {
                status: 'UP',
                amqp: this.amqpConnection ? 'CONNECTED' : 'DISCONNECTED',
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

        // Publish message to exchange endpoint
        this.router.post('/api/exchanges/:vhost/:name/publish', express.json(), async (req, res) => {
            try {
                const { vhost, name } = req.params;
                const { routingKey, payload, properties } = req.body;

                if (!routingKey || !payload) {
                    return res.status(400).json({ error: 'Routing key and payload are required' });
                }

                // Try AMQP first if available
                if (this.amqpChannel) {
                    try {
                        await this.amqpChannel.publish(
                            name,
                            routingKey,
                            Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
                            properties || {}
                        );
                        res.json({ success: true, message: 'Message published successfully' });
                        return;
                    } catch (amqpError) {
                        console.error(`Error publishing message via AMQP: ${amqpError.message}. Falling back to HTTP API.`);
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
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

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

    async getMessagesViaAmqp(vhost, queueName, count = 10) {
        // Assert the queue exists
        await this.amqpChannel.checkQueue(queueName);

        const messages = [];

        for (let i = 0; i < count; i++) {
            // Get a message, don't acknowledge it (noAck: true)
            const msg = await this.amqpChannel.get(queueName, { noAck: true });

            if (!msg) {
                // No more messages
                break;
            }

            let content = msg.content.toString();

            // Try to parse JSON
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

    async enhanceQueuesWithAmqpData(queues) {
        if (!this.amqpChannel) return;

        // This is a more reliable way to get queue sizes and status
        for (const queue of queues) {
            try {
                const queueInfo = await this.amqpChannel.checkQueue(queue.name);

                // Update with the most accurate info
                queue.messages = queueInfo.messageCount;
                queue.consumers = queueInfo.consumerCount;

                // Add more detailed information
                queue.messages_details = {
                    ...queue.messages_details,
                    current: queueInfo.messageCount
                };

                // Check if queue is idle (no consumers and messages)
                queue.idle = queueInfo.consumerCount === 0 && queueInfo.messageCount === 0;

                // Get message rates using AMQP if possible
                if (!queue.message_stats) {
                    queue.message_stats = {};
                }
            } catch (error) {
                console.warn(`Could not enhance queue ${queue.name} with AMQP data: ${error.message}`);
            }
        }
    }

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
            console.error(`Error fetching from RabbitMQ (${endpoint}):`, error.message);

            // Return cached data if available, even if expired
            if (cacheKey && this.cache[cacheKey]) {
                console.log(`Returning cached data for ${cacheKey} due to API error`);
                return this.cache[cacheKey];
            }

            throw error;
        }
    }

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
            console.error(`Error posting to RabbitMQ (${endpoint}):`, error.message);
            throw error;
        }
    }

    setupWebsockets() {
        this.io = socketIo(this.server);

        this.io.on('connection', (socket) => {
            console.log('Client connected to RabbitMQ Admin UI');

            // Start sending updates
            this.startSendingUpdates(socket);

            socket.on('disconnect', () => {
                console.log('Client disconnected from RabbitMQ Admin UI');
            });
        });
    }

    async startSendingUpdates(socket) {
        // Function to fetch and send data
        const sendUpdates = async () => {
            try {
                // Fetch overview, queues and exchanges data
                const [overview, queues, exchanges] = await Promise.all([
                    this.fetchFromRabbitMQ('/api/overview', 'overview'),
                    this.fetchFromRabbitMQ('/api/queues', 'queues'),
                    this.fetchFromRabbitMQ('/api/exchanges', 'exchanges')
                ]);

                // If we have an AMQP connection, enhance the data
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
                        amqp: !!this.amqpConnection,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (error) {
                console.error('Error sending RabbitMQ updates:', error.message);
                socket.emit('rabbitmq-error', {
                    message: error.message,
                    connectionStatus: {
                        http: false,
                        amqp: !!this.amqpConnection,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        };

        // Initial data
        await sendUpdates();

        // Set up interval for regular updates
        const intervalId = setInterval(sendUpdates, this.options.refreshInterval);

        // Clear interval when socket disconnects
        socket.on('disconnect', () => {
            clearInterval(intervalId);
        });
    }

    // Method to mount to an existing Express app
    async mountApp(app, appServer = null) {
        if (!app) {
            throw new Error('Express app is required');
        }

        this.app = app;

        // Set up view engine
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.set('view engine', 'ejs');

        // Mount the router
        this.app.use(this.options.basePath, this.router);

        // Setup websockets if server is provided
        if (appServer) {
            this.server = appServer;
            this.setupWebsockets();
        }

        // Connect to RabbitMQ via AMQP
        await this.connect();

        return this.router;
    }

    // Method to create a standalone server
    async createServer(port = 3000) {
        this.app = express();

        // Set up view engine
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.set('view engine', 'ejs');

        // Mount the router
        this.app.use(this.options.basePath, this.router);

        // Create HTTP server
        this.server = http.createServer(this.app);

        // Setup websockets
        this.setupWebsockets();

        // Connect to RabbitMQ via AMQP
        await this.connect();

        // Start server
        this.server.listen(port, () => {
            console.log(`RabbitMQ Admin UI running at http://localhost:${port}${this.options.basePath}`);
        });

        return {
            app: this.app,
            server: this.server
        };
    }

    // Graceful shutdown
    async shutdown() {
        console.log('Shutting down RabbitMQ Admin UI...');

        // Close AMQP connection
        await this.closeConnection();

        // Close HTTP server if it exists
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('HTTP server closed');
                    resolve();
                });
            });
        }
    }
}

module.exports = RabbitMQAdmin;