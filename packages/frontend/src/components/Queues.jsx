import { useState, useEffect } from "react";
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
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useSocket } from "../context/SocketContext";
import MessageViewer from "./MessageViewer";

const { Text } = Typography;

const Queues = () => {
  const [queues, setQueues] = useState([]);
  const [filteredQueues, setFilteredQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [viewingQueue, setViewingQueue] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { socket } = useSocket();

  // Fetch queues data
  const fetchQueues = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/queues");
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
  };

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

  // View messages in a queue
  const viewMessages = async (queue) => {
    setViewingQueue(queue);
    setMessagesLoading(true);
    setMessages([]);

    try {
      const vhost = encodeURIComponent(queue.vhost);
      const name = encodeURIComponent(queue.name);
      const response = await axios.get(`/api/queues/${vhost}/${name}/get`);
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setError(`Failed to fetch messages from queue "${queue.name}".`);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Close message viewer modal
  const closeMessageViewer = () => {
    setViewingQueue(null);
  };

  // Purge a queue
  const purgeQueue = async (queue) => {
    try {
      const vhost = encodeURIComponent(queue.vhost);
      const name = encodeURIComponent(queue.name);
      await axios.post(`/api/queues/${vhost}/${name}/purge`);
      Modal.success({
        title: "Queue Purged",
        content: `All messages have been purged from "${queue.name}"`,
      });
      fetchQueues(); // Refresh the queue list
    } catch (error) {
      console.error("Error purging queue:", error);
      Modal.error({
        title: "Purge Failed",
        content: `Failed to purge queue "${queue.name}": ${error.message}`,
      });
    }
  };

  // Initialize data and set up event listeners
  useEffect(() => {
    fetchQueues();

    // Set up socket listeners for real-time updates
    if (socket) {
      socket.on("rabbitmq-data", (data) => {
        if (data.queues) {
          setQueues(data.queues);
          filterQueues(data.queues, searchText);
          setLastUpdated(new Date());
        }
      });

      // Clean up event listeners
      return () => {
        socket.off("rabbitmq-data");
      };
    } else {
      // Fallback to polling if no socket
      const intervalId = setInterval(fetchQueues, 5000);
      return () => clearInterval(intervalId);
    }
  }, [socket, searchText]);

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

  // Helper to determine queue health status
  function getQueueHealthStatus(queue) {
    if (queue.state !== "running") {
      return "error";
    }
    if (queue.consumers === 0 && queue.messages > 0) {
      return "warning";
    }
    return "success";
  }

  // Helper to format rate
  function formatRate(rate) {
    if (rate === undefined || rate === null) return "0.00";
    return rate.toFixed(2);
  }

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
        <Input
          placeholder="Search queues by name"
          prefix={<SearchOutlined style={{ color: "rgba(0,0,0,.25)" }} />}
          value={searchText}
          onChange={handleSearch}
          style={{ width: 300 }}
          allowClear
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredQueues.map((q) => ({
            ...q,
            key: `${q.vhost}/${q.name}`,
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

      {/* Message Viewer Modal */}
      <Modal
        title={`Messages in ${viewingQueue?.name}`}
        open={!!viewingQueue}
        onCancel={closeMessageViewer}
        width={800}
        footer={[
          <Button key="close" onClick={closeMessageViewer}>
            Close
          </Button>,
          <Button
            key="refresh"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => viewingQueue && viewMessages(viewingQueue)}
            loading={messagesLoading}
          >
            Refresh
          </Button>,
        ]}
      >
        {messagesLoading ? (
          <div style={{ textAlign: "center", padding: "24px" }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Loading messages...</div>
          </div>
        ) : (
          <MessageViewer messages={messages} />
        )}
      </Modal>
    </div>
  );
};

export default Queues;
