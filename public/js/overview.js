/**
 * Overview tab functionality
 */

/**
 * Update the overview section with new data
 * @param {Object} overview - Overview data from the API
 */
function updateOverview(overview) {
    if (!overview) return;

    // Update stat cards
    document.getElementById('queues-count').textContent = overview.queue_totals?.total || 0;
    document.getElementById('connections-count').textContent = overview.object_totals?.connections || 0;
    document.getElementById('channels-count').textContent = overview.object_totals?.channels || 0;
    document.getElementById('consumers-count').textContent = overview.object_totals?.consumers || 0;

    // Update server info
    document.getElementById('server-version').textContent = overview.rabbitmq_version || '-';
    document.getElementById('erlang-version').textContent = overview.erlang_version || '-';
    document.getElementById('server-uptime').textContent = window.rmqBoard.formatUptime(overview.uptime) || '-';

    // Update message rates
    const rates = `${window.rmqBoard.formatRate(overview.message_stats?.publish_details?.rate)} msg/s`;
    document.getElementById('message-rates').textContent = rates;

    // Update connection type
    const connectionTypeElement = document.getElementById('connection-type');
    if (connectionTypeElement) {
        let connectionTypes = [];

        if (window.connectionStatus && window.connectionStatus.http) {
            connectionTypes.push('HTTP API');
        }

        if (window.connectionStatus && window.connectionStatus.amqp) {
            connectionTypes.push('AMQP');
        }

        connectionTypeElement.textContent = connectionTypes.length > 0 ?
            connectionTypes.join(' + ') :
            'Disconnected';
    }
}