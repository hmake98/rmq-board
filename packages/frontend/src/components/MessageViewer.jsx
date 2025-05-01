import React, { useState } from 'react';
import { Empty, Card, Tabs, Typography, Badge, Tag, Collapse, Button, Divider, Space, Tooltip } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const MessageViewer = ({ messages = [] }) => {
    const [activeMessage, setActiveMessage] = useState(0);

    if (!messages || messages.length === 0) {
        return <Empty description="No messages in this queue" />;
    }

    // Function to format JSON content
    const formatJSON = (content) => {
        try {
            if (typeof content === 'string') {
                // Try to parse if it's a JSON string
                const parsed = JSON.parse(content);
                return JSON.stringify(parsed, null, 2);
            } else if (typeof content === 'object') {
                // Already an object, just stringify
                return JSON.stringify(content, null, 2);
            }
            return content;
        } catch (e) {
            // If not valid JSON, return as is
            return content;
        }
    };

    // Function to determine if content is JSON
    const isJSON = (content) => {
        try {
            if (typeof content === 'string') {
                JSON.parse(content);
                return true;
            }
            return typeof content === 'object';
        } catch (e) {
            return false;
        }
    };

    // Function to copy content to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    // Function to download content as file
    const downloadContent = (content, filename = 'message.json') => {
        const element = document.createElement('a');
        let fileContent = content;

        if (typeof content === 'object') {
            fileContent = JSON.stringify(content, null, 2);
        }

        const file = new Blob([fileContent], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    // Render a single message
    const renderMessage = (message, index) => {
        const { payload, properties, routing_key, exchange, redelivered } = message;

        return (
            <Card
                key={index}
                title={`Message #${index + 1}`}
                extra={
                    <Space>
                        {redelivered && (
                            <Badge status="warning" text="Redelivered" />
                        )}
                        <Button
                            icon={<CopyOutlined />}
                            size="small"
                            onClick={() => copyToClipboard(formatJSON(payload))}
                            title="Copy to clipboard"
                        >
                            Copy
                        </Button>
                        <Button
                            icon={<DownloadOutlined />}
                            size="small"
                            onClick={() => downloadContent(payload, `message-${index + 1}.json`)}
                            title="Download content"
                        >
                            Download
                        </Button>
                    </Space>
                }
                style={{ marginBottom: 16 }}
            >
                <Tabs defaultActiveKey="content">
                    <TabPane tab="Content" key="content">
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary">Message received from:</Text>
                            <div style={{ marginTop: 8 }}>
                                {exchange && (
                                    <div>
                                        <Text strong>Exchange: </Text>
                                        <Text>{exchange || '(direct)'}</Text>
                                    </div>
                                )}
                                {routing_key && (
                                    <div>
                                        <Text strong>Routing Key: </Text>
                                        <Text>{routing_key}</Text>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Divider orientation="left">Content</Divider>

                        {isJSON(payload) ? (
                            <pre style={{
                                backgroundColor: '#f5f5f5',
                                padding: 16,
                                borderRadius: 4,
                                maxHeight: '400px',
                                overflow: 'auto',
                                fontSize: '14px'
                            }}>
                                {formatJSON(payload)}
                            </pre>
                        ) : (
                            <Paragraph
                                style={{
                                    backgroundColor: '#f5f5f5',
                                    padding: 16,
                                    borderRadius: 4,
                                    maxHeight: '400px',
                                    overflow: 'auto'
                                }}
                            >
                                {String(payload)}
                            </Paragraph>
                        )}
                    </TabPane>

                    <TabPane tab="Properties" key="properties">
                        <Collapse defaultActiveKey={['basic']}>
                            <Panel header="Basic Properties" key="basic">
                                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: '8px' }}>
                                    {properties.content_type && (
                                        <>
                                            <Text strong>Content Type:</Text>
                                            <Text>{properties.content_type}</Text>
                                        </>
                                    )}

                                    {properties.delivery_mode && (
                                        <>
                                            <Text strong>Delivery Mode:</Text>
                                            <Text>
                                                {properties.delivery_mode === 2 ? (
                                                    <Tag color="green">Persistent</Tag>
                                                ) : (
                                                    <Tag>Transient</Tag>
                                                )}
                                            </Text>
                                        </>
                                    )}

                                    {properties.message_id && (
                                        <>
                                            <Text strong>Message ID:</Text>
                                            <Text>{properties.message_id}</Text>
                                        </>
                                    )}

                                    {properties.correlation_id && (
                                        <>
                                            <Text strong>Correlation ID:</Text>
                                            <Text>{properties.correlation_id}</Text>
                                        </>
                                    )}

                                    {properties.timestamp && (
                                        <>
                                            <Text strong>Timestamp:</Text>
                                            <Text>{new Date(properties.timestamp).toLocaleString()}</Text>
                                        </>
                                    )}

                                    {properties.expiration && (
                                        <>
                                            <Text strong>Expiration:</Text>
                                            <Text>{properties.expiration} ms</Text>
                                        </>
                                    )}
                                </div>
                            </Panel>

                            {properties.headers && Object.keys(properties.headers).length > 0 && (
                                <Panel header="Headers" key="headers">
                                    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: '8px' }}>
                                        {Object.entries(properties.headers).map(([key, value]) => (
                                            <React.Fragment key={key}>
                                                <Text strong>{key}:</Text>
                                                <Text>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </Panel>
                            )}
                        </Collapse>
                    </TabPane>
                </Tabs>
            </Card>
        );
    };

    return (
        <div className="message-viewer">
            <div style={{ marginBottom: 16 }}>
                <Text>
                    Showing {messages.length} message{messages.length !== 1 ? 's' : ''}.
                    <Text type="secondary"> Messages are automatically requeued when viewed.</Text>
                </Text>
            </div>

            {messages.map((message, index) => renderMessage(message, index))}
        </div>
    );
};

export default MessageViewer;