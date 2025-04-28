// examples/main.js
// A utility script to publish test messages to RabbitMQ for UI testing

const amqp = require('amqplib');

// Configuration options - adjust as needed
const config = {
    // Connection URL
    url: process.env.AMQP_URL || 'amqp://localhost:5672',

    // Authentication
    credentials: {
        username: process.env.RABBITMQ_USERNAME || 'guest',
        password: process.env.RABBITMQ_PASSWORD || 'guest'
    },

    // Message generation settings
    messageCount: process.env.MESSAGE_COUNT ? parseInt(process.env.MESSAGE_COUNT) : 100,
    publishInterval: process.env.PUBLISH_INTERVAL ? parseInt(process.env.PUBLISH_INTERVAL) : 500, // ms

    // Test entities to create
    exchanges: [
        { name: 'test.direct', type: 'direct' },
        { name: 'test.topic', type: 'topic' },
        { name: 'test.fanout', type: 'fanout' }
    ],

    queues: [
        { name: 'test.queue.1', bindingKey: 'key.1', exchange: 'test.direct' },
        { name: 'test.queue.2', bindingKey: 'key.2', exchange: 'test.direct' },
        { name: 'test.queue.delayed', bindingKey: 'delay.#', exchange: 'test.topic' },
        { name: 'test.queue.high-volume', bindingKey: '', exchange: 'test.fanout' },
        { name: 'test.queue.durable', durable: true, bindingKey: 'persistent', exchange: 'test.direct' },
        { name: 'test.queue.no-consumers', bindingKey: 'orphaned', exchange: 'test.direct' }
    ]
};

// Message templates with different formats and payloads
const messageTemplates = [
    {
        exchange: 'test.direct',
        routingKey: 'key.1',
        content: () => JSON.stringify({
            id: generateId(),
            timestamp: new Date().toISOString(),
            type: 'user.created',
            data: {
                userId: generateId(),
                name: `User ${Math.floor(Math.random() * 1000)}`,
                email: `user${Math.floor(Math.random() * 1000)}@example.com`,
                roles: ['user', Math.random() > 0.7 ? 'admin' : 'guest']
            }
        }),
        properties: {
            contentType: 'application/json',
            messageId: () => generateId(),
            correlationId: () => generateId(),
            headers: {
                'x-source': 'test-generator',
                'x-priority': 'high'
            }
        }
    },
    {
        exchange: 'test.direct',
        routingKey: 'key.2',
        content: () => JSON.stringify({
            orderId: generateId(),
            timestamp: new Date().toISOString(),
            customer: {
                id: generateId(),
                name: `Customer ${Math.floor(Math.random() * 1000)}`
            },
            items: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => ({
                id: generateId(),
                name: `Product ${Math.floor(Math.random() * 100)}`,
                quantity: Math.floor(Math.random() * 10) + 1,
                price: (Math.random() * 100).toFixed(2)
            })),
            total: (Math.random() * 500).toFixed(2)
        }),
        properties: {
            contentType: 'application/json',
            messageId: () => generateId(),
            headers: {
                'x-order-source': 'website'
            }
        }
    },
    {
        exchange: 'test.topic',
        routingKey: 'delay.short',
        content: () => JSON.stringify({
            id: generateId(),
            taskType: 'process-image',
            priority: 'medium',
            executeAt: new Date(Date.now() + 60000).toISOString()
        }),
        properties: {
            contentType: 'application/json',
            expiration: '60000'
        }
    },
    {
        exchange: 'test.topic',
        routingKey: 'delay.long',
        content: () => JSON.stringify({
            id: generateId(),
            taskType: 'generate-report',
            priority: 'low',
            executeAt: new Date(Date.now() + 3600000).toISOString()
        }),
        properties: {
            contentType: 'application/json',
            expiration: '3600000'
        }
    },
    {
        exchange: 'test.fanout',
        routingKey: '',
        content: () => `Simple text message ${new Date().toISOString()}`,
        properties: {
            contentType: 'text/plain',
            messageId: () => generateId()
        }
    },
    {
        exchange: 'test.direct',
        routingKey: 'persistent',
        content: () => JSON.stringify({
            id: generateId(),
            type: 'important-data',
            timestamp: new Date().toISOString(),
            data: {
                value: (Math.random() * 1000).toFixed(2),
                tags: ['persistent', 'important']
            }
        }),
        properties: {
            contentType: 'application/json',
            persistent: true,
            priority: 10
        }
    },
    {
        exchange: 'test.direct',
        routingKey: 'orphaned',
        content: () => JSON.stringify({
            id: generateId(),
            type: 'waiting-for-consumer',
            timestamp: new Date().toISOString(),
            status: 'pending'
        }),
        properties: {
            contentType: 'application/json',
            headers: {
                'x-needs-processing': 'true'
            }
        }
    }
];

// Utility function to generate a random ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Main function to run the example
async function run() {
    let connection;
    let channel;

    try {
        console.log('Connecting to RabbitMQ...');
        connection = await amqp.connect(config.url);
        channel = await connection.createChannel();

        console.log('Setting up test exchanges and queues...');

        // Create exchanges
        for (const exchange of config.exchanges) {
            await channel.assertExchange(exchange.name, exchange.type, { durable: true });
            console.log(`Created exchange: ${exchange.name} (${exchange.type})`);
        }

        // Create queues and bindings
        for (const queue of config.queues) {
            await channel.assertQueue(queue.name, { durable: !!queue.durable });
            await channel.bindQueue(queue.name, queue.exchange, queue.bindingKey);
            console.log(`Created queue: ${queue.name} bound to ${queue.exchange} with key ${queue.bindingKey || '(empty)'}`);
        }

        // Start publishing messages
        console.log(`\nStarting to publish ${config.messageCount} test messages...`);

        let messagesSent = 0;
        const startTime = Date.now();

        const publishMessage = async () => {
            if (messagesSent >= config.messageCount) {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`\nFinished publishing ${messagesSent} messages in ${duration} seconds`);

                // Close the connection
                await channel.close();
                await connection.close();
                return;
            }

            // Select a random message template
            const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];

            // Prepare message content and properties
            const content = Buffer.from(template.content());
            const properties = { ...template.properties };

            // Process any dynamic properties
            Object.keys(properties).forEach(key => {
                if (typeof properties[key] === 'function') {
                    properties[key] = properties[key]();
                }
            });

            // Publish the message
            channel.publish(template.exchange, template.routingKey, content, properties);

            messagesSent++;
            if (messagesSent % 10 === 0) {
                process.stdout.write(`Published ${messagesSent} messages\r`);
            }

            // Schedule the next message
            setTimeout(publishMessage, config.publishInterval);
        };

        // Start the publishing process
        publishMessage();

    } catch (error) {
        console.error('Error:', error);
        if (channel) await channel.close();
        if (connection) await connection.close();
        process.exit(1);
    }
}

// Run the example if this is the main module
if (require.main === module) {
    run().catch(console.error);
}

module.exports = { run, config };