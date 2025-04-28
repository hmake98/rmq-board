# rmq-board

A simple, intuitive and lightweight admin UI for RabbitMQ, designed to make monitoring and debugging your RabbitMQ instances effortless.

## Features

- 📊 **Real-time dashboard** with key RabbitMQ metrics
- 📋 **Monitor queues, exchanges, and bindings** at a glance
- 📬 **Inspect messages** in queues without disrupting normal operations
- 🔄 **Live updates** via WebSockets
- 🔌 **Easy integration** with Express.js applications
- 🐳 **Docker-ready** for quick deployment alongside RabbitMQ

## Quick Start with Docker

The easiest way to get started is using Docker Compose:

```yaml
# docker-compose.yml
version: '3'

services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest

  rmq-board:
    image: rmq-board:latest
    ports:
      - "3000:3000"
    environment:
      - RABBITMQ_URL=http://rabbitmq:15672
      - RABBITMQ_USERNAME=guest
      - RABBITMQ_PASSWORD=guest
    depends_on:
      - rabbitmq
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

| Option            | Description                    | Default                  |
| ----------------- | ------------------------------ | ------------------------ |
| `rabbitMQUrl`     | URL to RabbitMQ management API | `http://localhost:15672` |
| `username`        | RabbitMQ management username   | `guest`                  |
| `password`        | RabbitMQ management password   | `guest`                  |
| `refreshInterval` | How often to refresh data (ms) | `5000`                   |
| `basePath`        | Base path for the UI           | `/`                      |
| `port`            | Port for standalone server     | `3000`                   |

## Environment Variables

When using Docker, you can configure rmq-board using these environment variables:

- `RABBITMQ_URL`: URL to RabbitMQ management API
- `RABBITMQ_USERNAME`: RabbitMQ management username
- `RABBITMQ_PASSWORD`: RabbitMQ management password
- `REFRESH_INTERVAL`: How often to refresh data (ms)
- `BASE_PATH`: Base path for the UI
- `PORT`: Port for the server

## Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/rmq-board.git
cd rmq-board

# Install dependencies
npm install

# Run the development server
npm run dev

# Build the Docker image
docker build -t rmq-board .
```

## Why rmq-board?

Unlike the default RabbitMQ Management UI, rmq-board is:

- **Lightweight**: Focused on the most important metrics and actions
- **Real-time**: Live updates via WebSockets
- **Modern**: Clean, intuitive interface
- **Integration-friendly**: Easily embeddable in your existing applications
- **Simple**: Get up and running in seconds with Docker

## License

MIT