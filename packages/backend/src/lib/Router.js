// src/lib/Router.js
const express = require('express');
const path = require('path');
const fs = require('fs');

/**
 * Router class for managing Express routes
 */
class Router {
    /**
     * Create a new Router
     * @param {Object} config - Configuration options
     * @param {Object} logger - Logger instance
     * @param {Object} deps - Dependencies (httpClient, amqpClient)
     */
    constructor(config, logger, deps) {
        this.config = config;
        this.logger = logger;
        this.deps = deps;
        this.router = express.Router();

        // Set up routes
        this.setupMiddleware();
        this.setupViews();
        this.setupStaticFiles();
        this.setupRoutes();
        this.setupErrorHandlers();
    }

    /**
     * Set up middleware
     */
    setupMiddleware() {
        // JSON and URL-encoded request parsing
        this.router.use(express.json());
        this.router.use(express.urlencoded({ extended: true }));

        // CORS headers
        this.router.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }
            next();
        });

        // Request logging
        this.router.use((req, res, next) => {
            this.logger.debug(`${req.method} ${req.originalUrl}`);
            next();
        });
    }

    /**
     * Set up view engine
     */
    setupViews() {
        // Views will be set on the main app, not the router
    }

    /**
     * Set up static file serving
     */
    setupStaticFiles() {
        this.router.use('/static', express.static(path.join(__dirname, '../../public')));
    }

    /**
     * Set up API routes
     */
    setupRoutes() {
        // Set up main route handlers
        this.setupMainRoutes();
        this.setupApiRoutes();
    }

    /**
     * Set up main routes
     */
    setupMainRoutes() {
        // Main dashboard route
        this.router.get('/', (req, res) => {
            res.render('dashboard', {
                title: 'RabbitMQ Board',
                basePath: this.config.basePath
            });
        });
    }

    /**
     * Set up API routes
     */
    setupApiRoutes() {
        // Load routes from routes directory
        const { httpClient, amqpClient } = this.deps;

        // Import route modules
        const routesPath = path.join(__dirname, '..', 'routes');
        const routeFiles = fs.readdirSync(routesPath)
            .filter(file => file !== 'index.js' && file.endsWith('.js'));

        // Load and mount each route module
        routeFiles.forEach(file => {
            try {
                const routeModule = require(path.join(routesPath, file));
                const routePath = file === 'index.js' ? '/' : `/${file.replace('.js', '')}`;

                // Mount the route with dependencies
                const router = routeModule({
                    httpClient,
                    amqpClient,
                    config: this.config,
                    logger: this.logger
                });

                // If the module returned a router, mount it
                if (router && typeof router.use === 'function') {
                    this.router.use('/api', router);
                }
            } catch (error) {
                this.logger.error(`Error loading route module ${file}:`, error.message);
            }
        });

        // Health check endpoint
        this.router.get('/api/health', async (req, res) => {
            const health = {
                status: 'UP',
                amqp: amqpClient && amqpClient.isChannelAvailable() ? 'CONNECTED' : 'DISCONNECTED',
                http: true, // We'll test this below
                timestamp: new Date().toISOString()
            };

            try {
                // Quick test of the HTTP API
                await httpClient.get('/api/overview', null, 0);
            } catch (error) {
                health.http = false;
                health.status = 'DEGRADED';
            }

            if (!health.amqp && !health.http) {
                health.status = 'DOWN';
            }

            res.json(health);
        });
    }

    /**
     * Set up error handlers
     */
    setupErrorHandlers() {
        // 404 handler
        this.router.use((req, res, next) => {
            res.status(404).json({ error: 'Not Found' });
        });

        // Error handler
        this.router.use((err, req, res, next) => {
            this.logger.error('Express error:', err.message);
            res.status(err.status || 500).json({
                error: {
                    message: err.message || 'Internal Server Error',
                    status: err.status || 500
                }
            });
        });
    }

    /**
     * Get the configured router
     * @returns {Object} Express router
     */
    getRouter() {
        return this.router;
    }
}

module.exports = Router;