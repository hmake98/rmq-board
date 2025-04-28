// index.js
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

class RabbitMQAdmin {
    constructor(options = {}) {
        this.options = {
            rabbitMQUrl: options.rabbitMQUrl || 'http://localhost:15672',
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
        this.setupRoutes();
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
                const data = await this.fetchFromRabbitMQ('/api/overview');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.router.get('/api/queues', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/queues');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.router.get('/api/exchanges', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/exchanges');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.router.get('/api/bindings', async (req, res) => {
            try {
                const data = await this.fetchFromRabbitMQ('/api/bindings');
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // View message in a queue
        this.router.get('/api/queues/:vhost/:name/get', async (req, res) => {
            try {
                const { vhost, name } = req.params;
                const encodedVhost = encodeURIComponent(vhost);
                const endpoint = `/api/queues/${encodedVhost}/${name}/get`;

                const data = await this.postToRabbitMQ(endpoint, {
                    count: 10,
                    requeue: true,
                    encoding: 'auto'
                });

                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async fetchFromRabbitMQ(endpoint) {
        try {
            const url = `${this.options.rabbitMQUrl}${endpoint}`;
            const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error(`Error fetching from RabbitMQ (${endpoint}):`, error.message);
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
                }
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

    startSendingUpdates(socket) {
        // Function to fetch and send data
        const sendUpdates = async () => {
            try {
                // Fetch overview, queues and exchanges data
                const [overview, queues, exchanges] = await Promise.all([
                    this.fetchFromRabbitMQ('/api/overview'),
                    this.fetchFromRabbitMQ('/api/queues'),
                    this.fetchFromRabbitMQ('/api/exchanges')
                ]);

                // Send to client
                socket.emit('rabbitmq-data', { overview, queues, exchanges });
            } catch (error) {
                console.error('Error sending RabbitMQ updates:', error.message);
                socket.emit('rabbitmq-error', { message: error.message });
            }
        };

        // Initial data
        sendUpdates();

        // Set up interval for regular updates
        const intervalId = setInterval(sendUpdates, this.options.refreshInterval);

        // Clear interval when socket disconnects
        socket.on('disconnect', () => {
            clearInterval(intervalId);
        });
    }

    // Method to mount to an existing Express app
    mountApp(app, appServer = null) {
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

        return this.router;
    }

    // Method to create a standalone server
    createServer(port = 3000) {
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

        // Start server
        this.server.listen(port, () => {
            console.log(`RabbitMQ Admin UI running at http://localhost:${port}${this.options.basePath}`);
        });

        return {
            app: this.app,
            server: this.server
        };
    }
}

module.exports = RabbitMQAdmin;