import { useState, useEffect } from "react";
import {
  Table,
  Button,
  Input,
  Space,
  Card,
  Tag,
  Typography,
  Alert,
  Empty,
  Tooltip,
  Collapse,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useSocket } from "../context/SocketContext";

const { Text } = Typography;
const { Panel } = Collapse;

const Bindings = () => {
  const [bindings, setBindings] = useState([]);
  const [filteredBindings, setFilteredBindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const { socket } = useSocket();

  // Fetch bindings data
  const fetchBindings = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/bindings");
      setBindings(response.data);
      filterBindings(response.data, searchText);
      setLastUpdated(new Date());
      setError(null);
    } catch (error) {
      console.error("Error fetching bindings:", error);
      setError("Failed to fetch bindings. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Filter bindings based on search text
  const filterBindings = (bindingData, text) => {
    if (!text) {
      setFilteredBindings(bindingData);
      return;
    }

    const filtered = bindingData.filter(
      (binding) =>
        (binding.source &&
          binding.source.toLowerCase().includes(text.toLowerCase())) ||
        (binding.destination &&
          binding.destination.toLowerCase().includes(text.toLowerCase())) ||
        (binding.routing_key &&
          binding.routing_key.toLowerCase().includes(text.toLowerCase())) ||
        (binding.vhost &&
          binding.vhost.toLowerCase().includes(text.toLowerCase()))
    );

    setFilteredBindings(filtered);
  };

  // Handle search input
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchText(value);
    filterBindings(bindings, value);
  };

  // Initialize data and set up event listeners
  useEffect(() => {
    fetchBindings();

    // Set up socket listeners for real-time updates if available
    if (socket) {
      socket.on("rabbitmq-data", (data) => {
        if (data.bindings) {
          setBindings(data.bindings);
          filterBindings(data.bindings, searchText);
          setLastUpdated(new Date());
        }
      });

      // Clean up event listeners
      return () => {
        socket.off("rabbitmq-data");
      };
    } else {
      // Fallback to polling if no socket
      const intervalId = setInterval(fetchBindings, 10000); // Less frequent updates for bindings
      return () => clearInterval(intervalId);
    }
  }, [socket, searchText]);

  // Format argument values for display
  const formatArgValue = (value) => {
    if (value === null || value === undefined) {
      return "null";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  };

  // Table columns
  const columns = [
    {
      title: "Source",
      key: "source",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            {record.source === "" ? (
              <Text italic>(default exchange)</Text>
            ) : (
              <Text strong>{record.source}</Text>
            )}
            <Tag color="blue">{record.source_type || "exchange"}</Tag>
          </Space>
          {record.vhost && record.vhost !== "/" && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              vhost: {record.vhost}
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => {
        // Make default exchange (empty string) show at the top
        if (a.source === "") return -1;
        if (b.source === "") return 1;
        return a.source.localeCompare(b.source);
      },
    },
    {
      title: "Destination",
      key: "destination",
      render: (_, record) => (
        <Space>
          <Text strong>{record.destination}</Text>
          <Tag color={record.destination_type === "queue" ? "green" : "blue"}>
            {record.destination_type}
          </Tag>
        </Space>
      ),
      sorter: (a, b) => a.destination.localeCompare(b.destination),
      filters: [
        { text: "Queue Destinations", value: "queue" },
        { text: "Exchange Destinations", value: "exchange" },
      ],
      onFilter: (value, record) => record.destination_type === value,
    },
    {
      title: (
        <Space>
          <span>Routing Key</span>
          <Tooltip title="Pattern used to match message routing keys">
            <QuestionCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: "routing_key",
      key: "routing_key",
      render: (text) => {
        if (text === "") {
          return <Text italic>(empty string)</Text>;
        }
        return <Text code>{text}</Text>;
      },
      sorter: (a, b) =>
        (a.routing_key || "").localeCompare(b.routing_key || ""),
    },
    {
      title: (
        <Space>
          <span>Arguments</span>
          <Tooltip title="Additional binding parameters">
            <QuestionCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
          </Tooltip>
        </Space>
      ),
      key: "arguments",
      render: (_, record) => {
        const args = record.arguments || {};
        const argEntries = Object.entries(args);

        if (argEntries.length === 0) {
          return <Text type="secondary">None</Text>;
        }

        return (
          <Collapse ghost size="small">
            <Panel header={`${argEntries.length} argument(s)`} key="1">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {argEntries.map(([key, value]) => (
                  <li key={key}>
                    <Text strong>{key}:</Text> {formatArgValue(value)}
                  </li>
                ))}
              </ul>
            </Panel>
          </Collapse>
        );
      },
    },
  ];

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
        <h2>Bindings</h2>
        <div>
          <Text type="secondary" style={{ marginRight: 16 }}>
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : "Never updated"}
          </Text>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchBindings}
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
            placeholder="Search bindings by source, destination, or routing key"
            prefix={<SearchOutlined style={{ color: "rgba(0,0,0,.25)" }} />}
            value={searchText}
            onChange={handleSearch}
            style={{ width: 360 }}
            allowClear
          />

          <Tooltip title="Bindings connect exchanges to queues or other exchanges">
            <Text type="secondary">
              Total: {filteredBindings.length} binding
              {filteredBindings.length !== 1 ? "s" : ""}
            </Text>
          </Tooltip>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredBindings.map((b, i) => ({
            ...b,
            key:
              b.source && b.destination
                ? `${b.vhost}/${b.source}/${b.destination}/${b.routing_key}/${i}`
                : i,
          }))}
          loading={loading}
          size="middle"
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          locale={{
            emptyText: <Empty description="No bindings found" />,
          }}
        />
      </Card>
    </div>
  );
};

export default Bindings;
