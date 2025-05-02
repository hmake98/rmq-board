import axios from 'axios';
import { message } from 'antd';

// Get API base URL from environment variables or use default
const API_BASE_URL = '/api';

// Create an axios instance with common configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased timeout for potential slow operations
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for logging and potential auth
api.interceptors.request.use(
  config => {
    // You can add authentication headers here if needed
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    // Log errors for debugging
    if (error.response) {
      // The request was made and the server responded with a status code
      // outside of the range of 2xx
      console.error('API Error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });

      // Handle specific status codes
      switch (error.response.status) {
        case 401:
          message.error('Authentication failed. Please check your credentials.');
          break;
        case 403:
          message.error('You do not have permission to perform this action.');
          break;
        case 404:
          message.error('Resource not found.');
          break;
        case 500:
          message.error('Server error. Please try again later.');
          break;
        default:
          message.error(`Error: ${error.response.data?.error || 'Unknown error occurred'}`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error: No response received', error.request);
      message.error('No response from server. Please check your connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error:', error.message);
      message.error(`Error: ${error.message}`);
    }

    // Propagate error for component-level handling
    return Promise.reject(error);
  }
);

// API endpoints
const endpoints = {
  // Overview
  getOverview: () => api.get('/overview'),

  // Queues
  getQueues: () => api.get('/queues'),
  getQueue: (vhost, name) => {
    // Handle potential double-encoding issues
    const cleanVhost = vhost.includes('%') ? decodeURIComponent(vhost) : vhost;
    return api.get(`/api/queues/${encodeURIComponent(cleanVhost)}/${encodeURIComponent(name)}`);
  },
  getQueueMessages: (vhost, name) => api.get(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/get`),
  purgeQueue: (vhost, name) => api.post(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/purge`),

  // Exchanges
  getExchanges: () => api.get('/exchanges'),
  getExchange: (vhost, name) => api.get(`/exchanges/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}`),
  publishMessage: (vhost, name, routingKey, payload, properties) => api.post(
    `/exchanges/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/publish`,
    { routingKey, payload, properties }
  ),

  // Bindings
  getBindings: () => api.get('/bindings'),

  // Health check
  getHealth: () => api.get('/health'),

  // Helper method to handle common error patterns
  handleRequestError: (error) => {
    let errorMessage = 'An error occurred while connecting to the server';

    if (error.response) {
      // Server responded with error
      errorMessage = error.response.data?.error ||
        error.response.data?.message ||
        `Server error: ${error.response.status}`;
    } else if (error.request) {
      // No response received
      errorMessage = 'No response from server. Please check your connection.';
    }

    return {
      error: true,
      message: errorMessage,
      details: error.response?.data || error.message
    };
  }
};

export default endpoints;