# Base image
FROM node:20-alpine
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ nginx

# Copy package files
COPY package.json ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/

# Install dependencies
WORKDIR /app
RUN npm install --omit=dev

# Install frontend dependencies and build
WORKDIR /app/packages/frontend
RUN npm install
COPY packages/frontend/ ./
RUN npm run build

# Copy backend files
WORKDIR /app
COPY packages/backend/ ./packages/backend/

# Setup nginx - Using the main nginx.conf file
RUN mkdir -p /run/nginx
# We'll create the nginx.conf file directly
RUN echo 'http { \
    include /etc/nginx/mime.types; \
    default_type application/octet-stream; \
    sendfile on; \
    keepalive_timeout 65; \
    server { \
        listen 8080; \
        server_name localhost; \
        location / { \
            root /usr/share/nginx/html; \
            index index.html index.htm; \
            try_files $uri $uri/ /index.html; \
        } \
        location /api/ { \
            proxy_pass http://localhost:3001/api/; \
            proxy_http_version 1.1; \
            proxy_set_header Upgrade $http_upgrade; \
            proxy_set_header Connection "upgrade"; \
            proxy_set_header Host $host; \
            proxy_cache_bypass $http_upgrade; \
        } \
        location /socket.io/ { \
            proxy_pass http://localhost:3001/socket.io/; \
            proxy_http_version 1.1; \
            proxy_set_header Upgrade $http_upgrade; \
            proxy_set_header Connection "upgrade"; \
            proxy_set_header Host $host; \
            proxy_cache_bypass $http_upgrade; \
        } \
        error_page 500 502 503 504 /50x.html; \
        location = /50x.html { \
            root /usr/share/nginx/html; \
        } \
    } \
} \
events { \
    worker_connections 1024; \
}' > /etc/nginx/nginx.conf

# Copy frontend build to nginx serve directory
RUN mkdir -p /usr/share/nginx/html
RUN cp -r /app/packages/frontend/build/* /usr/share/nginx/html/

# Create startup script with proper error logging
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting nginx..."' >> /app/start.sh && \
    echo 'nginx && echo "Nginx started successfully"' >> /app/start.sh && \
    echo 'echo "Starting backend..."' >> /app/start.sh && \
    echo 'cd /app/packages/backend && node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports
EXPOSE 3001 8080

# Start both services
CMD ["/app/start.sh"]