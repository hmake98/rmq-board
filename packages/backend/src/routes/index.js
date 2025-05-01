// src/routes/index.js
const express = require('express');

/**
 * Create routes for the API
 * @param {Object} deps - Dependencies
 * @returns {Object} Express router
 */
function createRoutes(deps) {
    const router = express.Router();

    // Health check route
    router.get('/health', (req, res) => {
        const { amqpClient, httpClient } = deps;

        const health = {
            status: 'UP',
            amqp: amqpClient && amqpClient.isChannelAvailable() ? 'CONNECTED' : 'DISCONNECTED',
            http: true,
            timestamp: new Date().toISOString()
        };

        if (!health.amqp) {
            health.status = 'DEGRADED';
        }

        res.json(health);
    });

    return router;
}

module.exports = createRoutes;