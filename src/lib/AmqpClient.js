// src/lib/AmqpClient.js
// AMQP Connection management
const amqp = require('amqplib');
const EventEmitter = require('events');
const { buildAmqpConnectionString } = require('../utils/config');

/**
 * AmqpClient class for managing RabbitMQ AMQP connections
 * @extends EventEmitter
 */
class AmqpClient extends EventEmitter {
    /**
     * Create a new AmqpClient
     * @param {Object} config - Configuration options
     * @param {Object} logger - Logger instance
     */
    constructor(config, logger) {
        super();

        this.config = config;
        this.logger = logger;
        this.connection = null;
        this.channel = null;
        this.isConnecting = false;
        this.retryCount = 0;
        this.reconnectTimer = null;

        // Bind methods to maintain this context
        this.connect = this.connect.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.close = this.close.bind(this);
    }

    /**
     * Connect to RabbitMQ via AMQP
     * @returns {Promise<boolean>} Success status
     */
    async connect() {
        if (this.isConnecting) {
            this.logger.debug('AMQP connection attempt already in progress');
            return false;
        }

        this.isConnecting = true;

        try {
            // Build connection string with credentials
            const amqpConnectionString = buildAmqpConnectionString(this.config);

            this.logger.info('Connecting to RabbitMQ via AMQP...');
            this.connection = await amqp.connect(amqpConnectionString);
            this.channel = await this.connection.createChannel();

            // Reset retry counter on successful connection
            this.retryCount = 0;
            this.isConnecting = false;

            // Set up connection event handlers
            this.connection.on('error', (err) => {
                this.logger.error('AMQP connection error:', err.message);
                this.emit('error', err);
                this.reconnect();
            });

            this.connection.on('close', () => {
                if (this.connection) { // Only reconnect if not deliberately closed
                    this.logger.info('AMQP connection closed, attempting to reconnect...');
                    this.emit('close');
                    this.reconnect();
                }
            });

            // Signal successful connection
            this.emit('connected');
            this.logger.info('Successfully connected to RabbitMQ via AMQP');

            return true;
        } catch (error) {
            this.isConnecting = false;
            this.logger.error('Failed to connect to RabbitMQ via AMQP:', error.message);
            this.emit('error', error);
            this.reconnect();
            return false;
        }
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    reconnect() {
        if (this.isConnecting || this.reconnectTimer) {
            return;
        }

        if (this.retryCount >= this.config.maxRetries) {
            this.logger.error(`Failed to connect to RabbitMQ after ${this.config.maxRetries} attempts. Giving up.`);
            this.emit('max-retries-exceeded');
            return;
        }

        // Exponential backoff with jitter
        const baseTimeout = this.config.retryTimeout * Math.pow(2, this.retryCount);
        const jitter = Math.floor(Math.random() * 1000); // Add up to 1 second of jitter
        const timeout = baseTimeout + jitter;

        this.retryCount++;

        this.logger.info(`Attempting to reconnect to RabbitMQ in ${(timeout / 1000).toFixed(1)} seconds (attempt ${this.retryCount}/${this.config.maxRetries})...`);

        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;

            // Close existing connections if they exist
            if (this.connection) {
                try {
                    await this.close();
                } catch (e) {
                    // Ignore errors when closing possibly already closed connections
                }
            }

            // Try to connect again
            this.connect();
        }, timeout);

        // Emit reconnecting event
        this.emit('reconnecting', this.retryCount, timeout);
    }

    /**
     * Check if channel is available
     * @returns {boolean} Whether channel is available
     */
    isChannelAvailable() {
        return !!(this.channel && this.connection);
    }

    /**
     * Close the connection and channel
     * @returns {Promise<void>}
     */
    async close() {
        // Clear any reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.channel) {
            try {
                this.logger.debug('Closing AMQP channel...');
                await this.channel.close();
                this.logger.debug('AMQP channel closed');
            } catch (e) {
                this.logger.warn('Error closing AMQP channel:', e.message);
            } finally {
                this.channel = null;
            }
        }

        if (this.connection) {
            try {
                this.logger.debug('Closing AMQP connection...');
                await this.connection.close();
                this.logger.debug('AMQP connection closed');
            } catch (e) {
                this.logger.warn('Error closing AMQP connection:', e.message);
            } finally {
                this.connection = null;
            }
        }

        // Signal connection closed
        this.emit('disconnected');
    }

    /**
     * Get messages from a queue via AMQP
     * @param {string} vhost - Virtual host
     * @param {string} queueName - Queue name
     * @param {number} count - Maximum number of messages to get
     * @returns {Promise<Array>} Array of message objects
     */
    async getMessages(vhost, queueName, count = 10) {
        if (!this.isChannelAvailable()) {
            throw new Error('AMQP channel not available');
        }

        // Assert the queue exists
        await this.channel.checkQueue(queueName);

        const messages = [];

        for (let i = 0; i < count; i++) {
            // Get a message, don't acknowledge it (noAck: true means auto-ack)
            const msg = await this.channel.get(queueName, { noAck: true });

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
     * Purge a queue
     * @param {string} queueName - Queue name
     * @returns {Promise<Object>} Result
     */
    async purgeQueue(queueName) {
        if (!this.isChannelAvailable()) {
            throw new Error('AMQP channel not available');
        }

        return await this.channel.purgeQueue(queueName);
    }

    /**
     * Publish a message to an exchange
     * @param {string} exchange - Exchange name
     * @param {string} routingKey - Routing key
     * @param {string|Object} payload - Message payload
     * @param {Object} properties - Message properties
     * @returns {Promise<boolean>} Success status
     */
    async publishMessage(exchange, routingKey, payload, properties = {}) {
        if (!this.isChannelAvailable()) {
            throw new Error('AMQP channel not available');
        }

        const content = Buffer.from(
            typeof payload === 'string' ? payload : JSON.stringify(payload)
        );

        return this.channel.publish(exchange, routingKey, content, properties);
    }

    /**
     * Get detailed information about a queue
     * @param {string} queueName - Queue name
     * @returns {Promise<Object>} Queue details
     */
    async getQueueInfo(queueName) {
        if (!this.isChannelAvailable()) {
            throw new Error('AMQP channel not available');
        }

        return await this.channel.checkQueue(queueName);
    }
}

module.exports = AmqpClient;