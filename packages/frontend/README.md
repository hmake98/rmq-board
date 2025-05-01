# RMQ Board Frontend (Vite)

This is the React frontend for RMQ Board, a modern, intuitive, and lightweight admin UI for RabbitMQ, built with Vite.

## Project Structure

The frontend code uses a flat folder structure for simplicity and ease of navigation:

```
rmq-board-frontend/
├── .env                 # Environment variables
├── index.html           # HTML entry point
├── vite.config.js       # Vite configuration
├── package.json         # Dependencies and scripts
├── public/              # Static assets
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Global styles
│   ├── main.jsx         # Application entry point
│   ├── index.css        # Global styles
│   ├── Bindings.jsx     # Bindings component
│   ├── Exchanges.jsx    # Exchanges component
│   ├── JSONEditor.jsx   # JSON editor component for message publishing
│   ├── MainLayout.jsx   # Main layout component
│   ├── MessageViewer.jsx # Message viewer component
│   ├── Overview.jsx     # Dashboard overview component
│   ├── PublishMessage.jsx # Message publishing component
│   ├── SocketContext.jsx # WebSocket context for real-time updates
│   └── api.js           # API service for backend communication
└── README.md            # This file
```

## Available Scripts

In the project directory, you can run:

### `npm run dev` or `npm start`

Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes with HMR (Hot Module Replacement).\
You may also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run preview`

Locally preview the production build after running `npm run build`.

## Features

- **Real-time Dashboard**: Live monitoring of queues, exchanges, and connections
- **Message Inspection**: View message contents without consuming them
- **Message Publishing**: Send messages directly to exchanges
- **Dark Mode**: Automatic dark mode support based on system preferences
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Technologies Used

- React 18
- Vite (Build Tool)
- Ant Design (UI Components)
- Socket.IO (WebSockets)
- Axios (HTTP Client)
- React Router (Routing)

## Why Vite?

Vite offers several advantages over Create React App:

- Extremely fast startup times (no bundling in development)
- Hot Module Replacement (HMR) with instant updates
- Optimized production builds with Rollup
- Native ESM during development
- Simpler and more flexible configuration