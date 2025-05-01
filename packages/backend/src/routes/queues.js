// src/routes/queues.js
const express = require('express');

/**
 * Create queue routes
 * @param {Object} deps - Dependencies
 * @returns {Object} Express router
 */
function createQueuesRoutes(deps) {
    const { httpClient, amqpClient, logger } = deps;
    const router = express.Router();

    /**
     * @route GET /api/queues
     * @description Get all queues
     */
    router.get('/queues', async (req, res) => {
        try {
            const data = await httpClient.get('/api/queues', 'queues');

            // Enhance queue data with AMQP if available
            if (amqpClient && amqpClient.isChannelAvailable()) {
                await enhanceQueuesWithAmqpData(data);
            }

            res.json(data);
        } catch (error) {
            logger.error('Error fetching queues:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @route GET /api/queues/:vhost/:name
     * @description Get a specific queue
     */
    router.get('/queues/:vhost/:name', async (req, res) => {
        try {
            const { vhost, name } = req.params;
            const encodedVhost = encodeURIComponent(vhost);
            const encodedName = encodeURIComponent(name);

            const data = await httpClient.get(`/api/queues/${encodedVhost}/${encodedName}`);

            // Enhance with AMQP data if available
            if (amqpClient && amqpClient.isChannelAvailable()) {
                try {
                    const queueInfo = await amqpClient.getQueueInfo(name);
                    data.amqp_details = queueInfo;
                } catch (amqpError) {
                    logger.warn(`Could not enhance queue ${name} with AMQP data:`, amqpError.message);
                }
            }

            res.json(data);
        } catch (error) {
            logger.error('Error fetching queue details:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @route GET /api/queues/:vhost/:name/get
     * @description Get messages from a queue
     */
    router.get('/queues/:vhost/:name/get', async (req, res) => {
        try {
            const { vhost, name } = req.params;
            let messages = [];

            // Try AMQP first if available (more reliable)
            if (amqpClient && amqpClient.isChannelAvailable()) {
                try {
                    messages = await amqpClient.getMessages(vhost, name, 10);
                    logger.info(`Retrieved ${messages.length} messages from queue ${name} via AMQP`);
                } catch (amqpError) {
                    logger.warn(`Error getting messages via AMQP: ${amqpError.message}. Falling back to HTTP API.`);
                    messages = await getMessagesViaHttp(vhost, name);
                }
            } else {
                // Fall back to HTTP API
                messages = await getMessagesViaHttp(vhost, name);
            }

            res.json(messages);
        } catch (error) {
            logger.error('Error getting queue messages:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @route POST /api/queues/:vhost/:name/purge
     * @description Purge a queue
     */
    router.post('/queues/:vhost/:name/purge', async (req, res) => {
        try {
            const { vhost, name } = req.params;

            // Try AMQP first if available
            if (amqpClient && amqpClient.isChannelAvailable()) {
                try {
                    await amqpClient.purgeQueue(name);
                    logger.info(`Queue ${name} purged successfully via AMQP`);
                    res.json({ success: true, message: 'Queue purged successfully' });
                    return;
                } catch (amqpError) {
                    logger.warn(`Error purging queue via AMQP: ${amqpError.message}. Falling back to HTTP API.`);
                }
            }

            // Fall back to HTTP API
            const encodedVhost = encodeURIComponent(vhost);
            const endpoint = `/api/queues/${encodedVhost}/${name}/purge`;
            await httpClient.post(endpoint, {});

            logger.info(`Queue ${name} purged successfully via HTTP API`);
            res.json({ success: true, message: 'Queue purged successfully' });
        } catch (error) {
            logger.error('Error purging queue:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    // Helper functions

    /**
     * Get messages from a queue via HTTP API
     * @param {string} vhost - Virtual host
     * @param {string} name - Queue name
     * @returns {Promise<Array>} Array of message objects
     */
    async function getMessagesViaHttp(vhost, name) {
        const encodedVhost = encodeURIComponent(vhost);
        const endpoint = `/api/queues/${encodedVhost}/${name}/get`;

        const data = await httpClient.post(endpoint, {
            count: 10,
            requeue: true,
            encoding: 'auto',
            truncate: 50000
        });

        return data;
    }

    /**
     * Enhance queue data with AMQP information
     * @param {Array} queues - Array of queue objects
     */
    async function enhanceQueuesWithAmqpData(queues) {
        if (!amqpClient || !amqpClient.isChannelAvailable()) return;

        // Process queues in batches to avoid overwhelming the server
        const batchSize = 10;
        for (let i = 0; i < queues.length; i += batchSize) {
            const batch = queues.slice(i, i + batchSize);

            await Promise.all(batch.map(async (queue) => {
                try {
                    const queueInfo = await amqpClient.getQueueInfo(queue.name);

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
                    logger.debug(`Could not enhance queue ${queue.name} with AMQP data: ${error.message}`);
                }
            }));
        }
    }

    return router;
}

module.exports = createQueuesRoutes;