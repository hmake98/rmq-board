import React, { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";

// Create context
const SocketContext = createContext(null);

// Socket provider component
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    http: false,
    amqp: false,
  });

  // Initialize socket connection
  useEffect(() => {
    // Determine the socket URL based on the environment
    const socketUrl = window.location.origin;

    console.log("Connecting to Socket.IO at:", socketUrl);

    // Create socket instance
    const socketInstance = io(socketUrl, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      transports: ["websocket", "polling"],
    });

    // Set socket instance
    setSocket(socketInstance);

    // Socket event handlers
    const onConnect = () => {
      console.log("Socket connected");
      setIsConnected(true);

      // Request initial connection status
      socketInstance.emit("request-data", "connection-status");
    };

    const onDisconnect = () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    };

    const onConnectionStatus = (status) => {
      console.log("Received connection status:", status);

      // Convert to a safe format to avoid circular references
      const safeStatus = {
        http: status && typeof status.http === "boolean" ? status.http : false,
        amqp: status && typeof status.amqp === "boolean" ? status.amqp : false,
        timestamp:
          status && status.timestamp
            ? status.timestamp
            : new Date().toISOString(),
      };

      setConnectionStatus(safeStatus);
    };

    const onRabbitMQData = (data) => {
      // If the data contains connection status, update it
      if (data && data.connectionStatus) {
        const safeStatus = {
          http: data.connectionStatus.http || false,
          amqp: data.connectionStatus.amqp || false,
          timestamp: data.timestamp || new Date().toISOString(),
        };

        setConnectionStatus(safeStatus);
      }
    };

    const onError = (error) => {
      console.error("Socket error:", error);
    };

    // Register event listeners
    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);
    socketInstance.on("connection-status", onConnectionStatus);
    socketInstance.on("rabbitmq-data", onRabbitMQData);
    socketInstance.on("error", onError);
    socketInstance.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    // Cleanup on unmount
    return () => {
      if (socketInstance) {
        socketInstance.off("connect", onConnect);
        socketInstance.off("disconnect", onDisconnect);
        socketInstance.off("connection-status", onConnectionStatus);
        socketInstance.off("rabbitmq-data", onRabbitMQData);
        socketInstance.off("error", onError);
        socketInstance.off("connect_error");
        socketInstance.disconnect();
      }
    };
  }, []);

  // Function to request refreshed data
  const refreshData = (dataType = "all") => {
    if (socket && isConnected) {
      socket.emit("request-data", dataType);
    }
  };

  // Function to directly request connection status
  const refreshConnectionStatus = () => {
    if (socket && isConnected) {
      socket.emit("request-data", "connection-status");
    }
  };

  // Provider value
  const value = {
    socket,
    isConnected,
    connectionStatus,
    refreshData,
    refreshConnectionStatus,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

// Custom hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export default SocketContext;
