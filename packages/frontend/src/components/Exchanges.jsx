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
  Tooltip,
  Empty,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import api from "../services/api"; // Import the API service
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";

const { Text } = Typography;

const Exchanges = () => {
  const [exchanges, setExchanges] = useState([]);
  const [filteredExchanges, setFilteredExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const { socket } = useSocket();
  const navigate = useNavigate();

  // Fetch exchanges data
  const fetchExchanges = async () => {
    setLoading(true);
    try {
      const response = await api.getExchanges(); // Use the API service instead of direct axios call
      setExchanges(response.data);
      filterExchanges(response.data, searchText);
      setLastUpdated(new Date());
      setError(null);
    } catch (error) {
      console.error("Error fetching exchanges:", error);
      setError("Failed to fetch exchanges. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Filter exchanges based on search text
  const filterExchanges = (exchangeData, text) => {
    if (!text) {
      setFilteredExchanges(exchangeData);
      return;
    }

    const filtered = exchangeData.filter(
      (exchange) =>
        exchange.name.toLowerCase().includes(text.toLowerCase()) ||
        (exchange.vhost &&
          exchange.vhost.toLowerCase().includes(text.toLowerCase())) ||
        (exchange.type &&
          exchange.type.toLowerCase().includes(text.toLowerCase()))
    );

    setFilteredExchanges(filtered);
  };

  // Handle search input
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchText(value);
    filterExchanges(exchanges, value);
  };

  // Navigate to publish message form with exchange pre-selected
  const goToPublish = (exchange) => {
    navigate("/publish", {
      state: {
        preSelectedExchange: {
          name: exchange.name,
          vhost: exchange.vhost,
          type: exchange.type,
        },
      },
    });
  };

  // Initialize data and set up event listeners
  useEffect(() => {
    fetchExchanges();

    // Set up socket listeners for real-time updates
    if (socket) {
      socket.on("rabbitmq-data", (data) => {
        if (data.exchanges) {
          setExchanges(data.exchanges);
          filterExchanges(data.exchanges, searchText);
          setLastUpdated(new Date());
        }
      });

      // Clean up event listeners
      return () => {
        socket.off("rabbitmq-data");
      };
    } else {
      // Fallback to polling if no socket
      const intervalId = setInterval(fetchExchanges, 5000);
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
          {text === "" ? (
            <Text italic>(default exchange)</Text>
          ) : (
            <Text strong>{text}</Text>
          )}
          {record.vhost && record.vhost !== "/" && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              vhost: {record.vhost}
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => {
        // Make default exchange (empty string) show at the top
        if (a.name === "") return -1;
        if (b.name === "") return 1;
        return a.name.localeCompare(b.name);
      },
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type) => {
        let color;
        switch (type) {
          case "direct":
            color = "blue";
            break;
          case "fanout":
            color = "green";
            break;
          case "topic":
            color = "orange";
            break;
          case "headers":
            color = "purple";
            break;
          default:
            color = "default";
        }
        return <Tag color={color}>{type}</Tag>;
      },
      filters: [
        { text: "Direct", value: "direct" },
        { text: "Fanout", value: "fanout" },
        { text: "Topic", value: "topic" },
        { text: "Headers", value: "headers" },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Features",
      key: "features",
      render: (_, record) => {
        const features = [];
        if (record.durable) features.push("durable");
        if (record.auto_delete) features.push("auto-delete");
        if (record.internal) features.push("internal");

        return features.length ? (
          <Space size={[0, 4]} wrap>
            {features.map((feature) => (
              <Tag key={feature}>{feature}</Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">none</Text>
        );
      },
      filters: [
        { text: "Durable", value: "durable" },
        { text: "Auto-delete", value: "auto-delete" },
        { text: "Internal", value: "internal" },
      ],
      onFilter: (value, record) => {
        switch (value) {
          case "durable":
            return record.durable;
          case "auto-delete":
            return record.auto_delete;
          case "internal":
            return record.internal;
          default:
            return false;
        }
      },
    },
    {
      title: "Message Rates",
      key: "rates",
      render: (_, record) => {
        const inRate = formatRate(
          record.message_stats?.publish_in_details?.rate
        );
        const outRate = formatRate(
          record.message_stats?.publish_out_details?.rate
        );

        return (
          <Space direction="vertical" size={0}>
            <Text>In: {inRate}/s</Text>
            <Text>Out: {outRate}/s</Text>
          </Space>
        );
      },
      sorter: (a, b) => {
        const aRate = a.message_stats?.publish_in_details?.rate || 0;
        const bRate = b.message_stats?.publish_in_details?.rate || 0;
        return aRate - bRate;
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          {/* Don't show publish button for default exchange or internal exchanges */}
          {record.name !== "" && !record.internal && (
            <Tooltip title="Publish Message">
              <Button
                type="primary"
                icon={<SendOutlined />}
                size="small"
                onClick={() => goToPublish(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

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
        <h2>Exchanges</h2>
        <div>
          <Text type="secondary" style={{ marginRight: 16 }}>
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : "Never updated"}
          </Text>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchExchanges}
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
          placeholder="Search exchanges by name or type"
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
          dataSource={filteredExchanges.map((e) => ({
            ...e,
            key: `${e.vhost}/${e.name}`,
          }))}
          loading={loading}
          size="middle"
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          locale={{
            emptyText: <Empty description="No exchanges found" />,
          }}
        />
      </Card>
    </div>
  );
};

export default Exchanges;
