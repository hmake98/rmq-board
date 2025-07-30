import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Tag, Button, Space, Alert, Statistic, Row, Col, Typography, Badge, Progress, Timeline } from 'antd';
import { HeartOutlined, ReloadOutlined, ClearOutlined, WarningOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const HealthMonitor = () => {
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthReport, setHealthReport] = useState(null);
  const [alertStats, setAlertStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10000);

  useEffect(() => {
    fetchHealthStatus();
    fetchAlertStats();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchHealthStatus();
        fetchAlertStats();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const fetchHealthStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/health/status');
      setHealthStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch health status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthReport = async () => {
    try {
      setLoading(true);
      const response = await api.get('/health/report');
      setHealthReport(response.data);
    } catch (error) {
      console.error('Failed to fetch health report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertStats = async () => {
    try {
      const response = await api.get('/health/alerts');
      setAlertStats(response.data);
    } catch (error) {
      console.error('Failed to fetch alert stats:', error);
    }
  };

  const clearAlerts = async () => {
    try {
      await api.post('/health/alerts/clear');
      fetchAlertStats();
    } catch (error) {
      console.error('Failed to clear alerts:', error);
    }
  };

  const updateThresholds = async (thresholds) => {
    try {
      await api.post('/health/thresholds', thresholds);
      fetchHealthStatus();
    } catch (error) {
      console.error('Failed to update thresholds:', error);
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'degraded': return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'unhealthy': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return <CloseCircleOutlined style={{ color: '#d9d9d9' }} />;
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

  const renderHealthStatus = () => {
    if (!healthStatus) return null;

    return (
      <Card title="Health Status" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="Overall Status"
              value={healthStatus.status}
              valueStyle={{ color: getStatusColor(healthStatus.status) }}
              prefix={getStatusIcon(healthStatus.status)}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Uptime"
              value={formatUptime(healthStatus.uptime)}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Last Check"
              value={healthStatus.lastCheck ? new Date(healthStatus.lastCheck).toLocaleString() : 'Never'}
              valueStyle={{ fontSize: '12px' }}
            />
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="HTTP Connection" size="small">
              <Statistic
                title="Status"
                value={healthStatus.checks?.http?.status || 'unknown'}
                valueStyle={{ color: getStatusColor(healthStatus.checks?.http?.status) }}
                prefix={getStatusIcon(healthStatus.checks?.http?.status)}
              />
              {healthStatus.checks?.http?.responseTime && (
                <Statistic
                  title="Response Time"
                  value={healthStatus.checks.http.responseTime}
                  suffix="ms"
                  style={{ marginTop: 8 }}
                />
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="AMQP Connection" size="small">
              <Statistic
                title="Status"
                value={healthStatus.checks?.amqp?.status || 'unknown'}
                valueStyle={{ color: getStatusColor(healthStatus.checks?.amqp?.status) }}
                prefix={getStatusIcon(healthStatus.checks?.amqp?.status)}
              />
              {healthStatus.checks?.amqp?.responseTime && (
                <Statistic
                  title="Response Time"
                  value={healthStatus.checks.amqp.responseTime}
                  suffix="ms"
                  style={{ marginTop: 8 }}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Card>
    );
  };

  const renderAlertStatistics = () => {
    if (!alertStats) return null;

    return (
      <Card title="Alert Statistics" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="Total Alerts"
              value={alertStats.total}
              valueStyle={{ color: alertStats.total > 0 ? '#faad14' : '#52c41a' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Critical"
              value={alertStats.critical}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Warnings"
              value={alertStats.warning}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
        </Row>

        {alertStats.recentAlerts && alertStats.recentAlerts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Recent Alerts:</Text>
            <Timeline style={{ marginTop: 8 }}>
              {alertStats.recentAlerts.map((alert, index) => (
                <Timeline.Item
                  key={index}
                  color={alert.severity === 'critical' ? 'red' : 'orange'}
                >
                  <Text strong>{alert.type}</Text>
                  <br />
                  <Text type="secondary">{alert.message}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}
      </Card>
    );
  };

  const renderPerformanceMetrics = () => {
    if (!healthReport?.performance) return null;

    const { performance } = healthReport;
    const latencyData = performance.connectionLatency || [];

    return (
      <Card title="Performance Metrics" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="Average Latency"
              value={performance.averageLatency || 0}
              suffix="ms"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Data Points"
              value={latencyData.length}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Threshold"
              value={healthReport.thresholds?.responseTime || 5000}
              suffix="ms"
            />
          </Col>
        </Row>

        {latencyData.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Latency Trend (Last 20 points):</Text>
            <div style={{ marginTop: 8 }}>
              {latencyData.slice(-20).map((point, index) => (
                <Progress
                  key={index}
                  percent={Math.min((point.value / (healthReport.thresholds?.responseTime || 5000)) * 100, 100)}
                  size="small"
                  status={point.value > (healthReport.thresholds?.responseTime || 5000) ? 'exception' : 'normal'}
                  format={() => `${point.value}ms`}
                  style={{ marginBottom: 4 }}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderThresholdSettings = () => {
    const [thresholds, setThresholds] = useState({
      responseTime: 5000,
      errorRate: 0.1,
      consecutiveFailures: 3,
      memoryUsage: 0.8
    });

    return (
      <Card title="Alert Thresholds">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Response Time Threshold (ms): </Text>
            <input
              type="number"
              value={thresholds.responseTime}
              onChange={(e) => setThresholds({ ...thresholds, responseTime: parseInt(e.target.value) })}
              style={{ width: 100, marginLeft: 8 }}
            />
          </div>
          <div>
            <Text strong>Error Rate Threshold (%): </Text>
            <input
              type="number"
              step="0.01"
              value={thresholds.errorRate * 100}
              onChange={(e) => setThresholds({ ...thresholds, errorRate: parseFloat(e.target.value) / 100 })}
              style={{ width: 100, marginLeft: 8 }}
            />
          </div>
          <div>
            <Text strong>Consecutive Failures: </Text>
            <input
              type="number"
              value={thresholds.consecutiveFailures}
              onChange={(e) => setThresholds({ ...thresholds, consecutiveFailures: parseInt(e.target.value) })}
              style={{ width: 100, marginLeft: 8 }}
            />
          </div>
          <div>
            <Text strong>Memory Usage Threshold (%): </Text>
            <input
              type="number"
              step="0.01"
              value={thresholds.memoryUsage * 100}
              onChange={(e) => setThresholds({ ...thresholds, memoryUsage: parseFloat(e.target.value) / 100 })}
              style={{ width: 100, marginLeft: 8 }}
            />
          </div>
          <Button
            type="primary"
            onClick={() => updateThresholds(thresholds)}
          >
            Update Thresholds
          </Button>
        </Space>
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <HeartOutlined /> Health Monitor
      </Title>

      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchHealthStatus}
          loading={loading}
        >
          Refresh
        </Button>
        <Button
          icon={<ClearOutlined />}
          onClick={clearAlerts}
          danger
        >
          Clear Alerts
        </Button>
        <Button
          onClick={() => setAutoRefresh(!autoRefresh)}
          type={autoRefresh ? 'primary' : 'default'}
        >
          {autoRefresh ? 'Stop Auto-Refresh' : 'Start Auto-Refresh'}
        </Button>
      </Space>

      <Tabs defaultActiveKey="overview">
        <TabPane tab="Overview" key="overview">
          <Space direction="vertical" style={{ width: '100%' }}>
            {renderHealthStatus()}
            {renderAlertStatistics()}
            {renderPerformanceMetrics()}
          </Space>
        </TabPane>

        <TabPane tab="Detailed Report" key="report">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchHealthReport}
            loading={loading}
            style={{ marginBottom: 16 }}
          >
            Generate Report
          </Button>
          {healthReport && (
            <Card title="Comprehensive Health Report">
              <pre style={{ maxHeight: 600, overflow: 'auto' }}>
                {JSON.stringify(healthReport, null, 2)}
              </pre>
            </Card>
          )}
        </TabPane>

        <TabPane tab="Settings" key="settings">
          {renderThresholdSettings()}
          
          <Card title="Auto-Refresh Settings" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Refresh Interval: </Text>
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
      </Tabs>
    </div>
  );
};

export default HealthMonitor;