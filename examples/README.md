# RMQ Board Testing Examples

This directory contains examples to help you test and demonstrate the rmq-board dashboard.

## Message Generator (main.js)

The `main.js` script creates a variety of exchanges, queues, and publishes different types of messages to help you test the dashboard's functionality.

### Prerequisites

- RabbitMQ server running
- Node.js installed

### Installation

```bash
npm install amqplib
```

### Running the Example

```bash
# Run with default settings
node main.js

# Or with custom settings
AMQP_URL=amqp://localhost:5672 MESSAGE_COUNT=200 PUBLISH_INTERVAL=250 node main.js
```

### Configuration

You can customize the script using environment variables:

| Variable            | Description                    | Default                 |
| ------------------- | ------------------------------ | ----------------------- |
| `AMQP_URL`          | RabbitMQ AMQP connection URL   | `amqp://localhost:5672` |
| `RABBITMQ_USERNAME` | RabbitMQ username              | `guest`                 |
| `RABBITMQ_PASSWORD` | RabbitMQ password              | `guest`                 |
| `MESSAGE_COUNT`     | Number of messages to publish  | `100`                   |
| `PUBLISH_INTERVAL`  | Interval between messages (ms) | `500`                   |

### What it Creates

1. **Exchanges**:
   - `test.direct` (direct exchange)
   - `test.topic` (topic exchange)
   - `test.fanout` (fanout exchange)

2. **Queues**:
   - `test.queue.1` - Normal queue with JSON messages
   - `test.queue.2` - Order processing queue
   - `test.queue.delayed` - Queue with messages that have expiration
   - `test.queue.high-volume` - High volume queue bound to fanout exchange
   - `test.queue.durable` - Durable queue with persistent messages
   - `test.queue.no-consumers` - Queue with no consumers

3. **Message Types**:
   - JSON user data
   - JSON order data
   - Delayed tasks
   - Simple text messages
   - Persistent messages
   - Messages with custom headers

### Testing UI Features

After running the script, you can use rmq-board to:

1. **View message contents** - Go to the Queues tab, find a queue, and click "View"
2. **Test search functionality** - Use the search box to filter queues by name
3. **Examine message properties** - View messages to see their properties, headers, and content
4. **Test purge functionality** - Try purging a queue to remove all its messages
5. **View exchanges** - See the created exchanges and their bindings
6. **Publish messages** - Use the Publish tab to send new messages to the test exchanges

## Docker Integration

You can run the test script alongside RabbitMQ and rmq-board in Docker:

```yaml
# docker-compose.yml with test script
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3-management
    # ... other config ...

  rmq-board:
    # ... config ...

  test-generator:
    build:
      context: .
      dockerfile: Dockerfile.test
    environment:
      - AMQP_URL=amqp://rabbitmq:5672
      - MESSAGE_COUNT=200
    depends_on:
      - rabbitmq
```

Example Dockerfile.test:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY examples/main.js .
COPY package.json .

RUN npm install amqplib

CMD ["node", "main.js"]
```