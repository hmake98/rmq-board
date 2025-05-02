# RMQ Board Frontend

The frontend component of RMQ Board, providing a modern, intuitive user interface for RabbitMQ management and monitoring.

![Frontend Screenshot](https://raw.githubusercontent.com/hmake98/rmq-board/main/screenshots/dashboard.png)

## 🌟 Features

- **Real-time Dashboard** - Live monitoring with WebSocket updates
- **Queue Management** - Monitor, browse and purge queues
- **Exchange Monitoring** - Track exchange statistics and message rates
- **Binding Visualization** - Explore relationships between exchanges and queues
- **Message Inspection** - View message contents without consuming them
- **Message Publishing** - Send messages with JSON validation and formatting
- **Interactive JSON Editor** - Format and validate JSON payloads
- **Dark Mode** - Automatic dark mode based on system preferences
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Advanced Filtering** - Filter and search queues, exchanges, and bindings

## 🛠️ Technology Stack

- **React 18** - Modern React with hooks and context
- **Vite** - Fast and lean build tool
- **Ant Design** - Enterprise-grade UI components
- **Socket.IO** - Real-time WebSocket communication
- **Axios** - HTTP client for API requests
- **React Router** - Navigation and routing

## 📁 Project Structure

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

## 🚀 Installation

```bash
# From the project root
npm install

# Or specifically for the frontend
cd packages/frontend
npm install
```

## 🧪 Running in Development Mode

```bash
# From the project root
npm run frontend

# Or from the frontend directory
cd packages/frontend
npm run dev
```

## ⚙️ Environment Variables

Create a `.env` file in the `packages/frontend` directory:

```
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_APP_TITLE=RMQ Board
```

### Configuration Details

| Variable          | Description                  | Default                     | Notes                    |
| ----------------- | ---------------------------- | --------------------------- | ------------------------ |
| `VITE_API_URL`    | URL for backend API          | `http://localhost:3001/api` | Include `/api` path      |
| `VITE_SOCKET_URL` | URL for WebSocket connection | `http://localhost:3001`     | No trailing slash        |
| `VITE_APP_TITLE`  | Application title            | `RMQ Board`                 | Displayed in browser tab |

## 📦 Building for Production

```bash
# From the project root
npm run build

# Or from the frontend directory
cd packages/frontend
npm run build
```

The build output will be in the `packages/frontend/build` directory.

## 📋 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## 🐳 Docker

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

## 📱 Responsive Design

The UI is fully responsive and works on the following device sizes:

- **Desktop** - 1200px and above
- **Tablet** - 768px to 1199px
- **Mobile** - 320px to 767px

The layout automatically adjusts based on the screen size:

- Sidebar collapses on smaller screens
- Tables adjust columns and row display
- Form inputs stack vertically on mobile
- Cards and panels adjust to full width

## 🎨 Component Overview

### Overview

The Overview component provides a dashboard with key RabbitMQ metrics:

- Server version and uptime
- Connection and channel counts
- Message rates and statistics
- Queue and consumer counts
- System health status

![Overview Component](https://raw.githubusercontent.com/hmake98/rmq-board/main/screenshots/overview.png)

### Queues

The Queues component provides a complete queue management interface:

- List all queues with real-time statistics
- Filter and search queues by name or properties
- View message counts and consumer status
- Browse messages in queues
- Purge queues with confirmation
- Queue health indicators

![Queues Component](https://raw.githubusercontent.com/hmake98/rmq-board/main/screenshots/queues.png)

### Exchanges

The Exchanges component provides exchange monitoring:

- List all exchanges with type indicators
- Filter exchanges by name or type
- Monitor message rates
- View exchange properties and features
- Direct access to message publishing

![Exchanges Component](https://raw.githubusercontent.com/hmake98/rmq-board/main/screenshots/exchanges.png)

### Bindings

The Bindings component visualizes the relationships between exchanges and queues:

- List all bindings with source and destination
- Filter by source, destination, or routing key
- View binding arguments
- Group by virtual host

![Bindings Component](https://raw.githubusercontent.com/hmake98/rmq-board/main/screenshots/bindings.png)

### PublishMessage

The PublishMessage component allows publishing messages to exchanges:

- Select exchange and routing key
- JSON editor with syntax highlighting and validation
- Plain text message option
- Set message properties and headers
- Persistent message toggle
- Success/failure notifications

![Publish Component](https://raw.githubusercontent.com/hmake98/rmq-board/main/screenshots/publish.png)

### MessageViewer

The MessageViewer component provides a detailed message inspector:

- View message content with syntax highlighting
- Inspect message properties and headers
- Copy message content to clipboard
- Download message as file
- Expanded view option

![Message Viewer](https://raw.githubusercontent.com/hmake98/rmq-board/main/screenshots/messages.png)

## 🔄 WebSocket Integration

The frontend uses Socket.IO for real-time updates:

- Connection established via SocketContext provider
- Automatic reconnection with exponential backoff
- Event-driven updates for all dashboard components
- Fallback to polling if WebSocket connection fails

Example of subscribing to WebSocket events:

```javascript
import { useSocket } from "../context/SocketContext";

const MyComponent = () => {
  const { socket, isConnected } = useSocket();
  
  useEffect(() => {
    if (socket) {
      socket.on("rabbitmq-data", (data) => {
        // Handle real-time data updates
        console.log("Received new data:", data);
      });
      
      // Clean up event listeners
      return () => {
        socket.off("rabbitmq-data");
      };
    }
  }, [socket]);
  
  // Component rendering...
};
```

## 🧭 Routing

Navigation is handled with React Router:

- `/` - Dashboard overview
- `/queues` - Queue management
- `/exchanges` - Exchange monitoring
- `/bindings` - Binding visualization
- `/publish` - Message publishing

## 🔒 Error Handling

The frontend includes comprehensive error handling:

- API error handling with helpful messages
- Socket connection monitoring and reconnection
- Form validation with meaningful feedback
- Fallback UI for disconnected state
- Error boundaries to prevent app crashes

## 🌙 Dark Mode

Dark mode is automatically enabled based on system preferences, but can also be toggled manually:

- Follows `prefers-color-scheme` media query
- Uses Ant Design's built-in theming
- Custom styling for code blocks and JSON viewers
- Consistent color palette across all components

## 🧪 Testing

The frontend includes a test suite using Vitest and React Testing Library:

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📊 Performance Optimization

Several optimizations are in place:

- Lazy loading of components
- Memoization of expensive calculations
- Debounced inputs for search fields
- Virtualized lists for large datasets
- Optimized re-rendering with React.memo

## 🌐 Browser Support

The frontend supports the following browsers:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🧩 Extending the UI

Adding new components or features:

1. Create a new component in the `components` directory
2. Add routing in `App.jsx` if needed
3. Update the navigation menu in `MainLayout.jsx`
4. Add any required API endpoints in `services/api.js`

Example of adding a new route:

```jsx
// In App.jsx
<Routes>
  <Route path="/" element={<MainLayout />}>
    {/* Existing routes */}
    <Route index element={<Overview />} />
    <Route path="queues" element={<Queues />} />
    
    {/* New route */}
    <Route path="my-new-feature" element={<MyNewComponent />} />
  </Route>
</Routes>
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add your changes
4. Add tests for your changes
5. Make sure all tests pass
6. Submit a pull request

## 📝 License

MIT