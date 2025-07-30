# RMQ Board 🐰

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)

A modern, intuitive, and lightweight admin UI for RabbitMQ, designed to make monitoring and debugging your RabbitMQ instances effortless.

## ✨ Features

- **Real-time Dashboard** - Live monitoring of queues, exchanges, and connections with WebSocket updates
- **Message Inspection** - View message contents without consuming them from the queue
- **Message Publishing** - Send messages directly to exchanges with JSON validation and formatting
- **AMQP Connection** - Direct AMQP connection for enhanced reliability and performance
- **🔍 Advanced Debugging** - Comprehensive debugging panel with real-time connection monitoring, performance metrics, and detailed activity logging
- **❤️ Health Monitoring** - Automated health checks with configurable alerts, performance tracking, and connection status monitoring
- **Dark Mode** - Automatic dark mode support based on system preferences
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Search Functionality** - Quickly find queues, exchanges, and bindings
- **Auto-reconnect** - Resilient connections with exponential backoff
- **Easy Integration** - Mount as middleware in existing Express.js applications
- **Docker Ready** - Simple deployment alongside RabbitMQ

## 🖼️ Screenshots
<img width="1440" alt="Screenshot 2025-05-03 at 1 04 40 AM" src="https://github.com/user-attachments/assets/a5120d71-73c7-499d-bf9d-ba4288f17627" />
<img width="1440" alt="Screenshot 2025-05-03 at 1 05 02 AM" src="https://github.com/user-attachments/assets/7af404b8-4f6c-4ae5-82a1-aaf9eed8ee8b" />
<img width="1439" alt="Screenshot 2025-05-03 at 1 05 11 AM" src="https://github.com/user-attachments/assets/3d860886-a85d-442d-964a-6534b41a5ba1" />
<img width="1439" alt="Screenshot 2025-05-03 at 1 05 30 AM" src="https://github.com/user-attachments/assets/21809081-e00d-4dd0-a8a0-4c6519c076b4" />
<img width="1440" alt="Screenshot 2025-05-03 at 1 05 44 AM" src="https://github.com/user-attachments/assets/ea831ce0-742d-4505-8984-595240d55b86" />

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
    image: hmake98/rmq-board:latest
    ports:
      - "3000:8080"
    environment:
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
      - SSL_VERIFY=false
      - REFRESH_INTERVAL=5000
    depends_on:
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health.html"]
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

## 🔧 Local Development

For local development:

```bash
# Clone the repository
git clone https://github.com/hmake98/rmq-board.git
cd rmq-board

# Install dependencies
npm install

# Start both backend and frontend
npm run dev

# Or start them separately:
npm run backend
npm run frontend
```

## 🔍 Debugging and Monitoring

RMQ Board includes comprehensive debugging and health monitoring features:

### Debug Panel
- **Real-time Connection Monitoring**: Track HTTP and AMQP connection attempts, successes, and failures
- **Performance Metrics**: Monitor response times, success rates, and operation counts
- **Session Management**: View debug session information and control debug levels
- **Activity Logging**: Track recent operations and errors with detailed context

### Health Monitor
- **Connection Health Checks**: Automated monitoring of HTTP and AMQP connections
- **Alert System**: Configurable thresholds for response time, error rates, and failures
- **Performance Tracking**: Real-time latency monitoring and trend analysis
- **Alert Management**: View, clear, and configure alerts

Access these features through the navigation menu:
- **Debug Panel**: `/debug` - Comprehensive debugging interface
- **Health Monitor**: `/health` - Health monitoring and alert management

For detailed documentation, see [DEBUGGING.md](packages/backend/DEBUGGING.md).

### Environment Variables

#### Backend (`.env` file in packages/backend):

```
# Core connection setting
RABBITMQ_URL=amqp://guest:guest@localhost:5672/

# Optional settings
SSL_VERIFY=false
PORT=3001
LOG_LEVEL=debug
REFRESH_INTERVAL=10000

# Debugging and monitoring settings
DEBUG_ENABLED=true
DEBUG_LEVEL=detailed
HEALTH_CHECK_INTERVAL=30000
PERFORMANCE_CHECK_INTERVAL=60000
RESPONSE_TIME_THRESHOLD=5000
ERROR_RATE_THRESHOLD=0.1
CONSECUTIVE_FAILURE_THRESHOLD=3
MEMORY_USAGE_THRESHOLD=0.8
```

#### Frontend (`.env` file in packages/frontend):

```
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_APP_TITLE=RMQ Board
```

## 📊 Architecture

RMQ Board consists of:

1. **Express.js Backend** - Provides the API and WebSocket connections
2. **React Frontend** - Modern interface built with React and Ant Design
3. **AMQP Client** - Direct connection to RabbitMQ for reliable operations
4. **HTTP Client** - Connection to RabbitMQ Management API for enhanced functionality

### Project Structure

```
rmq-board/
├── packages/
│   ├── backend/           # Express.js backend
│   │   ├── src/           # Source code
│   │   │   ├── lib/       # Core libraries
│   │   │   ├── utils/     # Utility functions
│   │   │   └── index.js   # Entry point
│   │   └── server.js      # Server setup
│   └── frontend/          # React frontend
│       ├── src/           # Source code
│       │   ├── components/# UI components
│       │   ├── context/   # React context providers
│       │   ├── layouts/   # Layout components
│       │   ├── services/  # API services
│       │   └── utils/     # Utility functions
│       └── index.html     # HTML entry
├── examples/              # Example usage and demos
└── docker-compose.yml     # Docker configuration
```

## 🔌 Integration

You can integrate RMQ Board into your existing Express.js application:

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
  basePath: '/rabbitmq'
});

// Mount to your existing Express app
admin.mountApp(app, server);

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## ⚙️ Configuration Options

| Option            | Description                       | Default                  | Environment Variable |
| ----------------- | --------------------------------- | ------------------------ | -------------------- |
| `rabbitMQUrl`     | URL to RabbitMQ management API    | `http://localhost:15672` | `RABBITMQ_URL`       |
| `amqpUrl`         | URL for direct AMQP connection    | `amqp://localhost:5672`  | `RABBITMQ_AMQP_URL`  |
| `username`        | RabbitMQ management username      | `guest`                  | `RABBITMQ_USERNAME`  |
| `password`        | RabbitMQ management password      | `guest`                  | `RABBITMQ_PASSWORD`  |
| `refreshInterval` | How often to refresh data (ms)    | `5000`                   | `REFRESH_INTERVAL`   |
| `basePath`        | Base path for the UI              | `/`                      | `BASE_PATH`          |
| `port`            | Port for standalone server        | `3001`                   | `PORT`               |
| `maxRetries`      | Max reconnection attempts         | `5`                      | `MAX_RETRIES`        |
| `retryTimeout`    | Initial reconnection timeout (ms) | `3000`                   | `RETRY_TIMEOUT`      |
| `logLevel`        | Logging level                     | `info`                   | `LOG_LEVEL`          |

## 🧩 REST API

RMQ Board exposes a REST API that you can use to integrate with other tools:

- `GET /api/overview` - Get RabbitMQ server overview
- `GET /api/queues` - List all queues
- `GET /api/exchanges` - List all exchanges
- `GET /api/bindings` - List all bindings
- `GET /api/queues/:vhost/:name` - Get queue details
- `GET /api/queues/:vhost/:name/get` - Get messages from queue
- `POST /api/queues/:vhost/:name/purge` - Purge a queue
- `POST /api/exchanges/:vhost/:name/publish` - Publish a message
- `GET /api/health` - Get health status

## 🛠️ Building From Source

```bash
# Clone the repository
git clone https://github.com/hmake98/rmq-board.git
cd rmq-board

# Install dependencies
npm install

# Build the project
npm run build

# Run the built application
npm start
```

## 🐳 Docker Build

Build your own Docker image:

```bash
# Build the Docker image
docker build -t rmq-board .

# Or use docker-compose
docker-compose build
```

## 🔧 Testing

The repository includes example scripts to help you test and demonstrate the dashboard's functionality:

```bash
# Run the test message generator
cd examples
node main.js
```

This will create various exchanges, queues, and publish different types of messages to help you test all features of the dashboard.

## 📱 Mobile Support

RMQ Board is fully responsive and works on mobile devices. The UI adapts to different screen sizes, making it easy to monitor your RabbitMQ instances on the go.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgements

- [RabbitMQ](https://www.rabbitmq.com/) - For the amazing message broker
- [React](https://reactjs.org/) - For the frontend framework
- [Express](https://expressjs.com/) - For the backend framework
- [Ant Design](https://ant.design/) - For the UI components
- [Socket.IO](https://socket.io/) - For real-time updates

## 📧 Contact

- GitHub: [@hmake98](https://github.com/hmake98)
- Issue Tracker: [GitHub Issues](https://github.com/hmake98/rmq-board/issues)
