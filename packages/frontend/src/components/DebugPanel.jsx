import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Tag, Button, Space, Alert, Statistic, Row, Col, Typography, Badge, Tooltip } from 'antd';
import { BugOutlined, ReloadOutlined, ClearOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const DebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [debugReport, setDebugReport] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  useEffect(() => {
    fetchDebugInfo();
    fetchSessionInfo();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchDebugInfo();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const fetchDebugInfo = async () => {
    try {
      setLoading(true);
      const response = await api.get('/debug');
      setDebugInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch debug info:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDebugReport = async () => {
    try {
      setLoading(true);
      const response = await api.get('/debug/report');
      setDebugReport(response.data);
    } catch (error) {
      console.error('Failed to fetch debug report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionInfo = async () => {
    try {
      const response = await api.get('/debug/session');
      setSessionInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch session info:', error);
    }
  };

  const enableDebugging = async (enabled) => {
    try {
      await api.post('/debug/enable', { enabled });
      fetchDebugInfo();
    } catch (error) {
      console.error('Failed to toggle debugging:', error);
    }
  };

  const setDebugLevel = async (level) => {
    try {
      await api.post('/debug/level', { level });
      fetchDebugInfo();
    } catch (error) {
      console.error('Failed to set debug level:', error);
    }
  };

  const clearDebugData = async () => {
    try {
      await api.post('/debug/clear');
      fetchDebugInfo();
    } catch (error) {
      console.error('Failed to clear debug data:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'green';
      case 'degraded': return 'orange';
      case 'unhealthy': return 'red';
      default: return 'default';
    }
  };

  const formatUptime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const renderConnectionHealth = () => {
    if (!debugInfo?.connectionHealth) return null;

    const { connectionHealth } = debugInfo;
    return (
      <Card title="Connection Health" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="Last Check"
              value={connectionHealth.lastCheck ? new Date(connectionHealth.lastCheck).toLocaleString() : 'Never'}
              valueStyle={{ fontSize: '12px' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Consecutive Failures"
              value={connectionHealth.consecutiveFailures}
              valueStyle={{ color: connectionHealth.consecutiveFailures > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Uptime"
              value={formatUptime(connectionHealth.uptime)}
            />
          </Col>
        </Row>
        {connectionHealth.lastError && (
          <Alert
            message="Last Error"
            description={connectionHealth.lastError.message}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    );
  };

  const renderPerformanceMetrics = () => {
    if (!debugInfo?.performanceMetrics) return null;

    const { performanceMetrics } = debugInfo;
    return (
      <Card title="Performance Metrics" size="small">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Connection Attempts"
              value={performanceMetrics.connectionAttempts}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Successful"
              value={performanceMetrics.successfulConnections}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Failed"
              value={performanceMetrics.failedConnections}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Avg Response Time"
              value={performanceMetrics.averageResponseTime}
              suffix="ms"
            />
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Statistic
              title="Success Rate"
              value={performanceMetrics.connectionAttempts > 0 
                ? ((performanceMetrics.successfulConnections / performanceMetrics.connectionAttempts) * 100).toFixed(1)
                : 0
              }
              suffix="%"
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="Total Operations"
              value={performanceMetrics.totalOperations}
            />
          </Col>
        </Row>
      </Card>
    );
  };

  const renderRecentActivity = () => {
    if (!debugInfo?.recentActivity) return null;

    const { recentActivity } = debugInfo;
    const activities = [];

    if (recentActivity.lastConnectionAttempt) {
      activities.push({
        type: 'Connection Attempt',
        timestamp: new Date(recentActivity.lastConnectionAttempt.timestamp),
        details: recentActivity.lastConnectionAttempt.details
      });
    }

    if (recentActivity.lastError) {
      activities.push({
        type: 'Error',
        timestamp: new Date(recentActivity.lastError.timestamp),
        details: recentActivity.lastError.error
      });
    }

    if (recentActivity.lastAmqpOperation) {
      activities.push({
        type: 'AMQP Operation',
        timestamp: new Date(recentActivity.lastAmqpOperation.timestamp),
        details: recentActivity.lastAmqpOperation.operation
      });
    }

    if (recentActivity.lastHttpOperation) {
      activities.push({
        type: 'HTTP Operation',
        timestamp: new Date(recentActivity.lastHttpOperation.timestamp),
        details: recentActivity.lastHttpOperation.request
      });
    }

    const columns = [
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        render: (type) => {
          const color = type === 'Error' ? 'red' : type === 'Connection Attempt' ? 'blue' : 'green';
          return <Tag color={color}>{type}</Tag>;
        }
      },
      {
        title: 'Timestamp',
        dataIndex: 'timestamp',
        key: 'timestamp',
        render: (timestamp) => timestamp.toLocaleString()
      },
      {
        title: 'Details',
        dataIndex: 'details',
        key: 'details',
        render: (details) => (
          <Tooltip title={JSON.stringify(details, null, 2)}>
            <Text code style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {JSON.stringify(details).substring(0, 50)}...
            </Text>
          </Tooltip>
        )
      }
    ];

    return (
      <Card title="Recent Activity" size="small">
        <Table
          dataSource={activities}
          columns={columns}
          pagination={false}
          size="small"
          rowKey={(record) => `${record.type}-${record.timestamp.getTime()}`}
        />
      </Card>
    );
  };

  const renderSessionInfo = () => {
    if (!sessionInfo) return null;

    return (
      <Card title="Session Information" size="small">
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title="Session ID"
              value={sessionInfo.sessionId}
              valueStyle={{ fontSize: '12px' }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="Start Time"
              value={new Date(sessionInfo.startTime).toLocaleString()}
              valueStyle={{ fontSize: '12px' }}
            />
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Statistic
              title="Uptime"
              value={formatUptime(sessionInfo.uptime)}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Debug Level"
              value={sessionInfo.debugLevel}
            />
          </Col>
          <Col span={8}>
            <Badge
              status={sessionInfo.isEnabled ? 'success' : 'default'}
              text={sessionInfo.isEnabled ? 'Enabled' : 'Disabled'}
            />
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <BugOutlined /> Debug Panel
      </Title>

      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchDebugInfo}
          loading={loading}
        >
          Refresh
        </Button>
        <Button
          icon={<ClearOutlined />}
          onClick={clearDebugData}
          danger
        >
          Clear Data
        </Button>
        <Button
          icon={<SettingOutlined />}
          onClick={() => setAutoRefresh(!autoRefresh)}
          type={autoRefresh ? 'primary' : 'default'}
        >
          {autoRefresh ? 'Stop Auto-Refresh' : 'Start Auto-Refresh'}
        </Button>
      </Space>

      <Tabs defaultActiveKey="overview">
        <TabPane tab="Overview" key="overview">
          <Space direction="vertical" style={{ width: '100%' }}>
            {renderSessionInfo()}
            {renderConnectionHealth()}
            {renderPerformanceMetrics()}
            {renderRecentActivity()}
          </Space>
        </TabPane>

        <TabPane tab="Settings" key="settings">
          <Card title="Debug Settings">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Debug Mode: </Text>
                <Space>
                  <Button
                    type={debugInfo?.isEnabled ? 'primary' : 'default'}
                    onClick={() => enableDebugging(true)}
                  >
                    Enable
                  </Button>
                  <Button
                    type={!debugInfo?.isEnabled ? 'primary' : 'default'}
                    onClick={() => enableDebugging(false)}
                  >
                    Disable
                  </Button>
                </Space>
              </div>

              <div>
                <Text strong>Debug Level: </Text>
                <Space>
                  {['basic', 'detailed', 'verbose'].map(level => (
                    <Button
                      key={level}
                      type={debugInfo?.debugLevel === level ? 'primary' : 'default'}
                      onClick={() => setDebugLevel(level)}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Button>
                  ))}
                </Space>
              </div>

              <div>
                <Text strong>Auto-Refresh Interval: </Text>
                <Space>
                  {[5000, 10000, 30000, 60000].map(interval => (
                    <Button
                      key={interval}
                      type={refreshInterval === interval ? 'primary' : 'default'}
                      onClick={() => setRefreshInterval(interval)}
                    >
                      {interval / 1000}s
                    </Button>
                  ))}
                </Space>
              </div>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab="Detailed Report" key="report">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchDebugReport}
            loading={loading}
            style={{ marginBottom: 16 }}
          >
            Generate Report
          </Button>
          {debugReport && (
            <Card title="Comprehensive Debug Report">
              <pre style={{ maxHeight: 600, overflow: 'auto' }}>
                {JSON.stringify(debugReport, null, 2)}
              </pre>
            </Card>
          )}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default DebugPanel;