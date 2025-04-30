FROM node:20-alpine

WORKDIR /app

# Install necessary utilities for health check and SSL
RUN apk add --no-cache wget ca-certificates openssl

# Create certs directory for optional mounted certificates
RUN mkdir -p /app/certs

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]