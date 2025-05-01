import { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Button,
  Spin,
  Alert,
  Typography,
} from "antd";
import {
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import api from "../services/api"; // Import the API service
import { useSocket } from "../context/SocketContext";

const { Text } = Typography;

const Overview = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { socket, isConnected, connectionStatus } = useSocket();

  const fetchOverview = async () => {
    setLoading(true);
    try {
      // Use the API service instead of direct axios call
      const response = await api.getOverview();
      setOverview(response.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (error) {
      console.error("Error fetching overview:", error);
      // Use the error handling helper from api.js
      const errorDetails = api.handleRequestError(error);
      setError(`Failed to fetch overview data: ${errorDetails.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();

    // Listen for real-time updates via Socket.IO
    if (socket) {
      socket.on("rabbitmq-data", (data) => {
        if (data.overview) {
          setOverview(data.overview);
          setLastUpdated(new Date());
        }
      });

      socket.on("rabbitmq-error", (error) => {
        setError(`Socket error: ${error.message}`);
      });

      // Clean up event listeners on unmount
      return () => {
        socket.off("rabbitmq-data");
        socket.off("rabbitmq-error");
      };
    } else {
      // If no socket, fallback to polling
      const intervalId = setInterval(fetchOverview, 5000);
      return () => clearInterval(intervalId);
    }
  }, [socket]);

  // Server info columns
  const columns = [
    {
      title: "Property",
      dataIndex: "property",
      key: "property",
      width: "30%",
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
    },
  ];

  // Server info data
  const serverInfo = overview
    ? [
        {
          key: "1",
          property: "Version",
          value: overview.rabbitmq_version || "-",
        },
        {
          key: "2",
          property: "Erlang Version",
          value: overview.erlang_version || "-",
        },
        {
          key: "3",
          property: "Uptime",
          value: formatUptime(overview.uptime) || "-",
        },
        {
          key: "4",
          property: "Message Rate",
          value: `${formatRate(
            overview.message_stats?.publish_details?.rate
          )} msg/s`,
        },
        { key: "5", property: "Connection Type", value: getConnectionType() },
      ]
    : [];

  // Format uptime
  function formatUptime(uptimeMs) {
    if (!uptimeMs) return "-";

    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Format rate
  function formatRate(rate) {
    if (rate === undefined || rate === null) return "0.00";
    return rate.toFixed(2);
  }

  // Get connection type
  function getConnectionType() {
    const types = [];

    if (connectionStatus?.http) {
      types.push("HTTP API");
    }

    if (connectionStatus?.amqp) {
      types.push("AMQP");
    }

    return types.length > 0 ? types.join(" + ") : "Disconnected";
  }

  if (loading && !overview) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Spin size="large" tip="Loading overview data..." />
      </div>
    );
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
        <h2>RabbitMQ System Overview</h2>
        <div>
          <Text type="secondary" style={{ marginRight: 16 }}>
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : "Never updated"}
          </Text>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchOverview}
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
          style={{ marginBottom: 16 }}
        />
      )}

      {(!isConnected ||
        !(connectionStatus?.http || connectionStatus?.amqp)) && (
        <Alert
          message="Connection Warning"
          description="Not fully connected to the RabbitMQ server. Some features may be unavailable."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="Queues"
              value={overview?.queue_totals?.total || 0}
              loading={loading}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="Connections"
              value={overview?.object_totals?.connections || 0}
              loading={loading}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="Channels"
              value={overview?.object_totals?.channels || 0}
              loading={loading}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="Consumers"
              value={overview?.object_totals?.consumers || 0}
              loading={loading}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="Server Information">
        <Table
          columns={columns}
          dataSource={serverInfo}
          pagination={false}
          loading={loading}
          size="middle"
          bordered
        />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="Connection Status" bordered>
            <div style={{ padding: "8px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                {connectionStatus?.http ? (
                  <CheckCircleOutlined
                    style={{ color: "#52c41a", marginRight: 8 }}
                  />
                ) : (
                  <WarningOutlined
                    style={{ color: "#faad14", marginRight: 8 }}
                  />
                )}
                <span>
                  HTTP API:{" "}
                  {connectionStatus?.http ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {connectionStatus?.amqp ? (
                  <CheckCircleOutlined
                    style={{ color: "#52c41a", marginRight: 8 }}
                  />
                ) : (
                  <WarningOutlined
                    style={{ color: "#faad14", marginRight: 8 }}
                  />
                )}
                <span>
                  AMQP: {connectionStatus?.amqp ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Message Rates" bordered>
            {overview?.message_stats ? (
              <div>
                <Statistic
                  title="Publish Rate"
                  value={
                    formatRate(overview.message_stats.publish_details?.rate) ||
                    0
                  }
                  suffix="msg/s"
                  precision={2}
                />
                {overview.message_stats.deliver_details && (
                  <Statistic
                    title="Deliver Rate"
                    value={
                      formatRate(
                        overview.message_stats.deliver_details?.rate
                      ) || 0
                    }
                    suffix="msg/s"
                    precision={2}
                    style={{ marginTop: 16 }}
                  />
                )}
              </div>
            ) : (
              <div>No message statistics available</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Overview;
