# Base image
FROM node:20-alpine
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ nginx

# Copy package files
COPY package.json ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/

# Install backend dependencies
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

# Setup nginx
RUN mkdir -p /run/nginx
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i 's/listen 80/listen 8080/g' /etc/nginx/conf.d/default.conf

# Copy frontend build to nginx serve directory
RUN mkdir -p /usr/share/nginx/html
# Fixed line - don't use --from=0, just copy directly
RUN cp -r /app/packages/frontend/build/* /usr/share/nginx/html/

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'nginx' >> /app/start.sh && \
    echo 'cd /app/packages/backend && node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports
EXPOSE 3001 8080

# Start both services
CMD ["/app/start.sh"]