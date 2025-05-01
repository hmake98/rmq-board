import React, { useState, useEffect } from 'react';
import {
  Form, Input, Button, Select, Card, Alert, Space, Typography,
  Divider, Switch, Row, Col, Tooltip, notification
} from 'antd';
import {
  SendOutlined, InfoCircleOutlined, CodeOutlined,
  CheckCircleOutlined, QuestionCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import JSONEditor from './JSONEditor';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PublishMessage = () => {
  const [form] = Form.useForm();
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [useJsonEditor, setUseJsonEditor] = useState(true);
  const [jsonContent, setJsonContent] = useState('{\n  "message": "Hello, World!"\n}');
  const [jsonValid, setJsonValid] = useState(true);
  const [selectedExchangeType, setSelectedExchangeType] = useState(null);

  // Handle pre-selected exchange from Exchanges tab
  const location = useLocation();
  const preSelectedExchange = location.state?.preSelectedExchange;

  useEffect(() => {
    // Pre-fill form if exchange was selected from Exchanges tab
    if (preSelectedExchange) {
      form.setFieldsValue({
        exchange: `${preSelectedExchange.vhost}|${preSelectedExchange.name}`,
      });
      setSelectedExchangeType(preSelectedExchange.type);
    }

    // Load exchanges
    fetchExchanges();
  }, [form, preSelectedExchange]);

  // Fetch exchanges for the dropdown
  const fetchExchanges = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/exchanges');

      // Group exchanges by vhost
      const exchangesByVhost = {};

      response.data.forEach(exchange => {
        // Skip the default exchange (empty name)
        if (exchange.name === '') return;
        // Skip internal exchanges
        if (exchange.internal) return;

        const vhost = exchange.vhost || '/';

        if (!exchangesByVhost[vhost]) {
          exchangesByVhost[vhost] = [];
        }

        exchangesByVhost[vhost].push(exchange);
      });

      setExchanges(exchangesByVhost);
      setError(null);
    } catch (error) {
      console.error('Error fetching exchanges:', error);
      setError('Failed to fetch exchanges. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Handle exchange selection
  const handleExchangeChange = (value) => {
    if (!value) {
      setSelectedExchangeType(null);
      return;
    }

    // Value is formatted as "vhost|name"
    const [vhost, name] = value.split('|');

    // Find exchange type
    for (const vhostKey in exchanges) {
      const exchangeList = exchanges[vhostKey];
      const exchange = exchangeList.find(e => e.name === name && e.vhost === vhost);

      if (exchange) {
        setSelectedExchangeType(exchange.type);

        // For topic exchanges, provide a helpful default routing key
        if (exchange.type === 'topic' && !form.getFieldValue('routingKey')) {
          form.setFieldsValue({ routingKey: '#' });
        }

        break;
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (values) => {
    // Validate JSON if using JSON editor
    if (useJsonEditor && !jsonValid) {
      notification.error({
        message: 'Invalid JSON',
        description: 'Please fix the JSON content before publishing.',
      });
      return;
    }

    // Prepare payload
    let payload;
    if (useJsonEditor) {
      try {
        payload = JSON.parse(jsonContent);
      } catch (error) {
        notification.error({
          message: 'JSON Parse Error',
          description: 'Could not parse JSON content',
        });
        return;
      }
    } else {
      payload = values.messageContent;
    }

    // Extract vhost and exchange name
    const [vhost, exchangeName] = values.exchange.split('|');

    // Prepare message properties
    const properties = {};
    if (values.contentType) {
      properties.content_type = values.contentType;
    }
    if (values.correlationId) {
      properties.correlation_id = values.correlationId;
    }
    if (values.messageId) {
      properties.message_id = values.messageId;
    }
    if (values.persistent) {
      properties.persistent = true;
      properties.delivery_mode = 2;
    }

    // Add headers if provided
    if (values.headers) {
      try {
        properties.headers = JSON.parse(values.headers);
      } catch (error) {
        notification.warning({
          message: 'Headers Parse Error',
          description: 'Headers are not valid JSON. Publishing without custom headers.',
        });
      }
    }

    // Add timestamp
    properties.timestamp = new Date().getTime();

    setSubmitting(true);

    try {
      const encodedVhost = encodeURIComponent(vhost);
      const encodedName = encodeURIComponent(exchangeName);

      await axios.post(`/api/exchanges/${encodedVhost}/${encodedName}/publish`, {
        routingKey: values.routingKey || '',
        payload,
        properties
      });

      notification.success({
        message: 'Message Published',
        description: `Message published successfully to exchange "${exchangeName}"`,
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
      });

      // Clear routing key and update timestamp for next message
      form.setFieldsValue({
        routingKey: selectedExchangeType === 'topic' ? '#' : '',
        // Keep other fields
      });

    } catch (error) {
      console.error('Error publishing message:', error);
      notification.error({
        message: 'Publish Failed',
        description: `Error publishing message: ${error.response?.data?.error || error.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Render exchange options grouped by vhost
  const renderExchangeOptions = () => {
    const vhosts = Object.keys(exchanges).sort((a, b) => {
      // Default vhost ('/') first, then alphabetically
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b);
    });

    return vhosts.map(vhost => {
      const vhostLabel = vhost === '/' ? 'Default vhost' : `vhost: ${vhost}`;
      const vhostExchanges = exchanges[vhost].sort((a, b) => a.name.localeCompare(b.name));

      return (
        <Select.OptGroup key={vhost} label={vhostLabel}>
          {vhostExchanges.map(exchange => (
            <Option
              key={`${exchange.vhost}|${exchange.name}`}
              value={`${exchange.vhost}|${exchange.name}`}
            >
              {exchange.name} ({exchange.type})
            </Option>
          ))}
        </Select.OptGroup>
      );
    });
  };

  // Helper for JSON editor
  const handleJsonChange = (content) => {
    setJsonContent(content);
  };

  const handleJsonValidation = (isValid) => {
    setJsonValid(isValid);
  };

  // Provide default message content based on exchange type
  const getDefaultMessageContent = () => {
    switch (selectedExchangeType) {
      case 'topic':
        return '{\n  "type": "notification",\n  "message": "This is a topic message",\n  "timestamp": "' + new Date().toISOString() + '"\n}';
      case 'fanout':
        return '{\n  "broadcast": true,\n  "message": "This is a broadcast message",\n  "timestamp": "' + new Date().toISOString() + '"\n}';
      case 'headers':
        return '{\n  "type": "headers-message",\n  "content": "This message is routed by headers",\n  "timestamp": "' + new Date().toISOString() + '"\n}';
      case 'direct':
      default:
        return '{\n  "message": "Hello, World!",\n  "timestamp": "' + new Date().toISOString() + '"\n}';
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2>Publish Message</h2>
      </div>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Form
          form={form}
          name="publishMessage"
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            routingKey: '',
            contentType: 'application/json',
            persistent: true
          }}
        >
          <Row gutter={16}>
            <Col span={24} lg={12}>
              <Form.Item
                name="exchange"
                label="Exchange"
                rules={[{ required: true, message: 'Please select an exchange' }]}
              >
                <Select
                  placeholder="Select an exchange"
                  loading={loading}
                  onChange={handleExchangeChange}
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {renderExchangeOptions()}
                </Select>
              </Form.Item>
            </Col>

            <Col span={24} lg={12}>
              <Form.Item
                name="routingKey"
                label={
                  <Space>
                    <span>Routing Key</span>
                    {selectedExchangeType === 'topic' && (
                      <Tooltip title="For topic exchanges: Use * to match a word, # to match zero or more words">
                        <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                      </Tooltip>
                    )}
                    {selectedExchangeType === 'fanout' && (
                      <Text type="secondary">(ignored for fanout exchanges)</Text>
                    )}
                  </Space>
                }
                rules={[
                  {
                    required: selectedExchangeType === 'direct',
                    message: 'Routing key is required for direct exchanges'
                  }
                ]}
              >
                <Input
                  placeholder={
                    selectedExchangeType === 'topic'
                      ? "Example: orders.*.confirmed"
                      : "Enter routing key"
                  }
                  disabled={selectedExchangeType === 'fanout'}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Message Properties</Divider>

          <Row gutter={16}>
            <Col span={24} lg={8}>
              <Form.Item
                name="contentType"
                label="Content Type"
              >
                <Input
                  placeholder="application/json"
                  addonAfter={
                    <Tooltip title="MIME type of the message content">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  }
                />
              </Form.Item>
            </Col>

            <Col span={24} lg={8}>
              <Form.Item
                name="correlationId"
                label="Correlation ID"
              >
                <Input
                  placeholder="Optional correlation ID"
                  addonAfter={
                    <Tooltip title="Correlation identifier for request/reply pattern">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  }
                />
              </Form.Item>
            </Col>

            <Col span={24} lg={8}>
              <Form.Item
                name="messageId"
                label="Message ID"
              >
                <Input
                  placeholder="Optional message ID"
                  addonAfter={
                    <Tooltip title="Application-specific message identifier">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24} lg={16}>
              <Form.Item
                name="headers"
                label={
                  <Space>
                    <span>Headers</span>
                    <Tooltip title="Custom headers as JSON object">
                      <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <TextArea
                  placeholder='{"x-custom-header": "value"}'
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
              </Form.Item>
            </Col>

            <Col span={24} lg={8}>
              <Form.Item
                name="persistent"
                label="Persistent Message"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="Yes"
                  unCheckedChildren="No"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Message Content</Divider>

          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text>Format:</Text>
              <Button
                type={useJsonEditor ? "primary" : "default"}
                icon={<CodeOutlined />}
                onClick={() => setUseJsonEditor(true)}
              >
                JSON
              </Button>
              <Button
                type={!useJsonEditor ? "primary" : "default"}
                onClick={() => setUseJsonEditor(false)}
              >
                Text
              </Button>
            </Space>
          </div>

          {useJsonEditor ? (
            <div style={{ marginBottom: 16 }}>
              <JSONEditor
                value={jsonContent}
                onChange={handleJsonChange}
                onValidate={handleJsonValidation}
                height="300px"
              />
            </div>
          ) : (
            <Form.Item
              name="messageContent"
              rules={[{ required: true, message: 'Please enter message content' }]}
            >
              <TextArea
                placeholder="Enter message content"
                autoSize={{ minRows: 10, maxRows: 20 }}
              />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={submitting}
              disabled={useJsonEditor && !jsonValid}
              size="large"
            >
              Publish Message
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default PublishMessage;