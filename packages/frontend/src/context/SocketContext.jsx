import React, { createContext, useContext, useEffect, useState } from 'react';
import { message } from 'antd';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState({
        http: false,
        amqp: false
    });
    const [reconnectAttempt, setReconnectAttempt] = useState(0);

    useEffect(() => {
        // Initialize Socket.io connection
        const socketInstance = io({
            path: '/socket.io',
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
        });

        // Connection events
        socketInstance.on('connect', () => {
            setIsConnected(true);
            setReconnectAttempt(0);
            console.log('Socket connected');
        });

        socketInstance.on('disconnect', () => {
            setIsConnected(false);
            console.log('Socket disconnected');
        });

        socketInstance.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setReconnectAttempt(prev => prev + 1);
            if (reconnectAttempt > 5) {
                message.error('Failed to connect to the server. Please check your connection.');
            }
        });

        // RabbitMQ specific events
        socketInstance.on('connection-status', (status) => {
            setConnectionStatus(status);
        });

        socketInstance.on('rabbitmq-error', (error) => {
            console.error('RabbitMQ error:', error);
            message.error(`RabbitMQ error: ${error.message}`);
        });

        socketInstance.on('server-shutdown', () => {
            message.warning('Server is shutting down...');
        });

        // Store socket in state
        setSocket(socketInstance);

        // Clean up on unmount
        return () => {
            socketInstance.disconnect();
        };
    }, []);

    const value = {
        socket,
        isConnected,
        connectionStatus,
        reconnectAttempt
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};