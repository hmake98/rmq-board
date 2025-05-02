// src/components/MessageViewer.jsx
import React, { useState } from "react";
import {
  Empty,
  Card,
  Tabs,
  Typography,
  Badge,
  Tag,
  Collapse,
  Button,
  Divider,
  Space,
  Alert,
  Tooltip,
  Table,
  Input,
  Modal,
  message,
} from "antd";
import {
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FullscreenOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";

const { Text, Paragraph, Title } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Search } = Input;

const MessageViewer = ({ messages = [], loading = false, onRefresh }) => {
  const [searchText, setSearchText] = useState("");
  const [expandedMessage, setExpandedMessage] = useState(null);
  const [filteredMessages, setFilteredMessages] = useState(messages);

  // Update filtered messages when messages or search text changes
  React.useEffect(() => {
    if (!searchText) {
      setFilteredMessages(messages);
      return;
    }

    const filtered = messages.filter((message) => {
      const contentStr =
        typeof message.payload === "object"
          ? JSON.stringify(message.payload)
          : String(message.payload);

      return contentStr.toLowerCase().includes(searchText.toLowerCase());
    });

    setFilteredMessages(filtered);
  }, [messages, searchText]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <div className="loading-spinner"></div>
        <div style={{ marginTop: 16 }}>Loading messages...</div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <Empty
        description="No messages in this queue"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  // Function to format JSON content
  const formatJSON = (content) => {
    try {
      if (typeof content === "string") {
        // Try to parse if it's a JSON string
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } else if (typeof content === "object") {
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
      if (typeof content === "string") {
        JSON.parse(content);
        return true;
      }
      return typeof content === "object";
    } catch (e) {
      return false;
    }
  };

  // Function to copy content to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success("Copied to clipboard");
  };

  // Function to download content as file
  const downloadContent = (content, filename = "message.json") => {
    const element = document.createElement("a");
    let fileContent = content;

    if (typeof content === "object") {
      fileContent = JSON.stringify(content, null, 2);
    }

    const file = new Blob([fileContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Format message timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";

    try {
      // If it's a number (Unix timestamp), convert to milliseconds if needed
      if (typeof timestamp === "number") {
        // If timestamp is in seconds (Unix timestamp), convert to milliseconds
        const timestampMs =
          timestamp < 10000000000 ? timestamp * 1000 : timestamp;
        return new Date(timestampMs).toLocaleString();
      }

      // If it's already a date string
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      console.error("Error formatting timestamp:", e);
      return String(timestamp);
    }
  };

  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
  };

  // View expanded message modal
  const viewExpandedMessage = (message) => {
    setExpandedMessage(message);
  };

  // Close expanded message modal
  const closeExpandedMessage = () => {
    setExpandedMessage(null);
  };

  // Render a single message
  const renderMessage = (message, index) => {
    const { payload, properties, routing_key, exchange, redelivered } = message;

    const timestamp = properties?.timestamp;

    return (
      <Card
        key={index}
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Space>
              <span>Message #{index + 1}</span>
              {timestamp && (
                <Tooltip title={formatTimestamp(timestamp)}>
                  <Badge
                    count={<ClockCircleOutlined style={{ color: "#1890ff" }} />}
                    offset={[5, 0]}
                  />
                </Tooltip>
              )}
            </Space>
            <Space>
              {redelivered && <Badge status="warning" text="Redelivered" />}
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
                onClick={() =>
                  downloadContent(payload, `message-${index + 1}.json`)
                }
                title="Download content"
              >
                Download
              </Button>
              <Button
                icon={<FullscreenOutlined />}
                size="small"
                onClick={() => viewExpandedMessage(message)}
                title="View in full screen"
              >
                Expand
              </Button>
            </Space>
          </div>
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
                    <Text>{exchange || "(direct)"}</Text>
                  </div>
                )}
                {routing_key && (
                  <div>
                    <Text strong>Routing Key: </Text>
                    <Text>{routing_key}</Text>
                  </div>
                )}
                {timestamp && (
                  <div>
                    <Text strong>Timestamp: </Text>
                    <Text>{formatTimestamp(timestamp)}</Text>
                  </div>
                )}
              </div>
            </div>

            <Divider orientation="left">Content</Divider>

            {isJSON(payload) ? (
              <pre
                style={{
                  backgroundColor: "#212121",
                  color: "#f5f5f5",
                  padding: 16,
                  borderRadius: 4,
                  maxHeight: "300px",
                  overflow: "auto",
                  fontSize: "14px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {formatJSON(payload)}
              </pre>
            ) : (
              <Paragraph
                style={{
                  backgroundColor: "#212121",
                  color: "#f5f5f5",
                  padding: 16,
                  borderRadius: 4,
                  maxHeight: "300px",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {String(payload)}
              </Paragraph>
            )}
          </TabPane>

          <TabPane tab="Properties" key="properties">
            <Collapse defaultActiveKey={["basic"]}>
              <Panel header="Basic Properties" key="basic">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "150px 1fr",
                    rowGap: "8px",
                  }}
                >
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
                      <Text>{formatTimestamp(properties.timestamp)}</Text>
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

              {properties.headers &&
                Object.keys(properties.headers).length > 0 && (
                  <Panel header="Headers" key="headers">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "150px 1fr",
                        rowGap: "8px",
                      }}
                    >
                      {Object.entries(properties.headers).map(
                        ([key, value]) => (
                          <React.Fragment key={key}>
                            <Text strong>{key}:</Text>
                            <Text>
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </Text>
                          </React.Fragment>
                        )
                      )}
                    </div>
                  </Panel>
                )}
            </Collapse>
          </TabPane>
        </Tabs>
      </Card>
    );
  };

  // Render expanded message modal
  const renderExpandedMessageModal = () => {
    if (!expandedMessage) return null;

    const { payload, properties, routing_key, exchange, redelivered } =
      expandedMessage;

    return (
      <Modal
        title="Message Details"
        open={!!expandedMessage}
        onCancel={closeExpandedMessage}
        width={1000}
        footer={[
          <Button key="close" onClick={closeExpandedMessage}>
            Close
          </Button>,
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(formatJSON(payload))}
          >
            Copy Content
          </Button>,
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={() => downloadContent(payload, "message.json")}
          >
            Download
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Alert
              message={
                <Space>
                  {redelivered && <Badge status="warning" text="Redelivered" />}
                  <Text>
                    Received from exchange:{" "}
                    <strong>{exchange || "(direct)"}</strong>
                  </Text>
                  <Text>
                    Routing key: <strong>{routing_key}</strong>
                  </Text>
                </Space>
              }
              type="info"
              showIcon
            />

            {properties.content_type && (
              <Text>
                Content Type: <strong>{properties.content_type}</strong>
              </Text>
            )}

            {properties.timestamp && (
              <Text>
                Timestamp:{" "}
                <strong>{formatTimestamp(properties.timestamp)}</strong>
              </Text>
            )}
          </Space>
        </div>

        <Divider>Message Content</Divider>

        {isJSON(payload) ? (
          <pre
            style={{
              backgroundColor: "#212121",
              color: "#f5f5f5",
              padding: 16,
              borderRadius: 4,
              maxHeight: "500px",
              overflow: "auto",
              fontSize: "14px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {formatJSON(payload)}
          </pre>
        ) : (
          <Paragraph
            style={{
              backgroundColor: "#212121",
              color: "#f5f5f5",
              padding: 16,
              borderRadius: 4,
              maxHeight: "500px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {String(payload)}
          </Paragraph>
        )}

        <Divider>Message Properties</Divider>

        <Table
          dataSource={Object.entries(properties)
            .filter(([key, value]) => value !== undefined && key !== "headers")
            .map(([key, value], index) => ({
              key: index,
              property: key,
              value:
                typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value),
            }))}
          columns={[
            {
              title: "Property",
              dataIndex: "property",
              key: "property",
              width: "30%",
            },
            { title: "Value", dataIndex: "value", key: "value" },
          ]}
          size="small"
          pagination={false}
        />

        {properties.headers && Object.keys(properties.headers).length > 0 && (
          <>
            <Title level={5} style={{ marginTop: 16 }}>
              Headers
            </Title>
            <Table
              dataSource={Object.entries(properties.headers).map(
                ([key, value], index) => ({
                  key: index,
                  header: key,
                  value:
                    typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value),
                })
              )}
              columns={[
                {
                  title: "Header",
                  dataIndex: "header",
                  key: "header",
                  width: "30%",
                },
                { title: "Value", dataIndex: "value", key: "value" },
              ]}
              size="small"
              pagination={false}
            />
          </>
        )}
      </Modal>
    );
  };

  return (
    <div className="message-viewer">
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text>
          Showing {filteredMessages.length} of {messages.length} message
          {messages.length !== 1 ? "s" : ""}
          <Text type="secondary" style={{ marginLeft: 8 }}>
            Messages are automatically requeued when viewed.
          </Text>
        </Text>

        <Space>
          <Search
            placeholder="Search in messages"
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />

          <Button type="primary" icon={<ReloadOutlined />} onClick={onRefresh}>
            Refresh
          </Button>
        </Space>
      </div>

      {filteredMessages.length === 0 && searchText && (
        <Alert
          message="No matches found"
          description="Try changing your search criteria"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {filteredMessages.map((message, index) => renderMessage(message, index))}

      {renderExpandedMessageModal()}
    </div>
  );
};

export default MessageViewer;
