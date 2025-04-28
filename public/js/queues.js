/**
 * Queues tab functionality
 */

/**
 * Update the queues table with new data
 * @param {Array} queues - Array of queue objects from the API
 */
function updateQueues(queues) {
    const tableBody = document.getElementById('queues-table-body');

    if (!tableBody) return;

    if (!queues || queues.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No queues found</td></tr>';
        return;
    }

    tableBody.innerHTML = '';

    queues.forEach(queue => {
        const row = document.createElement('tr');

        // Queue name cell
        const nameCell = document.createElement('td');
        const nameWithHealth = document.createElement('div');
        nameWithHealth.style.display = 'flex';
        nameWithHealth.style.alignItems = 'center';

        // Health indicator
        const healthIndicator = document.createElement('span');
        healthIndicator.className = 'health-indicator';

        if (queue.state === 'running' && (queue.consumers > 0 || queue.messages === 0)) {
            healthIndicator.classList.add('health-good');
            healthIndicator.title = 'Healthy';
        } else if (queue.state === 'running' && queue.messages > 0 && queue.consumers === 0) {
            healthIndicator.classList.add('health-warning');
            healthIndicator.title = 'No consumers';
        } else {
            healthIndicator.classList.add('health-critical');
            healthIndicator.title = queue.state !== 'running' ? 'Not running' : 'Issues detected';
        }

        nameWithHealth.appendChild(healthIndicator);
        nameWithHealth.appendChild(document.createTextNode(queue.name));

        // If vhost is not default, add it
        if (queue.vhost && queue.vhost !== '/') {
            const vhostSpan = document.createElement('small');
            vhostSpan.style.marginLeft = '0.5rem';
            vhostSpan.style.color = 'var(--text-muted)';
            vhostSpan.textContent = `(${queue.vhost})`;
            nameWithHealth.appendChild(vhostSpan);
        }

        nameCell.appendChild(nameWithHealth);

        // Queue state cell
        const stateCell = document.createElement('td');
        const stateBadge = document.createElement('span');
        stateBadge.classList.add('badge');

        if (queue.state === 'running') {
            stateBadge.classList.add('badge-success');
            stateBadge.textContent = 'Running';
        } else {
            stateBadge.classList.add('badge-warning');
            stateBadge.textContent = queue.state || 'Unknown';
        }

        stateCell.appendChild(stateBadge);

        // Messages cell
        const messagesCell = document.createElement('td');
        const messagesContent = document.createElement('div');

        // Main message count
        const messageCount = document.createElement('div');
        messageCount.textContent = queue.messages || 0;
        messagesContent.appendChild(messageCount);

        // Show message rate if available
        if (queue.message_stats && queue.message_stats.publish_details) {
            const messageRate = document.createElement('small');
            messageRate.style.color = 'var(--text-muted)';
            messageRate.textContent = `${window.rmqBoard.formatRate(queue.message_stats.publish_details.rate)} msg/s`;
            messagesContent.appendChild(messageRate);
        }

        messagesCell.appendChild(messagesContent);

        // Consumers cell
        const consumersCell = document.createElement('td');
        consumersCell.textContent = queue.consumers || 0;

        // Actions cell
        const actionsCell = document.createElement('td');
        const actionButtons = document.createElement('div');
        actionButtons.className = 'action-buttons';

        // View Messages button
        const viewButton = document.createElement('button');
        viewButton.className = 'button button-secondary button-sm';
        viewButton.innerHTML = '<span class="button-icon">👁</span> View';
        viewButton.addEventListener('click', () => {
            viewQueueMessages(queue.vhost, queue.name);
        });

        // Purge Queue button
        const purgeButton = document.createElement('button');
        purgeButton.className = 'button button-danger button-sm';
        purgeButton.innerHTML = '<span class="button-icon">🗑</span> Purge';
        purgeButton.addEventListener('click', () => {
            purgeQueue(queue.vhost, queue.name);
        });

        actionButtons.appendChild(viewButton);
        actionButtons.appendChild(purgeButton);
        actionsCell.appendChild(actionButtons);

        // Add all cells to the row
        row.appendChild(nameCell);
        row.appendChild(stateCell);
        row.appendChild(messagesCell);
        row.appendChild(consumersCell);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}

/**
 * View messages in a queue
 * @param {string} vhost - Virtual host
 * @param {string} queueName - Queue name
 */
async function viewQueueMessages(vhost, queueName) {
    try {
        const modal = document.getElementById('message-modal');
        const queueNameTitle = document.getElementById('queue-name-title');
        const messagesContainer = document.getElementById('messages-container');

        // Show loading state
        queueNameTitle.textContent = queueName;
        messagesContainer.innerHTML = '<div class="loading"><span class="spinner"></span> Loading messages...</div>';
        modal.style.display = 'block';

        const encodedVhost = encodeURIComponent(vhost);
        const encodedName = encodeURIComponent(queueName);
        const apiUrl = `${window.location.origin}/api/queues/${encodedVhost}/${encodedName}/get`;
        console.log('Fetching messages from:', apiUrl);
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const messages = await response.json();
        messagesContainer.innerHTML = '';

        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = '<div class="empty-state">No messages in queue</div>';
        } else {
            messages.forEach((message, index) => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message-container');

                const messageHeader = document.createElement('div');
                messageHeader.classList.add('message-header');

                // Header with message index and properties
                const headerText = document.createElement('div');
                headerText.textContent = `Message #${index + 1}`;

                // Add exchange and routing key if available
                if (message.exchange || message.routing_key) {
                    const routingInfo = document.createElement('small');
                    routingInfo.style.marginLeft = '0.5rem';
                    routingInfo.style.color = 'var(--text-muted)';

                    let routingText = [];
                    if (message.exchange) routingText.push(`Exchange: ${message.exchange}`);
                    if (message.routing_key) routingText.push(`Routing key: ${message.routing_key}`);

                    routingInfo.textContent = routingText.join(' | ');
                    headerText.appendChild(routingInfo);
                }

                messageHeader.appendChild(headerText);

                // Redelivered badge if applicable
                if (message.redelivered) {
                    const redeliveredBadge = document.createElement('span');
                    redeliveredBadge.className = 'badge badge-warning';
                    redeliveredBadge.textContent = 'Redelivered';
                    messageHeader.appendChild(redeliveredBadge);
                }

                const messageBody = document.createElement('div');
                messageBody.classList.add('message-body');

                // Message details
                const messageDetails = document.createElement('div');
                messageDetails.className = 'message-details';

                // Add message properties if available
                if (message.properties) {
                    const propsList = document.createElement('div');
                    propsList.className = 'detail-item';

                    const propsLabel = document.createElement('div');
                    propsLabel.className = 'detail-label';
                    propsLabel.textContent = 'Properties:';

                    const propsValue = document.createElement('div');
                    propsValue.className = 'detail-value';

                    // Format properties nicely
                    const props = [];
                    for (const [key, value] of Object.entries(message.properties)) {
                        if (value !== undefined && value !== null) {
                            props.push(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
                        }
                    }

                    propsValue.textContent = props.length > 0 ? props.join(', ') : 'None';

                    propsList.appendChild(propsLabel);
                    propsList.appendChild(propsValue);
                    messageDetails.appendChild(propsList);
                }

                messageBody.appendChild(messageDetails);

                // Message content
                const messageContent = document.createElement('pre');
                messageContent.classList.add('message-viewer');

                try {
                    // Try to parse JSON
                    const payload = message.payload;
                    if (typeof payload === 'string') {
                        try {
                            // First, try to parse as JSON
                            const parsedPayload = JSON.parse(payload);
                            messageContent.textContent = JSON.stringify(parsedPayload, null, 2);
                        } catch (e) {
                            // If not JSON, display as is
                            messageContent.textContent = payload;
                        }
                    } else if (payload instanceof ArrayBuffer || payload instanceof Uint8Array) {
                        // Handle binary data
                        messageContent.textContent = `[Binary data, ${payload.byteLength} bytes]`;
                    } else if (typeof payload === 'object') {
                        // Already parsed object
                        messageContent.textContent = JSON.stringify(payload, null, 2);
                    } else {
                        // Fallback
                        messageContent.textContent = String(payload);
                    }
                } catch (e) {
                    // Fallback for any errors
                    messageContent.textContent = `Error displaying message payload: ${e.message}`;
                }

                messageBody.appendChild(messageContent);
                messageDiv.appendChild(messageHeader);
                messageDiv.appendChild(messageBody);

                messagesContainer.appendChild(messageDiv);
            });

            // Add requeue notice
            const requeueNotice = document.createElement('div');
            requeueNotice.style.marginTop = '1rem';
            requeueNotice.style.padding = '0.5rem';
            requeueNotice.style.backgroundColor = '#fff8e6';
            requeueNotice.style.borderRadius = '0.25rem';
            requeueNotice.style.fontSize = '0.875rem';
            requeueNotice.innerHTML = '<strong>Note:</strong> Messages are requeued automatically. They are not removed from the queue by viewing them.';
            messagesContainer.appendChild(requeueNotice);
        }
    } catch (error) {
        console.error('Error fetching queue messages:', error);
        window.rmqBoard.showToast(`Error fetching messages: ${error.message}`, 'error');

        const modal = document.getElementById('message-modal');
        const messagesContainer = document.getElementById('messages-container');

        messagesContainer.innerHTML = `
            <div class="empty-state" style="color: var(--danger-color);">
                Error loading messages: ${error.message}
            </div>
        `;
    }
}

/**
 * Purge all messages from a queue
 * @param {string} vhost - Virtual host
 * @param {string} queueName - Queue name
 */
async function purgeQueue(vhost, queueName) {
    // Ask for confirmation
    if (!confirm(`Are you sure you want to purge all messages from the queue "${queueName}"?\n\nThis cannot be undone.`)) {
        return;
    }

    try {
        const encodedVhost = encodeURIComponent(vhost);
        const encodedName = encodeURIComponent(queueName);

        const response = await fetch(`${window.location.pathname}/api/queues/${encodedVhost}/${encodedName}/purge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const result = await response.json();
        window.rmqBoard.showToast(`Queue "${queueName}" purged successfully`, 'success');

        // Refresh queue data
        window.rmqBoard.refreshData('queues');
    } catch (error) {
        console.error('Error purging queue:', error);
        window.rmqBoard.showToast(`Error purging queue: ${error.message}`, 'error');
    }
}