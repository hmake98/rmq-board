# Debugging and Monitoring Guide

This guide covers the comprehensive debugging and monitoring features available in RMQ Board.

## Overview

RMQ Board includes advanced debugging and health monitoring capabilities designed to help developers troubleshoot RabbitMQ connection issues and monitor system performance in real-time.

## Features

### 🔍 Debug Panel
- **Real-time Connection Monitoring**: Track HTTP and AMQP connection attempts, successes, and failures
- **Performance Metrics**: Monitor response times, success rates, and operation counts
- **Session Management**: View debug session information and control debug levels
- **Activity Logging**: Track recent operations and errors with detailed context

### ❤️ Health Monitor
- **Connection Health Checks**: Automated monitoring of HTTP and AMQP connections
- **Alert System**: Configurable thresholds for response time, error rates, and failures
- **Performance Tracking**: Real-time latency monitoring and trend analysis
- **Alert Management**: View, clear, and configure alerts

## API Endpoints

### Debug Endpoints

#### GET `/api/debug`
Returns real-time debugging information including:
- Session information
- Connection health status
- Performance metrics
- Recent activity

#### GET `/api/debug/report`
Returns a comprehensive debug report with:
- Session details
- Performance statistics
- Connection history
- Error logs

#### GET `/api/debug/session`
Returns current debug session information:
- Session ID
- Start time
- Uptime
- Debug level
- Enabled status

#### POST `/api/debug/enable`
Enable or disable debugging:
```json
{
  "enabled": true
}
```

#### POST `/api/debug/level`
Set debug level (basic, detailed, verbose):
```json
{
  "level": "detailed"
}
```

#### POST `/api/debug/clear`
Clear all debug data.

### Health Monitor Endpoints

#### GET `/api/health/status`
Returns real-time health status:
- Overall system health
- Individual connection status (HTTP/AMQP)
- Uptime and last check times
- Response times

#### GET `/api/health/report`
Returns comprehensive health report:
- Health metrics
- Performance data
- Alert history
- Threshold configurations

#### GET `/api/health/alerts`
Returns alert statistics:
- Total alerts
- Critical vs warning counts
- Recent alerts

#### POST `/api/health/thresholds`
Update alert thresholds:
```json
{
  "responseTime": 5000,
  "errorRate": 0.1,
  "consecutiveFailures": 3,
  "memoryUsage": 0.8
}
```

#### POST `/api/health/alerts/clear`
Clear all alerts.

#### GET `/api/health/performance`
Returns performance metrics:
- Monitoring state
- Performance metrics
- Connection health data

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Debugging Settings
DEBUG_ENABLED=true
DEBUG_LEVEL=detailed

# Health Monitoring Settings
HEALTH_CHECK_INTERVAL=30000
PERFORMANCE_CHECK_INTERVAL=60000

# Alert Thresholds
RESPONSE_TIME_THRESHOLD=5000
ERROR_RATE_THRESHOLD=0.1
CONSECUTIVE_FAILURE_THRESHOLD=3
MEMORY_USAGE_THRESHOLD=0.8
```

### Debug Levels

- **basic**: Minimal debugging information
- **detailed**: Comprehensive debugging with performance metrics
- **verbose**: Full debugging with all available data

## Usage Examples

### Monitoring Connection Issues

1. Navigate to the Debug Panel in the UI
2. Check the "Connection Health" section for recent failures
3. Review the "Recent Activity" tab for detailed error information
4. Use the "Performance Metrics" to identify patterns

### Setting Up Alerts

1. Go to the Health Monitor
2. Navigate to the "Settings" tab
3. Configure alert thresholds based on your requirements
4. Monitor alerts in the "Overview" tab

### Troubleshooting Steps

1. **Check Connection Status**:
   - Verify both HTTP and AMQP connections are healthy
   - Review connection attempts and failures

2. **Analyze Performance**:
   - Monitor response times
   - Check for performance degradation
   - Review error rates

3. **Review Alerts**:
   - Check for critical alerts
   - Review alert history
   - Adjust thresholds if needed

4. **Generate Reports**:
   - Use the "Detailed Report" tabs for comprehensive analysis
   - Export debug data for further analysis

## Best Practices

### Debugging
- Start with `basic` debug level for general monitoring
- Use `detailed` level when investigating specific issues
- Use `verbose` level sparingly as it generates significant data
- Clear debug data periodically to manage memory usage

### Health Monitoring
- Set realistic thresholds based on your environment
- Monitor alert patterns to identify systemic issues
- Use auto-refresh for continuous monitoring
- Review performance trends regularly

### Performance Optimization
- Monitor average response times
- Track connection success rates
- Review error patterns
- Adjust intervals based on your needs

## Troubleshooting Common Issues

### High Response Times
1. Check network connectivity
2. Review RabbitMQ server performance
3. Adjust response time thresholds
4. Monitor for connection failures

### Frequent Disconnections
1. Check AMQP connection stability
2. Review connection retry logic
3. Monitor for authentication issues
4. Check server resource usage

### Memory Issues
1. Clear debug data regularly
2. Reduce debug level if needed
3. Monitor memory usage thresholds
4. Restart service if necessary

## Integration with External Tools

### Log Aggregation
Debug data can be integrated with external logging systems:
- Winston logger supports multiple transports
- Debug events are emitted for external listeners
- Health check results can be exported

### Monitoring Systems
Health monitoring data can be integrated with:
- Prometheus metrics
- Grafana dashboards
- Alert management systems
- Custom monitoring solutions

## Security Considerations

- Debug data may contain sensitive information
- Use appropriate access controls for debug endpoints
- Consider disabling debugging in production
- Mask sensitive data in logs and reports

## Performance Impact

- Debugging adds minimal overhead when disabled
- Health monitoring runs on configurable intervals
- Memory usage scales with debug data retention
- Network overhead is minimal for monitoring endpoints

## Support

For issues with debugging or monitoring features:
1. Check the debug panel for error information
2. Review health monitor alerts
3. Generate detailed reports for analysis
4. Check server logs for additional context