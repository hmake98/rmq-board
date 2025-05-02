import React, { useState, useEffect } from "react";
import {
  Layout,
  Menu,
  Badge,
  theme,
  Typography,
  notification,
  Space,
  Alert,
} from "antd";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  DashboardOutlined,
  OrderedListOutlined,
  SwapOutlined,
  LinkOutlined,
  SendOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GithubOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useSocket } from "../context/SocketContext";

const { Header, Sider, Content, Footer } = Layout;
const { Text, Title } = Typography;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { isConnected, connectionStatus } = useSocket();
  const [localConnectionStatus, setLocalConnectionStatus] = useState({
    http: false,
    amqp: false,
  });

  // Safe update of connection status to avoid circular references
  useEffect(() => {
    if (connectionStatus) {
      try {
        // Create a new simple object with only the properties we need
        const safeStatus = {
          http: Boolean(connectionStatus.http),
          amqp: Boolean(connectionStatus.amqp),
        };
        setLocalConnectionStatus(safeStatus);
      } catch (error) {
        console.error("Error updating connection status:", error);
        // Fallback to a safe default if there's an error
        setLocalConnectionStatus({ http: false, amqp: false });
      }
    }
  }, [connectionStatus]);

  // Update isMobile state on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Show notification if connection is lost
  useEffect(() => {
    try {
      if (isConnected === false) {
        notification.open({
          message: "Connection Lost",
          description: "Lost connection to the server. Trying to reconnect...",
          duration: 0,
          key: "connection-lost",
        });
      } else if (isConnected === true) {
        notification.destroy("connection-lost");
      }
    } catch (error) {
      console.error("Error in connection notification handling:", error);
    }
  }, [isConnected]);

  // Menu items configuration
  const menuItems = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: "Overview",
    },
    {
      key: "/queues",
      icon: <OrderedListOutlined />,
      label: "Queues",
    },
    {
      key: "/exchanges",
      icon: <SwapOutlined />,
      label: "Exchanges",
    },
    {
      key: "/bindings",
      icon: <LinkOutlined />,
      label: "Bindings",
    },
    {
      key: "/publish",
      icon: <SendOutlined />,
      label: "Publish Message",
    },
  ];

  // Handle menu item clicks
  const handleMenuClick = ({ key }) => {
    navigate(key);
    if (isMobile) {
      setCollapsed(true);
    }
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  // Determine if we should show the connection warning
  // Only show warning if socket is connected but either HTTP or AMQP is not connected
  const shouldShowConnectionWarning =
    isConnected && !(localConnectionStatus.http && localConnectionStatus.amqp);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        width={240}
        trigger={null}
        theme="dark"
        style={{
          overflow: "auto",
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 999,
        }}
      >
        <div
          className="logo"
          style={{
            height: 40,
            margin: 16,
            color: token.colorPrimary,
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "18px",
          }}
        >
          {!collapsed && "RMQ Board"}
          {collapsed && "RMQ"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname === "/" ? "/" : location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />

        {!collapsed && (
          <div
            style={{
              position: "absolute",
              bottom: 48,
              width: "100%",
              padding: "20px 16px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.85)",
                  marginRight: 12,
                  minWidth: "80px",
                }}
              >
                HTTP API:
              </Text>
              <Badge
                status={localConnectionStatus.http ? "success" : "error"}
                text={
                  <Text
                    style={{
                      color: localConnectionStatus.http ? "#52c41a" : "#ff4d4f",
                      fontWeight: "500",
                    }}
                  >
                    {localConnectionStatus.http ? "Connected" : "Disconnected"}
                  </Text>
                }
              />
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.85)",
                  marginRight: 12,
                  minWidth: "80px",
                }}
              >
                AMQP:
              </Text>
              <Badge
                status={localConnectionStatus.amqp ? "success" : "error"}
                text={
                  <Text
                    style={{
                      color: localConnectionStatus.amqp ? "#52c41a" : "#ff4d4f",
                      fontWeight: "500",
                    }}
                  >
                    {localConnectionStatus.amqp ? "Connected" : "Disconnected"}
                  </Text>
                }
              />
            </div>
          </div>
        )}
      </Sider>

      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 240,
          transition: "all 0.2s",
        }}
      >
        <Header
          style={{
            padding: 0,
            background: token.colorBgContainer,
            position: "sticky",
            top: 0,
            zIndex: 1,
            width: "100%",
            display: "flex",
            alignItems: "center",
            boxShadow: "0 1px 4px rgba(0, 21, 41, 0.08)",
          }}
        >
          {React.createElement(
            collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
            {
              className: "trigger",
              onClick: toggleSidebar,
              style: { padding: "0 24px", fontSize: "18px" },
            }
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              paddingRight: 24,
            }}
          >
            <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
              RabbitMQ Dashboard
            </Title>
          </div>
        </Header>

        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: 4,
            minHeight: 280,
          }}
        >
          {shouldShowConnectionWarning && (
            <Alert
              message="Connection Warning"
              description="Not fully connected to the RabbitMQ server. Some features may be unavailable."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Outlet />
        </Content>

        <Footer style={{ textAlign: "center" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <span>RMQ Board ©2025</span>
            <a
              href="https://github.com/hmake98/rmq-board"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 16, display: "flex", alignItems: "center" }}
            >
              <GithubOutlined style={{ marginRight: 4 }} /> GitHub
            </a>
            <span style={{ margin: "0 16px" }}>|</span>
            <span style={{ display: "flex", alignItems: "center" }}>
              <InfoCircleOutlined style={{ marginRight: 4 }} />
              Version 1.0.0
            </span>
          </div>
        </Footer>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
