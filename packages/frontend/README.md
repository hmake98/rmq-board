# RMQ Board Frontend

The frontend component of RMQ Board, providing a modern, intuitive user interface for RabbitMQ management and monitoring.

## Features

- **Real-time Dashboard** - Live monitoring with WebSocket updates
- **Message Inspection** - View message contents without consuming them
- **Message Publishing** - Send messages with JSON validation and formatting
- **Dark Mode** - Automatic dark mode based on system preferences
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Advanced Filtering** - Filter and search queues, exchanges, and bindings

## Technology Stack

- **React 18** - Modern React with hooks and context
- **Vite** - Fast and lean build tool
- **Ant Design** - Enterprise-grade UI components
- **Socket.IO** - Real-time WebSocket communication
- **Axios** - HTTP client for API requests
- **React Router** - Navigation and routing

## Project Structure

```
src/
├── components/         # UI components
│   ├── Bindings.jsx    # Bindings view
│   ├── Exchanges.jsx   # Exchanges view
│   ├── JSONEditor.jsx  # JSON editor for messages
│   ├── MessageViewer.jsx # Message viewer component
│   ├── Overview.jsx    # Dashboard overview
│   ├── PublishMessage.jsx # Message publishing
│   └── Queues.jsx      # Queues view
├── context/            # React context
│   └── SocketContext.jsx # WebSocket context provider
├── layouts/            # Layout components
│   └── MainLayout.jsx  # Main application layout
├── services/           # API services
│   └── api.js          # API endpoints
├── utils/              # Utility functions
│   └── formatters.js   # Data formatting utilities
├── App.jsx             # Main application component
├── App.css             # Global styles
├── main.jsx            # Entry point
└── index.css           # Root styles
```

## Installation

```bash
# From the project root
npm install

# Or specifically for the frontend
cd packages/frontend
npm install
```

## Running in Development Mode

```bash
# From the project root
npm run frontend

# Or from the frontend directory
cd packages/frontend
npm run dev
```

## Environment Variables

Create a `.env` file in the `packages/frontend` directory:

```
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_APP_TITLE=RMQ Board
```

## Building for Production

```bash
# From the project root
npm run build

# Or from the frontend directory
cd packages/frontend
npm run build
```

The build output will be in the `packages/frontend/build` directory.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Docker

The frontend can be run in Docker:

```bash
# Build from project root
docker build -f Dockerfile.frontend -t rmq-board-frontend .

# Run
docker run -p 3000:80 \
  -e VITE_API_URL=http://localhost:3001/api \
  -e VITE_SOCKET_URL=http://localhost:3001 \
  rmq-board-frontend
```

## Component Overview

### Overview
Displays a dashboard with key RabbitMQ metrics, including:
- Queue counts
- Connection counts
- Message rates
- Server information
- Connection status

### Queues
Lists all queues with filtering and search:
- View message counts
- Monitor consumer counts
- View message rates
- Purge queues
- View messages in queues

### Exchanges
Lists all exchanges with filtering and search:
- View exchange types
- Monitor message rates
- Publish messages

### Bindings
Lists all bindings between exchanges and queues:
- View routing keys
- Filter by source/destination
- View binding arguments

### PublishMessage
Allows publishing messages to exchanges:
- JSON editor with validation
- Select exchange and routing key
- Set message properties
- View publish status

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT