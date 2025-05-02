// src/components/Queues.jsx
import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Input,
  Space,
  Card,
  Tag,
  Modal,
  Typography,
  Spin,
  Alert,
  Tooltip,
  Badge,
  Popconfirm,
  Empty,
  notification,
  Drawer,
  Statistic,
  Tabs,
  Row,
  Col,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  AreaChartOutlined,
} from "@ant-design/icons";
import api from "../services/api"; // Import the API service
import { useSocket } from "../context/SocketContext";
import MessageViewer from "./MessageViewer";

const { Text, Title } = Typography;
const { TabPane } = Tabs;

const Queues = () => {
  const [queues, setQueues] = useState([]);
  const [filteredQueues, setFilteredQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [viewingQueue, setViewingQueue] = useState(null);
  const [queueDetails, setQueueDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { socket, isConnected, connectionStatus } = useSocket();
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Fetch queues data
  const fetchQueues = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getQueues();
      console.log("Queues data received:", response.data);
      setQueues(response.data);
      filterQueues(response.data, searchText);
      setLastUpdated(new Date());
      setError(null);
    } catch (error) {
      console.error("Error fetching queues:", error);
      setError("Failed to fetch queues. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  // Filter queues based on search text
  const filterQueues = (queueData, text) => {
    if (!text) {
      setFilteredQueues(queueData);
      return;
    }

    const filtered = queueData.filter(
      (queue) =>
        queue.name.toLowerCase().includes(text.toLowerCase()) ||
        (queue.vhost && queue.vhost.toLowerCase().includes(text.toLowerCase()))
    );

    setFilteredQueues(filtered);
  };

  // Handle search input
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchText(value);
    filterQueues(queues, value);
  };

  // Fetch queue details
  const fetchQueueDetails = async (queue) => {
    try {
      const vhost = encodeURIComponent(queue.vhost || "/");
      const name = encodeURIComponent(queue.name);
      const response = await api.getQueue(vhost, name);
      console.log("Queue details received:", response.data);
      // Ensure we're getting a plain object with no circular references
      setQueueDetails(JSON.parse(JSON.stringify(response.data)));
    } catch (error) {
      console.error("Error fetching queue details:", error);
      notification.error({
        message: "Error",
        description: `Failed to fetch details for queue "${queue.name}"`,
      });
    }
  };

  // View messages in a queue
  const viewMessages = async (queue) => {
    setViewingQueue(queue);
    setMessagesLoading(true);
    setMessages([]);
    setDrawerVisible(true);

    try {
      // await fetchQueueDetails(queue);

      const vhost = encodeURIComponent(queue.vhost || "/");
      const name = encodeURIComponent(queue.name);
      const response = await api.getQueueMessages(vhost, name);
      console.log("Queue messages received:", response.data);
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setError(`Failed to fetch messages from queue "${queue.name}".`);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Refresh messages for the currently viewed queue
  const refreshMessages = async () => {
    if (!viewingQueue) return;

    setMessagesLoading(true);
    try {
      const vhost = encodeURIComponent(viewingQueue.vhost || "/");
      const name = encodeURIComponent(viewingQueue.name);
      const response = await api.getQueueMessages(vhost, name);
      setMessages(response.data);
      await fetchQueueDetails(viewingQueue);
      notification.success({
        message: "Messages Refreshed",
        description: `Successfully refreshed messages from queue "${viewingQueue.name}"`,
        duration: 2,
      });
    } catch (error) {
      console.error("Error refreshing messages:", error);
      notification.error({
        message: "Error",
        description: `Failed to refresh messages from queue "${viewingQueue.name}"`,
      });
    } finally {
      setMessagesLoading(false);
    }
  };

  // Close message viewer drawer
  const closeMessageViewer = () => {
    setViewingQueue(null);
    setQueueDetails(null);
    setDrawerVisible(false);
  };

  // Purge a queue
  const purgeQueue = async (queue) => {
    try {
      const vhost = encodeURIComponent(queue.vhost || "/");
      const name = encodeURIComponent(queue.name);
      await api.purgeQueue(vhost, name);

      notification.success({
        message: "Queue Purged",
        description: `All messages have been purged from "${queue.name}"`,
      });

      fetchQueues();

      // If we're currently viewing this queue, refresh its messages
      if (
        viewingQueue &&
        viewingQueue.name === queue.name &&
        viewingQueue.vhost === queue.vhost
      ) {
        refreshMessages();
      }
    } catch (error) {
      console.error("Error purging queue:", error);
      notification.error({
        message: "Purge Failed",
        description: `Failed to purge queue "${queue.name}": ${error.message}`,
      });
    }
  };

  // Initialize data and set up event listeners
  useEffect(() => {
    fetchQueues();

    // Set up socket listeners for real-time updates
    if (socket) {
      const handleRabbitMQData = (data) => {
        try {
          // Safely handle incoming data by ensuring it's a plain object
          if (data && data.queues) {
            console.log("Socket data received:", data.timestamp);
            // Create a safe copy to avoid circular references
            const safeQueues = JSON.parse(JSON.stringify(data.queues));
            setQueues(safeQueues);
            filterQueues(safeQueues, searchText);
            setLastUpdated(new Date());
          }
        } catch (error) {
          console.error("Error processing socket data:", error);
        }
      };

      // Add event listener
      socket.on("rabbitmq-data", handleRabbitMQData);

      // Clean up event listeners
      return () => {
        socket.off("rabbitmq-data", handleRabbitMQData);
      };
    } else {
      // Fallback to polling if no socket
      const intervalId = setInterval(fetchQueues, 5000);
      return () => clearInterval(intervalId);
    }
  }, [socket, searchText, fetchQueues]);

  /**
   * Determines the health status of a RabbitMQ queue based on its state, consumer count, and message count.
   *
   * @param {Object} queue - The queue object to evaluate.
   * @returns {string} Returns "error" if the queue is not running or missing state, "warning" if there are messages but no consumers, or "success" if the queue is running with consumers or no messages.
   */
  function getQueueHealthStatus(queue) {
    if (!queue || !queue.state) return "error";

    if (queue.state !== "running") {
      return "error";
    }
    if ((queue.consumers === 0 || !queue.consumers) && queue.messages > 0) {
      return "warning";
    }
    return "success";
  }

  /**
   * Formats a numeric rate value to a string with two decimal places.
   *
   * Returns "0.00" if the input is undefined, null, or cannot be converted to a number.
   *
   * @param {number|string} rate - The rate value to format.
   * @returns {string} The formatted rate as a string with two decimal places.
   */
  function formatRate(rate) {
    if (rate === undefined || rate === null) return "0.00";
    try {
      return Number(rate).toFixed(2);
    } catch (error) {
      console.error("Error formatting rate:", error);
      return "0.00";
    }
  }

  // Table columns
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Badge status={getQueueHealthStatus(record)} text={null} />
            <Text strong>{text}</Text>
          </Space>
          {record.vhost && record.vhost !== "/" && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              vhost: {record.vhost}
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "State",
      dataIndex: "state",
      key: "state",
      render: (state) => {
        let color = "green";
        if (state !== "running") {
          color = "orange";
        }
        return <Tag color={color}>{state || "unknown"}</Tag>;
      },
      filters: [
        { text: "Running", value: "running" },
        { text: "Not Running", value: "not-running" },
      ],
      onFilter: (value, record) => {
        if (value === "running") {
          return record.state === "running";
        }
        return record.state !== "running";
      },
    },
    {
      title: "Messages",
      dataIndex: "messages",
      key: "messages",
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text>{text || 0}</Text>
          {record.message_stats && record.message_stats.publish_details && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {formatRate(record.message_stats.publish_details.rate)} msg/s
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => (a.messages || 0) - (b.messages || 0),
    },
    {
      title: "Consumers",
      dataIndex: "consumers",
      key: "consumers",
      render: (consumers) => {
        let color = "default";
        if (consumers === 0) {
          color = "warning";
        }
        return <Tag color={color}>{consumers || 0}</Tag>;
      },
      filters: [
        { text: "Has Consumers", value: "has-consumers" },
        { text: "No Consumers", value: "no-consumers" },
      ],
      onFilter: (value, record) => {
        if (value === "has-consumers") {
          return record.consumers > 0;
        }
        return record.consumers === 0;
      },
      sorter: (a, b) => (a.consumers || 0) - (b.consumers || 0),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Messages">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => viewMessages(record)}
              disabled={record.messages === 0}
            />
          </Tooltip>
          <Tooltip title="Purge Queue">
            <Popconfirm
              title="Purge queue"
              description={`Are you sure you want to purge all messages from "${record.name}"?`}
              onConfirm={() => purgeQueue(record)}
              okText="Yes"
              cancelText="No"
              icon={<ExclamationCircleOutlined style={{ color: "red" }} />}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                disabled={record.messages === 0}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Render queue details in drawer
  const renderQueueDetails = () => {
    if (!queueDetails) {
      return <Spin />;
    }

    return (
      <div>
        <Tabs defaultActiveKey="stats">
          <TabPane
            tab={
              <span>
                <InfoCircleOutlined /> Queue Stats
              </span>
            }
            key="stats"
          >
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Messages Ready"
                    value={queueDetails.messages_ready || 0}
                    valueStyle={{
                      color:
                        queueDetails.messages_ready > 0 ? "#ff4d4f" : "#52c41a",
                    }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Messages Unacknowledged"
                    value={queueDetails.messages_unacknowledged || 0}
                    valueStyle={{
                      color:
                        queueDetails.messages_unacknowledged > 0
                          ? "#faad14"
                          : "#52c41a",
                    }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Total Messages"
                    value={queueDetails.messages || 0}
                  />
                </Card>
              </Col>
            </Row>

            <Card style={{ marginTop: 16 }}>
              <Title level={5}>Queue Details</Title>
              <Table
                dataSource={[
                  { key: "name", property: "Name", value: queueDetails.name },
                  {
                    key: "vhost",
                    property: "Virtual Host",
                    value: queueDetails.vhost,
                  },
                  {
                    key: "durable",
                    property: "Durable",
                    value: queueDetails.durable ? (
                      <Tag color="green">Yes</Tag>
                    ) : (
                      <Tag color="red">No</Tag>
                    ),
                  },
                  {
                    key: "auto_delete",
                    property: "Auto-delete",
                    value: queueDetails.auto_delete ? (
                      <Tag color="blue">Yes</Tag>
                    ) : (
                      <Tag>No</Tag>
                    ),
                  },
                  {
                    key: "exclusive",
                    property: "Exclusive",
                    value: queueDetails.exclusive ? (
                      <Tag color="purple">Yes</Tag>
                    ) : (
                      <Tag>No</Tag>
                    ),
                  },
                  {
                    key: "consumers",
                    property: "Consumers",
                    value: queueDetails.consumers || 0,
                  },
                  {
                    key: "memory",
                    property: "Memory Usage",
                    value: `${((queueDetails.memory || 0) / (1024 * 1024)).toFixed(2)} MB`,
                  },
                ]}
                columns={[
                  {
                    title: "Property",
                    dataIndex: "property",
                    key: "property",
                    width: "30%",
                  },
                  { title: "Value", dataIndex: "value", key: "value" },
                ]}
                pagination={false}
                size="small"
              />
            </Card>

            {queueDetails.message_stats && (
              <Card style={{ marginTop: 16 }}>
                <Title level={5}>Message Rates</Title>
                <Row gutter={[16, 16]}>
                  {queueDetails.message_stats.publish_details && (
                    <Col span={8}>
                      <Statistic
                        title="Publish Rate"
                        value={formatRate(
                          queueDetails.message_stats.publish_details.rate
                        )}
                        suffix="msg/s"
                        precision={2}
                      />
                    </Col>
                  )}

                  {queueDetails.message_stats.deliver_details && (
                    <Col span={8}>
                      <Statistic
                        title="Deliver Rate"
                        value={formatRate(
                          queueDetails.message_stats.deliver_details.rate
                        )}
                        suffix="msg/s"
                        precision={2}
                      />
                    </Col>
                  )}

                  {queueDetails.message_stats.ack_details && (
                    <Col span={8}>
                      <Statistic
                        title="Acknowledge Rate"
                        value={formatRate(
                          queueDetails.message_stats.ack_details.rate
                        )}
                        suffix="msg/s"
                        precision={2}
                      />
                    </Col>
                  )}
                </Row>
              </Card>
            )}
          </TabPane>

          <TabPane
            tab={
              <span>
                <AreaChartOutlined /> Actions
              </span>
            }
            key="actions"
          >
            <Card>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Alert
                  message="Queue Operations"
                  description="These operations affect the queue and its messages. Use with caution."
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Button
                  type="primary"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={
                    !queueDetails.messages || queueDetails.messages === 0
                  }
                  onClick={() => {
                    Modal.confirm({
                      title: "Purge Queue",
                      icon: <ExclamationCircleOutlined />,
                      content: `Are you sure you want to purge all ${queueDetails.messages} messages from "${queueDetails.name}"? This operation cannot be undone.`,
                      okText: "Yes, Purge Queue",
                      okType: "danger",
                      cancelText: "Cancel",
                      onOk: () => {
                        purgeQueue(viewingQueue);
                      },
                    });
                  }}
                  block
                >
                  Purge All Messages ({queueDetails.messages || 0})
                </Button>

                <Button
                  icon={<ReloadOutlined />}
                  onClick={refreshMessages}
                  block
                >
                  Refresh Queue Data
                </Button>
              </Space>
            </Card>
          </TabPane>
        </Tabs>
      </div>
    );
  };

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Queues</h2>
        <div>
          <Text type="secondary" style={{ marginRight: 16 }}>
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : "Never updated"}
          </Text>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchQueues}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
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

      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Input
            placeholder="Search queues by name"
            prefix={<SearchOutlined style={{ color: "rgba(0,0,0,.25)" }} />}
            value={searchText}
            onChange={handleSearch}
            style={{ width: 300 }}
            allowClear
          />

          <Space>
            {!isConnected && (
              <Alert
                message="Live updates unavailable"
                type="warning"
                showIcon
                banner
                style={{
                  padding: "4px 8px",
                  marginBottom: 0,
                  fontSize: "12px",
                  height: "32px",
                }}
              />
            )}
            <Text>
              Total: {filteredQueues.length} queue
              {filteredQueues.length !== 1 ? "s" : ""}
            </Text>
          </Space>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredQueues.map((q) => ({
            ...q,
            key: `${q.vhost || "/"}/${q.name}`,
          }))}
          loading={loading}
          size="middle"
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          locale={{
            emptyText: <Empty description="No queues found" />,
          }}
        />
      </Card>

      {/* Message Viewer Drawer */}
      <Drawer
        title={
          viewingQueue ? `Messages in ${viewingQueue.name}` : "Queue Messages"
        }
        placement="right"
        closable={true}
        onClose={closeMessageViewer}
        open={drawerVisible}
        width={800}
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={refreshMessages}
            loading={messagesLoading}
          >
            Refresh
          </Button>
        }
      >
        <Tabs defaultActiveKey="messages">
          <TabPane
            tab={
              <span>
                <EyeOutlined /> Messages
              </span>
            }
            key="messages"
          >
            <MessageViewer
              messages={messages}
              loading={messagesLoading}
              onRefresh={refreshMessages}
            />
          </TabPane>

          {/* <TabPane
            tab={
              <span>
                <InfoCircleOutlined /> Queue Info
              </span>
            }
            key="info"
          >
            {renderQueueDetails()}
          </TabPane> */}
        </Tabs>
      </Drawer>
    </div>
  );
};

export default Queues;
