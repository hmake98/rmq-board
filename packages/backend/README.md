# RMQ Board Backend

The backend component of RMQ Board, providing a powerful REST API and WebSocket interface for RabbitMQ management and monitoring.

## Features

- **Complete REST API** - Full API for managing RabbitMQ resources
- **Real-time WebSocket Updates** - Live data updates via Socket.IO
- **Dual Connection Modes**:
  - **AMQP Integration** - Direct AMQP connection for enhanced reliability and performance
  - **HTTP API Integration** - Uses RabbitMQ Management HTTP API for complete feature coverage
- **Smart Caching** - Improved performance with intelligent caching
- **Auto-reconnect** - Resilient connections with exponential backoff
- **Comprehensive Logging** - Detailed logging with Winston
- **Security** - Built-in security features with rate limiting and Helmet

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

### Configuration Details

| Variable               | Description                        | Default                              | Notes                                     |
| ---------------------- | ---------------------------------- | ------------------------------------ | ----------------------------------------- |
| `RABBITMQ_URL`         | Connection URL for RabbitMQ        | `amqp://guest:guest@localhost:5672/` | Can be AMQP or HTTP URL                   |
| `SSL_VERIFY`           | Whether to verify SSL certificates | `true`                               | Set to `false` for self-signed certs      |
| `PORT`                 | Port for the server                | `3001`                               |                                           |
| `LOG_LEVEL`            | Logging verbosity                  | `info`                               | Options: `debug`, `info`, `warn`, `error` |
| `REFRESH_INTERVAL`     | Data refresh interval (ms)         | `10000`                              |                                           |
| `SKIP_AMQP_CONNECTION` | Use HTTP-only mode                 | `false`                              | Set to `true` to disable AMQP             |
| `MAX_RETRIES`          | Max reconnection attempts          | `5`                                  |                                           |
| `RETRY_TIMEOUT`        | Initial reconnection timeout (ms)  | `5000`                               |                                           |
| `BASE_PATH`            | Base path for the API              | `/`                                  |                                           |

## API Endpoints

### Overview
- `GET /api/overview` - Get RabbitMQ server overview
```json
// Example response
{
  "rabbitmq_version": "3.11.2",
  "erlang_version": "25.1.2",
  "message_stats": {
    "publish": 1234,
    "publish_details": { "rate": 20.5 },
    "deliver": 1000,
    "deliver_details": { "rate": 18.2 }
  },
  "queue_totals": {
    "messages": 500,
    "messages_ready": 450,
    "messages_unacknowledged": 50
  },
  "object_totals": {
    "connections": 5,
    "channels": 10,
    "exchanges": 12,
    "queues": 8,
    "consumers": 15
  }
}
```

### Queues
- `GET /api/queues` - List all queues
```json
// Example response
[
  {
    "name": "my-queue",
    "vhost": "/",
    "durable": true,
    "auto_delete": false,
    "exclusive": false,
    "state": "running",
    "consumers": 2,
    "messages": 42,
    "messages_ready": 40,
    "messages_unacknowledged": 2
  }
]
```

- `GET /api/queues/:vhost/:name` - Get queue details
- `GET /api/queues/:vhost/:name/get` - Get messages from queue
```json
// Example response
[
  {
    "payload": { "message": "Hello, world!" },
    "properties": {
      "content_type": "application/json",
      "message_id": "m-123",
      "timestamp": 1641234567890
    },
    "routing_key": "my-key",
    "exchange": "my-exchange",
    "redelivered": false
  }
]
```

- `POST /api/queues/:vhost/:name/purge` - Purge a queue
```json
// Example request
// No request body needed

// Example response
{
  "success": true,
  "message": "Queue purged successfully"
}
```

### Exchanges
- `GET /api/exchanges` - List all exchanges
```json
// Example response
[
  {
    "name": "my-exchange",
    "vhost": "/",
    "type": "topic",
    "durable": true,
    "auto_delete": false,
    "internal": false
  }
]
```

- `GET /api/exchanges/:vhost/:name` - Get exchange details
- `POST /api/exchanges/:vhost/:name/publish` - Publish a message
```json
// Example request
{
  "routingKey": "orders.new",
  "payload": {
    "order_id": "12345",
    "customer": "John Doe",
    "items": [{"product": "Widget", "quantity": 2}]
  },
  "properties": {
    "content_type": "application/json",
    "message_id": "msg-123",
    "correlation_id": "corr-456",
    "persistent": true
  }
}

// Example response
{
  "success": true,
  "message": "Message published successfully"
}
```

### Bindings
- `GET /api/bindings` - List all bindings
```json
// Example response
[
  {
    "source": "my-exchange",
    "destination": "my-queue",
    "destination_type": "queue",
    "routing_key": "my-key",
    "arguments": {},
    "vhost": "/"
  }
]
```

### Health
- `GET /api/health` - Health check endpoint
```json
// Example response
{
  "status": "UP",
  "amqp": "CONNECTED",
  "http": true,
  "timestamp": "2023-05-04T12:34:56.789Z"
}
```

## WebSocket Events

### Server to Client
- `connection-status` - Connection status update
  ```json
  {
    "http": true,
    "amqp": true,
    "timestamp": "2023-05-04T12:34:56.789Z"
  }
  ```
- `rabbitmq-data` - RabbitMQ data update
  ```json
  {
    "overview": { ... },
    "queues": [ ... ],
    "exchanges": [ ... ],
    "timestamp": "2023-05-04T12:34:56.789Z"
  }
  ```
- `rabbitmq-error` - Error message
  ```json
  {
    "message": "Failed to connect to RabbitMQ",
    "timestamp": "2023-05-04T12:34:56.789Z"
  }
  ```
- `server-shutdown` - Server is shutting down

### Client to Server
- `disconnect` - Client disconnects
- `request-data` - Request specific data type
  ```json
  // Example: request overview data
  "overview"

  // Example: request queues data
  "queues"

  // Example: request all data
  "all"
  ```

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

## AWS MQ Integration

To connect to AWS MQ, use the following settings:

```
RABBITMQ_URL=amqps://username:password@b-xxxx.mq.region.amazonaws.com:5671/
SSL_VERIFY=false
```

Note: When using AWS MQ, you might need to set `SSL_VERIFY=false` due to their certificate configuration.

## Error Handling

The backend has a robust error handling system:

1. **Connection Errors** - Automatic reconnection with exponential backoff
2. **API Errors** - Proper HTTP status codes and error messages
3. **WebSocket Errors** - Error events sent to clients
4. **Process Errors** - Graceful shutdown on SIGINT, SIGTERM, and uncaught exceptions

## Logging

Logging is handled by Winston with the following features:

- **Multiple Levels** - debug, info, warn, error
- **Console and File Output** - Choose your destination
- **Message Deduplication** - Avoid log spam
- **Structured Logging** - JSON format for easy parsing

## Performance Considerations

1. **Caching** - Responses are cached to reduce load on RabbitMQ
2. **Batched Requests** - Multiple resources fetched in parallel
3. **Compressed Responses** - Reduced bandwidth usage
4. **WebSocket Heartbeats** - Keep connections alive

## Security Recommendations

1. Use HTTPS for production deployments
2. Implement proper authentication in front of the dashboard
3. Use a dedicated RabbitMQ user with limited permissions
4. Set up network rules to restrict access to the dashboard

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

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check if RabbitMQ is running
   - Verify credentials
   - Check network connectivity

2. **SSL Issues**
   - Try setting `SSL_VERIFY=false`
   - Check certificate validity

3. **Performance Problems**
   - Increase `REFRESH_INTERVAL`
   - Check RabbitMQ server load

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add your changes
4. Add tests for your changes
5. Make sure all tests pass
6. Submit a pull request

## License

MIT