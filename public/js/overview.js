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

    // Update connection type - sync with the header status
    const connectionTypeElement = document.getElementById('connection-type');
    if (connectionTypeElement) {
        // Use the global connection status from the header
        const connectionTypes = [];

        if (window.connectionStatus?.http) {
            connectionTypes.push('HTTP API');
        }

        if (window.connectionStatus?.amqp) {
            connectionTypes.push('AMQP');
        }

        connectionTypeElement.textContent = connectionTypes.length > 0 ?
            connectionTypes.join(' + ') :
            'Disconnected';
    }
}

// Add a listener to update the connection status whenever it changes
document.addEventListener('DOMContentLoaded', function () {
    // Initial update of connection status in the overview tab
    const updateConnectionDisplay = function () {
        const connectionTypeElement = document.getElementById('connection-type');
        if (connectionTypeElement) {
            const connectionTypes = [];

            if (window.connectionStatus?.http) {
                connectionTypes.push('HTTP API');
            }

            if (window.connectionStatus?.amqp) {
                connectionTypes.push('AMQP');
            }

            connectionTypeElement.textContent = connectionTypes.length > 0 ?
                connectionTypes.join(' + ') :
                'Disconnected';
        }
    };

    // Initial update
    updateConnectionDisplay();

    // Setup a listener for Socket.io connection status updates
    if (socket) {
        socket.on('rabbitmq-data', function (data) {
            if (data.connectionStatus) {
                // Update global connection status
                window.connectionStatus = data.connectionStatus;
                // Update the display
                updateConnectionDisplay();
            }
        });
    }
});