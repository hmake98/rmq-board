# RMQ Board

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

A modern, intuitive, and lightweight admin UI for RabbitMQ, designed to make monitoring and debugging your RabbitMQ instances effortless.

## ✨ Features

- **Real-time Dashboard** - Live monitoring of queues, exchanges, and connections with WebSocket updates
- **Message Inspection** - View message contents without consuming them from the queue
- **Message Publishing** - Send messages directly to exchanges with JSON validation and formatting
- **AMQP Connection** - Direct AMQP connection for enhanced reliability and performance
- **Dark Mode** - Automatic dark mode support based on system preferences
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Search Functionality** - Quickly find queues, exchanges, and bindings
- **Auto-reconnect** - Resilient connections with exponential backoff
- **Easy Integration** - Mount as middleware in existing Express.js applications
- **Docker Ready** - Simple deployment alongside RabbitMQ

## 🚀 Quick Start with Docker

The easiest way to get started is using Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3-management
    hostname: rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  rmq-board:
    image: rmq-board:latest
    ports:
      - "3000:3000"
    environment:
      - RABBITMQ_URL=http://rabbitmq:15672
      - RABBITMQ_AMQP_URL=amqp://rabbitmq:5672
      - RABBITMQ_USERNAME=guest
      - RABBITMQ_PASSWORD=guest
      - REFRESH_INTERVAL=5000
    depends_on:
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

volumes:
  rabbitmq_data:
```

Run with:

```bash
docker-compose up -d
```

Then open http://localhost:3000 in your browser.

## 🔧 Installation

If you want to use rmq-board as an npm package in your existing application:

```bash
npm install rmq-board
```

Or clone and build from source:

```bash
# Clone the repository
git clone https://github.com/yourusername/rmq-board.git
cd rmq-board

# Install dependencies
npm install

# Build static assets
npm run build

# Start the server
npm start
```

## 🔌 Usage

### Standalone Server

```javascript
const RabbitMQAdmin = require('rmq-board');

// Create a new instance
const admin = new RabbitMQAdmin({
  rabbitMQUrl: 'http://localhost:15672',
  amqpUrl: 'amqp://localhost:5672',
  username: 'guest',
  password: 'guest'
});

// Start the server on port 3000
admin.createServer(3000).then(({ server }) => {
  console.log('RMQ Board is running on port 3000');
});
```

### Use with Express.js

```javascript
const express = require('express');
const http = require('http');
const RabbitMQAdmin = require('rmq-board');

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

## ⚙️ Configuration Options

| Option            | Description                       | Default                  | Environment Variable  |
| ----------------- | --------------------------------- | ------------------------ | --------------------- |
| `rabbitMQUrl`     | URL to RabbitMQ management API    | `http://localhost:15672` | `RABBITMQ_URL`        |
| `amqpUrl`         | URL for direct AMQP connection    | `amqp://localhost:5672`  | `RABBITMQ_AMQP_URL`   |
| `username`        | RabbitMQ management username      | `guest`                  | `RABBITMQ_USERNAME`   |
| `password`        | RabbitMQ management password      | `guest`                  | `RABBITMQ_PASSWORD`   |
| `refreshInterval` | How often to refresh data (ms)    | `5000`                   | `REFRESH_INTERVAL`    |
| `basePath`        | Base path for the UI              | `/`                      | `BASE_PATH`           |
| `port`            | Port for standalone server        | `3000`                   | `PORT`                |
| `maxRetries`      | Max reconnection attempts         | `5`                      | `MAX_RETRIES`         |
| `retryTimeout`    | Initial reconnection timeout (ms) | `3000`                   | `RETRY_TIMEOUT`       |
| `logLevel`        | Logging level                     | `info`                   | `LOG_LEVEL`           |

## 🎯 Key Features

### Real-time Updates
All data in RMQ Board updates in real-time via WebSockets, providing immediate feedback on the state of your RabbitMQ instance.

### Message Inspection
View message contents in queues without consuming them. Messages are automatically requeued after inspection, making it safe to use in production environments.

### Message Publishing
Publish new messages to any exchange with custom routing keys and message properties. Includes JSON formatting and validation.

### Queue Management
Monitor queue status, message rates, and consumer counts. Purge queues when needed with a single click.

### Dark Mode
Automatically adapts to your system's color scheme preference for comfortable viewing in any lighting condition.

### Responsive Design
Works seamlessly on desktop, tablet, and mobile devices with an adaptive layout.

## 🧪 Testing with Example Data

The project includes a utility script to generate test data:

```bash
# Run the test data generator
node examples/main.js

# Or with custom settings
AMQP_URL=amqp://localhost:5672 MESSAGE_COUNT=200 PUBLISH_INTERVAL=250 node examples/main.js
```

This will create various exchanges, queues, and messages to help you test all features of the UI.

## 📊 Comparison with RabbitMQ Management UI

| Feature                | RMQ Board                    | RabbitMQ Management UI |
| ---------------------- | ---------------------------- | ---------------------- |
| Real-time updates      | ✅ (WebSockets)              | ❌ (Manual refresh)     |
| Direct AMQP operations | ✅                           | ❌                      |
| Message viewing        | ✅ (Enhanced JSON formatting) | ✅ (Basic)              |
| Message publishing     | ✅ (With JSON validation)     | ✅                      |
| Responsive design      | ✅                           | ❌                      |
| Dark mode              | ✅                           | ❌                      |
| Embeddable in apps     | ✅                           | ❌                      |
| Connection resilience  | ✅                           | ❌                      |
| Search functionality   | ✅                           | ✅                      |
| Performance impact     | ⭐ (Lightweight)             | ⭐⭐ (Moderate)         |

## 🤔 Why RMQ Board?

Unlike the default RabbitMQ Management UI, RMQ Board is:

- **Lightweight**: Focused on the most important metrics and actions
- **Real-time**: Live updates via WebSockets provide immediate feedback
- **Modern**: Clean, intuitive interface with dark mode support
- **Integration-friendly**: Easily embeddable in your existing applications
- **Resilient**: Automatic reconnection and graceful degradation
- **Developer-friendly**: Designed with debugging and testing in mind

## 🚦 Health Checks

RMQ Board provides a health check endpoint at `/api/health` that returns the status of the application and its connections:

```json
{
  "status": "UP", // UP, DEGRADED, or DOWN
  "amqp": "CONNECTED", // CONNECTED or DISCONNECTED
  "http": true, // true or false
  "timestamp": "2023-08-01T12:34:56.789Z"
}
```

## 🛠️ API

RMQ Board exposes a REST API that you can use to integrate with other tools:

- `GET /api/overview` - Get RabbitMQ server overview
- `GET /api/queues` - List all queues
- `GET /api/exchanges` - List all exchanges
- `GET /api/bindings` - List all bindings
- `GET /api/queues/:vhost/:name` - Get queue details
- `GET /api/queues/:vhost/:name/get` - Get messages from queue
- `POST /api/queues/:vhost/:name/purge` - Purge a queue
- `POST /api/exchanges/:vhost/:name/publish` - Publish a message

## 🔒 Security

RMQ Board uses the same authentication mechanism as the RabbitMQ Management UI. It does not store credentials and passes them directly to the RabbitMQ API.

For production use, we recommend:

1. Running behind a reverse proxy with HTTPS
2. Setting up proper authentication and authorization
3. Using a dedicated RabbitMQ user with limited permissions
4. Setting up network segmentation to restrict access

## 🧩 Architecture

RMQ Board consists of:

1. **Express.js Server** - Serves the UI and provides the API
2. **Socket.IO** - Handles real-time updates
3. **AMQP Client** - Direct connection to RabbitMQ for operations
4. **HTTP Client** - Connection to RabbitMQ Management API
5. **Web UI** - Responsive interface built with vanilla JavaScript

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
