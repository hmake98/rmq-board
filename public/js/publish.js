/**
 * Publish message tab functionality
 */

// Set up form handlers when the DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    setupPublishForm();
});

/**
 * Set up the publish message form
 */
function setupPublishForm() {
    const publishForm = document.getElementById('publish-form');
    const formatJsonBtn = document.getElementById('format-json');

    if (publishForm) {
        publishForm.addEventListener('submit', handlePublishFormSubmit);
    }

    if (formatJsonBtn) {
        formatJsonBtn.addEventListener('click', formatJsonPayload);
    }
}

/**
 * Load exchanges for the publish form dropdown
 */
async function loadExchangesForPublish() {
    const exchangeSelect = document.getElementById('exchange-select');

    if (!exchangeSelect) return;

    try {
        // Show loading state
        exchangeSelect.innerHTML = '<option value="">Loading exchanges...</option>';
        exchangeSelect.disabled = true;

        const response = await fetch(`${window.location.pathname}/api/exchanges`);

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const exchanges = await response.json();

        // Reset select
        exchangeSelect.innerHTML = '<option value="">Select an exchange</option>';

        // Group exchanges by vhost
        const exchangesByVhost = {};

        exchanges.forEach(exchange => {
            // Skip the default exchange (empty name) as it's special
            if (exchange.name === '') return;

            const vhost = exchange.vhost || '/';

            if (!exchangesByVhost[vhost]) {
                exchangesByVhost[vhost] = [];
            }

            exchangesByVhost[vhost].push(exchange);
        });

        // Add exchanges to select, grouped by vhost
        Object.keys(exchangesByVhost).sort().forEach(vhost => {
            const exchanges = exchangesByVhost[vhost].sort((a, b) => a.name.localeCompare(b.name));

            // Create optgroup if there are multiple vhosts
            let optgroup = null;
            if (Object.keys(exchangesByVhost).length > 1) {
                optgroup = document.createElement('optgroup');
                optgroup.label = vhost === '/' ? 'Default vhost' : `vhost: ${vhost}`;
                exchangeSelect.appendChild(optgroup);
            }

            // Add exchanges from this vhost
            exchanges.forEach(exchange => {
                const option = document.createElement('option');
                option.value = `${vhost}|${exchange.name}`;
                option.textContent = exchange.name;

                // Add exchange type as data attribute
                option.dataset.type = exchange.type;

                if (optgroup) {
                    optgroup.appendChild(option);
                } else {
                    exchangeSelect.appendChild(option);
                }
            });
        });
    } catch (error) {
        console.error('Error loading exchanges:', error);
        exchangeSelect.innerHTML = '<option value="">Error loading exchanges</option>';
        window.rmqBoard.showToast(`Error loading exchanges: ${error.message}`, 'error');
    } finally {
        exchangeSelect.disabled = false;
    }
}

/**
 * Handle publish form submission
 * @param {Event} event - Form submit event
 */
async function handlePublishFormSubmit(event) {
    event.preventDefault();

    const exchangeSelect = document.getElementById('exchange-select');
    const routingKeyInput = document.getElementById('routing-key');
    const contentTypeInput = document.getElementById('content-type');
    const correlationIdInput = document.getElementById('correlation-id');
    const messagePayload = document.getElementById('message-payload');
    const submitButton = event.submitter;

    if (!exchangeSelect.value) {
        window.rmqBoard.showToast('Please select an exchange', 'warning');
        exchangeSelect.focus();
        return;
    }

    if (!messagePayload.value.trim()) {
        window.rmqBoard.showToast('Please enter a message payload', 'warning');
        messagePayload.focus();
        return;
    }

    // Parse exchange value (format: "vhost|name")
    const [vhost, exchangeName] = exchangeSelect.value.split('|');

    // Prepare request
    const properties = {};

    if (contentTypeInput.value.trim()) {
        properties.content_type = contentTypeInput.value.trim();
    }

    if (correlationIdInput.value.trim()) {
        properties.correlation_id = correlationIdInput.value.trim();
    }

    // Add timestamp
    properties.timestamp = new Date().getTime();

    // Prepare payload - try to parse as JSON if it looks like JSON
    let payload = messagePayload.value.trim();

    if (payload.startsWith('{') || payload.startsWith('[')) {
        try {
            // Validate JSON
            payload = JSON.parse(payload);
        } catch (error) {
            // Keep as string if not valid JSON
            console.warn('Invalid JSON, sending as plain text:', error);
        }
    }

    // Show loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner"></span> Publishing...';
    submitButton.disabled = true;

    try {
        const encodedVhost = encodeURIComponent(vhost);
        const encodedName = encodeURIComponent(exchangeName);

        const response = await fetch(`${window.location.pathname}/api/exchanges/${encodedVhost}/${encodedName}/publish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                routingKey: routingKeyInput.value,
                payload: payload,
                properties: properties
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const result = await response.json();
        window.rmqBoard.showToast(`Message published successfully to ${exchangeName}`, 'success');

        // Clear form fields except exchange
        routingKeyInput.value = '';
        messagePayload.value = '';

        // Update queue data after a short delay
        setTimeout(() => {
            window.rmqBoard.refreshData('queues');
        }, 1000);
    } catch (error) {
        console.error('Error publishing message:', error);
        window.rmqBoard.showToast(`Error publishing message: ${error.message}`, 'error');
    } finally {
        // Restore button
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
    }
}

/**
 * Format JSON payload in the textarea
 */
function formatJsonPayload() {
    const messagePayload = document.getElementById('message-payload');
    const payload = messagePayload.value.trim();

    if (!payload) return;

    try {
        // Parse and format JSON
        const parsedJson = JSON.parse(payload);
        messagePayload.value = JSON.stringify(parsedJson, null, 2);
    } catch (error) {
        window.rmqBoard.showToast('Invalid JSON format', 'warning');
        console.warn('Invalid JSON format:', error);
    }
}