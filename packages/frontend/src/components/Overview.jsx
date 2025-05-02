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

      // Log the raw response to debug
      console.log("Raw overview response:", response.data);

      // Safely handle the data to prevent circular references
      const safeOverview = JSON.parse(JSON.stringify(response.data));
      setOverview(safeOverview);
      setLastUpdated(new Date());
      setError(null);
    } catch (error) {
      console.error("Error fetching overview:", error);
      // Use the error handling helper from api.js
      const errorDetails = api.handleRequestError
        ? api.handleRequestError(error)
        : { message: error.message || "Unknown error" };
      setError(`Failed to fetch overview data: ${errorDetails.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();

    // Listen for real-time updates via Socket.IO
    if (socket) {
      const handleRabbitMQData = (data) => {
        try {
          if (data && data.overview) {
            console.log("Received overview data via socket:", data.overview);

            // Safely handle the data to prevent circular references
            const safeOverview = JSON.parse(JSON.stringify(data.overview));
            setOverview(safeOverview);
            setLastUpdated(new Date());
          }
        } catch (err) {
          console.error("Error processing socket data:", err);
          setError(`Error processing socket data: ${err.message}`);
        }
      };

      const handleRabbitMQError = (errorData) => {
        try {
          setError(`Socket error: ${errorData?.message || "Unknown error"}`);
        } catch (err) {
          console.error("Error handling socket error:", err);
          setError(`Socket error occurred`);
        }
      };

      // Add event listeners with named functions for proper cleanup
      socket.on("rabbitmq-data", handleRabbitMQData);
      socket.on("rabbitmq-error", handleRabbitMQError);

      // Clean up event listeners on unmount
      return () => {
        socket.off("rabbitmq-data", handleRabbitMQData);
        socket.off("rabbitmq-error", handleRabbitMQError);
      };
    } else {
      // If no socket, fallback to polling
      const intervalId = setInterval(fetchOverview, 5000);
      return () => clearInterval(intervalId);
    }
  }, [socket]);

  /**
   * Converts an uptime value in milliseconds or seconds to a human-readable string.
   *
   * Handles null, undefined, non-numeric, and string inputs gracefully, returning "-" for invalid values. Automatically detects and adjusts for values reported in either milliseconds or seconds.
   *
   * @param {number|string|null|undefined} uptimeMs - The uptime value to format, in milliseconds or seconds.
   * @returns {string} The formatted uptime string (e.g., "2d 3h 15m", "45s"), or "-" if the input is invalid.
   */
  function formatUptime(uptimeMs) {
    console.log("Formatting uptime value:", uptimeMs, typeof uptimeMs);

    if (uptimeMs === undefined || uptimeMs === null) {
      return "-";
    }

    try {
      // Convert to number if it's a string
      const uptimeValue =
        typeof uptimeMs === "string" ? parseInt(uptimeMs, 10) : uptimeMs;

      if (isNaN(uptimeValue)) {
        console.warn("Uptime value is NaN:", uptimeMs);
        return "-";
      }

      // RabbitMQ might report uptime in milliseconds or in seconds
      // If the value is very small, it might be in seconds, so convert to ensure consistency
      const seconds =
        uptimeValue > 1000 ? Math.floor(uptimeValue / 1000) : uptimeValue;

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
    } catch (error) {
      console.error("Error formatting uptime:", error);
      return "-";
    }
  }

  /**
   * Retrieves the server uptime value from the overview data, checking multiple possible fields and providing fallbacks.
   *
   * @returns {number|null} The uptime in milliseconds, or {@code null} if overview data is unavailable.
   *
   * @remark
   * If no explicit uptime is found, attempts to calculate it from the server's start time. If all sources are missing, returns a default value of 10,000 milliseconds.
   */
  function getUptimeValue() {
    if (!overview) return null;

    // Try all possible fields that might contain uptime
    return (
      overview.uptime ||
      overview.uptime_in_ms ||
      overview.server_info?.process_uptime_ms ||
      // If the server has just started and there's no uptime yet, calculate from now
      (overview.server_info?.start_time
        ? Date.now() - new Date(overview.server_info.start_time).getTime()
        : null) ||
      // Fallback - set a minimal uptime value so at least something displays
      10000
    ); // 10 seconds as fallback
  }

  /**
   * Formats a numeric rate value to a string with two decimal places, returning "0.00" for null, undefined, or invalid input.
   *
   * @param {number|string|null|undefined} rate - The rate value to format.
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

  /**
   * Determines the current RabbitMQ connection type based on connection status.
   *
   * @returns {string} A string describing the active connection types ("HTTP API", "AMQP", "HTTP API + AMQP", or "Disconnected").
   */
  function getConnectionType() {
    try {
      if (!connectionStatus) return "Disconnected";

      const types = [];

      if (connectionStatus.http) {
        types.push("HTTP API");
      }

      if (connectionStatus.amqp) {
        types.push("AMQP");
      }

      return types.length > 0 ? types.join(" + ") : "Disconnected";
    } catch (error) {
      console.error("Error getting connection type:", error);
      return "Disconnected";
    }
  }

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

  // Server info data with safety checks and improved uptime handling
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
          value: formatUptime(getUptimeValue()),
        },
        {
          key: "4",
          property: "Message Rate",
          value: `${formatRate(
            overview.message_stats?.publish_details?.rate
          )} msg/s`,
        },
        { key: "5", property: "Connection Type", value: getConnectionType() },
        {
          key: "6",
          property: "Start Time",
          value: overview.server_info?.start_time
            ? new Date(overview.server_info.start_time).toLocaleString()
            : "-",
        },
      ]
    : [];

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
        !(connectionStatus?.http && connectionStatus?.amqp)) && (
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
                    formatRate(overview.message_stats?.publish_details?.rate) ||
                    0
                  }
                  suffix="msg/s"
                  precision={2}
                />
                {overview.message_stats?.deliver_details && (
                  <Statistic
                    title="Deliver Rate"
                    value={
                      formatRate(
                        overview.message_stats?.deliver_details?.rate
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
