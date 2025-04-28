# rmq-board

A simple, intuitive and lightweight admin UI for RabbitMQ, designed to make monitoring and debugging your RabbitMQ instances effortless.

## Features

- 📊 **Real-time dashboard** with key RabbitMQ metrics
- 📋 **Monitor queues, exchanges, and bindings** at a glance
- 📬 **Inspect messages** in queues without disrupting normal operations
- 📤 **Publish messages** directly to exchanges with JSON support
- 🔄 **Live updates** via WebSockets
- 🔌 **Direct AMQP connection** for enhanced reliability and operations
- 🌙 **Dark mode support** for late-night debugging sessions
- 📱 **Responsive design** for desktop and mobile devices
- 🔍 **Search functionality** to quickly find queues, exchanges and bindings
- 🔁 **Auto-reconnect** with exponential backoff for resilience
- 🔧 **Easy integration** with Express.js applications
- 🐳 **Docker-ready** for quick deployment alongside RabbitMQ

## Quick Start with Docker

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
    restart: unless-stopped
```

Run with:

```bash
docker-compose up -d
```

Then open http://localhost:3000 in your browser.

## Installation

If you want to use rmq-board as an npm package in your existing application:

```bash
npm install rmq-board
```

## Usage

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
admin.createServer(3000);
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

## Configuration Options

| Option            | Description                       | Default                  |
| ----------------- | --------------------------------- | ------------------------ |
| `rabbitMQUrl`     | URL to RabbitMQ management API    | `http://localhost:15672` |
| `amqpUrl`         | URL for direct AMQP connection    | `amqp://localhost:5672`  |
| `username`        | RabbitMQ management username      | `guest`                  |
| `password`        | RabbitMQ management password      | `guest`                  |
| `refreshInterval` | How often to refresh data (ms)    | `5000`                   |
| `basePath`        | Base path for the UI              | `/`                      |
| `port`            | Port for standalone server        | `3000`                   |
| `maxRetries`      | Max reconnection attempts         | `5`                      |
| `retryTimeout`    | Initial reconnection timeout (ms) | `3000`                   |

## Environment Variables

When using Docker, you can configure rmq-board using these environment variables:

- `RABBITMQ_URL`: URL to RabbitMQ management API
- `RABBITMQ_AMQP_URL`: URL for direct AMQP connection
- `RABBITMQ_USERNAME`: RabbitMQ management username
- `RABBITMQ_PASSWORD`: RabbitMQ management password
- `REFRESH_INTERVAL`: How often to refresh data (ms)
- `BASE_PATH`: Base path for the UI
- `PORT`: Port for the server
- `MAX_RETRIES`: Maximum number of reconnection attempts
- `RETRY_TIMEOUT`: Initial timeout for reconnection attempts (ms)

## Key Features

### Message Inspection
View message contents in queues without consuming them. Messages are automatically requeued after inspection.

### Message Publishing
Publish new messages to any exchange with custom routing keys and message properties. Supports JSON formatting.

### Queue Management
Monitor queue status, message rates, and consumer counts. Purge queues when needed.

### Dark Mode
Automatically adapts to your system's color scheme preference.

## Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/rmq-board.git
cd rmq-board

# Install dependencies
npm install

# Build static assets
npm run build

# Run the development server
npm run dev

# Build the Docker image
docker build -t rmq-board .
```

## Comparison with RabbitMQ Management UI

| Feature                | rmq-board                    | RabbitMQ Management UI |
| ---------------------- | ---------------------------- | ---------------------- |
| Real-time updates      | ✅ (WebSockets)               | ❌ (Manual refresh)     |
| Direct AMQP operations | ✅                            | ❌                      |
| Message viewing        | ✅ (Enhanced JSON formatting) | ✅ (Basic)              |
| Message publishing     | ✅ (With JSON validation)     | ✅                      |
| Responsive design      | ✅                            | ❌                      |
| Dark mode              | ✅                            | ❌                      |
| Embeddable in apps     | ✅                            | ❌                      |
| Connection resilience  | ✅                            | ❌                      |

## Why rmq-board?

Unlike the default RabbitMQ Management UI, rmq-board is:

- **Lightweight**: Focused on the most important metrics and actions
- **Real-time**: Live updates via WebSockets
- **Modern**: Clean, intuitive interface with dark mode support
- **Integration-friendly**: Easily embeddable in your existing applications
- **Simple**: Get up and running in seconds with Docker
- **Resilient**: Automatic reconnection and graceful degradation

## License

MIT