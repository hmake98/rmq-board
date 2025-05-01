# RMQ Board Backend

The backend component of RMQ Board, providing a REST API and WebSocket interface for RabbitMQ management and monitoring.

## Features

- **REST API** - Complete API for managing RabbitMQ resources
- **WebSocket Updates** - Real-time updates via Socket.IO
- **AMQP Integration** - Direct AMQP connection for enhanced reliability
- **HTTP API Integration** - Uses RabbitMQ Management HTTP API
- **Caching** - Smart caching for improved performance

## Installation

```bash
# From the project root
npm install

# Or specifically for the backend
cd packages/backend
npm install
```

## Running in Development Mode

```bash
# From the project root
npm run backend

# Or from the backend directory
cd packages/backend
npm run dev
```

## Environment Variables

Create a `.env` file in the `packages/backend` directory:

```
# Core connection setting - can be HTTP or AMQP URL
RABBITMQ_URL=amqp://guest:guest@localhost:5672/

# Optional settings
SSL_VERIFY=false
PORT=3001
LOG_LEVEL=debug
REFRESH_INTERVAL=10000
# SKIP_AMQP_CONNECTION=false
```

## API Endpoints

### Overview
- `GET /api/overview` - Get RabbitMQ server overview

### Queues
- `GET /api/queues` - List all queues
- `GET /api/queues/:vhost/:name` - Get queue details
- `GET /api/queues/:vhost/:name/get` - Get messages from queue
- `POST /api/queues/:vhost/:name/purge` - Purge a queue

### Exchanges
- `GET /api/exchanges` - List all exchanges
- `GET /api/exchanges/:vhost/:name` - Get exchange details
- `POST /api/exchanges/:vhost/:name/publish` - Publish a message

### Bindings
- `GET /api/bindings` - List all bindings

### Health
- `GET /api/health` - Health check endpoint

## WebSocket Events

### Server to Client
- `connection-status` - Connection status update
- `rabbitmq-data` - RabbitMQ data update (overview, queues, exchanges)
- `rabbitmq-error` - Error message
- `server-shutdown` - Server is shutting down

### Client to Server
- `disconnect` - Client disconnects
- `request-data` - Request specific data type

## Architecture

```
src/
├── lib/                # Core library files
│   ├── AmqpClient.js   # AMQP connection handler
│   ├── HttpClient.js   # HTTP API client
│   ├── Logger.js       # Logging utility
│   ├── RabbitMQAdmin.js # Main application class
│   ├── Router.js       # Express router
│   └── SocketManager.js # WebSocket manager
├── routes/             # API route handlers
│   ├── index.js        # Main routes
│   └── queues.js       # Queue-specific routes
├── utils/              # Utility functions
│   ├── config.js       # Configuration loader
│   └── helpers.js      # Helper functions
└── server.js           # Server entry point
```

## Usage as Middleware

You can use RMQ Board as middleware in your existing Express application:

```javascript
const express = require('express');
const http = require('http');
const RabbitMQAdmin = require('@rmq-board/backend');

const app = express();
const server = http.createServer(app);

// Create a new instance
const admin = new RabbitMQAdmin({
  rabbitMQUrl: 'http://localhost:15672',
  amqpUrl: 'amqp://localhost:5672',
  username: 'guest',
  password: 'guest',
  basePath: '/rabbitmq' // This will mount the UI at /rabbitmq
});

// Mount to your existing Express app
admin.mountApp(app, server);

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Docker

The backend can be run in Docker:

```bash
# Build from project root
docker build -f Dockerfile.backend -t rmq-board-backend .

# Run
docker run -p 3001:3001 \
  -e RABBITMQ_URL=amqp://guest:guest@host.docker.internal:5672/ \
  rmq-board-backend
```

## Testing

```bash
npm test
```

## License

MIT