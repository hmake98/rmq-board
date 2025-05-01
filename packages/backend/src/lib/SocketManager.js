// src/lib/SocketManager.js
const socketIo = require('socket.io');
const EventEmitter = require('events');

/**
 * SocketManager class for handling WebSocket connections
 * @extends EventEmitter
 */
class SocketManager extends EventEmitter {
    /**
     * Create a new SocketManager
     * @param {Object} server - HTTP server instance
     * @param {Object} config - Configuration object from loadConfig()
     * @param {Object} logger - Logger instance
     */
    constructor(server, config, logger) {
        super();

        if (!server) {
            throw new Error('HTTP server is required for SocketManager');
        }

        this.server = server;
        this.config = config;
        this.logger = logger;
        this.io = null;
        this.connectedClients = new Set();
        this.updateIntervals = new Map();

        // Initialize socket.io
        this.init();
    }

    /**
     * Initialize socket.io and set up event handlers
     */
    init() {
        // Make sure basePath for socket.io is correctly formatted
        const socketPath = `${this.config.basePath}socket.io`.replace(/\/+/g, '/');

        // Initialize socket.io with proper configuration
        this.io = socketIo(this.server, {
            path: socketPath,
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        // Set up connection handler
        this.io.on('connection', this.handleConnection.bind(this));

        this.logger.info('WebSocket server initialized');
    }

    /**
     * Handle new client connection
     * @param {Object} socket - Socket instance
     */
    handleConnection(socket) {
        this.logger.info(`Client connected: ${socket.id}`);
        this.connectedClients.add(socket.id);

        // Emit connection event for other components to listen
        this.emit('client-connected', socket);

        // Send initial connection status
        socket.emit('connection-status', {
            connected: true,
            timestamp: new Date().toISOString()
        });

        // Set up disconnect handler
        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });

        // Set up custom event handlers
        socket.on('request-data', (type) => {
            this.emit('data-requested', { type, socket });
        });
    }

    /**
     * Handle client disconnection
     * @param {Object} socket - Socket instance
     */
    handleDisconnect(socket) {
        this.logger.info(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);

        // Clear any update intervals for this client
        if (this.updateIntervals.has(socket.id)) {
            clearInterval(this.updateIntervals.get(socket.id));
            this.updateIntervals.delete(socket.id);
        }

        // Emit disconnect event for other components
        this.emit('client-disconnected', socket.id);
    }

    /**
     * Start sending periodic updates to a client
     * @param {Object} socket - Socket instance
     * @param {string} eventName - Event name to emit
     * @param {Function} dataProvider - Function that returns data to send
     * @param {number} interval - Update interval in milliseconds
     */
    startPeriodicUpdates(socket, eventName, dataProvider, interval = null) {
        // Use configured refresh interval if not specified
        const updateInterval = interval || this.config.refreshInterval;

        // Clear any existing interval for this socket
        if (this.updateIntervals.has(socket.id)) {
            clearInterval(this.updateIntervals.get(socket.id));
        }

        // Initial update immediately
        this.sendUpdate(socket, eventName, dataProvider);

        // Set up interval for periodic updates
        const intervalId = setInterval(() => {
            this.sendUpdate(socket, eventName, dataProvider);
        }, updateInterval);

        // Store interval ID for cleanup
        this.updateIntervals.set(socket.id, intervalId);
    }

    /**
     * Send a single update to a client
     * @param {Object} socket - Socket instance
     * @param {string} eventName - Event name to emit
     * @param {Function} dataProvider - Function that returns data to send
     */
    async sendUpdate(socket, eventName, dataProvider) {
        try {
            // Make sure socket is still connected
            if (!socket.connected) {
                this.logger.debug(`Socket ${socket.id} disconnected, skipping update`);
                return;
            }

            // Get data and send to client
            const data = await dataProvider();
            socket.emit(eventName, {
                ...data,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error(`Error sending ${eventName} update: ${error.message}`);

            // Only send error if socket is connected
            if (socket.connected) {
                socket.emit('error', {
                    message: `Failed to update ${eventName}: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Broadcast data to all connected clients
     * @param {string} eventName - Event name to emit
     * @param {Object} data - Data to send
     */
    broadcast(eventName, data) {
        if (!this.io) {
            this.logger.warn('Attempted to broadcast but WebSocket server not initialized');
            return;
        }

        this.io.emit(eventName, {
            ...data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Broadcast connection status update
     * @param {Object} status - Connection status object
     */
    broadcastConnectionStatus(status) {
        this.broadcast('connection-status', status);
    }

    /**
     * Get client count
     * @returns {number} Number of connected clients
     */
    getClientCount() {
        return this.connectedClients.size;
    }

    /**
     * Shutdown socket server
     */
    async shutdown() {
        this.logger.info('Shutting down WebSocket server...');

        // Clear all update intervals
        for (const [socketId, intervalId] of this.updateIntervals.entries()) {
            clearInterval(intervalId);
        }
        this.updateIntervals.clear();

        // Notify clients of shutdown
        if (this.io) {
            this.broadcast('server-shutdown', { message: 'Server shutting down' });

            // Disconnect all clients
            for (const socketId of this.connectedClients) {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.disconnect(true);
                }
            }

            // Close server
            return new Promise((resolve) => {
                this.io.close(() => {
                    this.logger.info('WebSocket server closed');
                    this.io = null;
                    resolve();
                });
            });
        }

        return Promise.resolve();
    }
}

module.exports = SocketManager;