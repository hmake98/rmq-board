import axios from 'axios';

// Create an axios instance with common configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    // Log errors for debugging
    console.error('API Error:', error.response || error.message);

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
  getQueue: (vhost, name) => api.get(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}`),
  getQueueMessages: (vhost, name) => api.get(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/get`),
  purgeQueue: (vhost, name) => api.post(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/purge`),

  // Exchanges
  getExchanges: () => api.get('/exchanges'),
  getExchange: (vhost, name) => api.get(`/exchanges/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}`),
  publishMessage: (vhost, name, message) => api.post(
    `/exchanges/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/publish`,
    message
  ),

  // Bindings
  getBindings: () => api.get('/bindings'),

  // Health check
  getHealth: () => api.get('/health')
};

export default endpoints;