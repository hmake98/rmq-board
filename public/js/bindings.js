/**
 * Bindings tab functionality
 */

/**
 * Fetch and update bindings data
 */
async function updateBindings() {
    try {
        const response = await fetch(`${window.location.pathname}/api/bindings`);

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const bindings = await response.json();
        updateBindingsUI(bindings);
        window.rmqBoard.updateTimestamp('bindings-last-updated');
    } catch (error) {
        console.error('Error fetching bindings:', error);
        document.getElementById('bindings-table-body').innerHTML =
            `<tr><td colspan="4" class="empty-state">Error loading bindings: ${error.message}</td></tr>`;
        window.rmqBoard.showToast(`Error fetching bindings: ${error.message}`, 'error');
    }
}

/**
 * Update the bindings table with new data
 * @param {Array} bindings - Array of binding objects from the API
 */
function updateBindingsUI(bindings) {
    const tableBody = document.getElementById('bindings-table-body');

    if (!tableBody) return;

    if (!bindings || bindings.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No bindings found</td></tr>';
        return;
    }

    tableBody.innerHTML = '';

    // Group bindings by source and destination for better visualization
    const groupedBindings = groupBindings(bindings);

    groupedBindings.forEach((binding, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'table-row-even' : 'table-row-odd';

        // Source cell
        const sourceCell = document.createElement('td');
        if (binding.source === '') {
            // Default exchange
            const defaultExchange = document.createElement('em');
            defaultExchange.textContent = '(default exchange)';
            sourceCell.appendChild(defaultExchange);
        } else {
            sourceCell.textContent = binding.source || '(none)';
        }

        // Add source type indicator
        const sourceType = document.createElement('span');
        sourceType.className = 'badge';
        sourceType.style.marginLeft = '0.5rem';

        if (binding.source_type === 'exchange') {
            sourceType.style.backgroundColor = '#e0f2fe';
            sourceType.style.color = '#0369a1';
            sourceType.textContent = 'exchange';
        } else {
            sourceType.style.backgroundColor = '#f1f5f9';
            sourceType.style.color = '#475569';
            sourceType.textContent = binding.source_type || 'unknown';
        }

        sourceCell.appendChild(sourceType);

        // If vhost is not default, add it
        if (binding.vhost && binding.vhost !== '/') {
            const vhostSpan = document.createElement('small');
            vhostSpan.style.display = 'block';
            vhostSpan.style.color = 'var(--text-muted)';
            vhostSpan.textContent = `in ${binding.vhost}`;
            sourceCell.appendChild(vhostSpan);
        }

        // Destination cell
        const destinationCell = document.createElement('td');
        destinationCell.textContent = binding.destination;

        // Add destination type indicator
        const destType = document.createElement('span');
        destType.className = 'badge';
        destType.style.marginLeft = '0.5rem';

        if (binding.destination_type === 'queue') {
            destType.style.backgroundColor = '#dcfce7';
            destType.style.color = '#166534';
            destType.textContent = 'queue';
        } else if (binding.destination_type === 'exchange') {
            destType.style.backgroundColor = '#e0f2fe';
            destType.style.color = '#0369a1';
            destType.textContent = 'exchange';
        } else {
            destType.style.backgroundColor = '#f1f5f9';
            destType.style.color = '#475569';
            destType.textContent = binding.destination_type || 'unknown';
        }

        destinationCell.appendChild(destType);

        // Routing key cell
        const routingKeyCell = document.createElement('td');

        if (binding.routing_key === '') {
            const emptyKey = document.createElement('em');
            emptyKey.textContent = '(empty string)';
            routingKeyCell.appendChild(emptyKey);
        } else {
            routingKeyCell.textContent = binding.routing_key || '(none)';
        }

        // Arguments cell
        const argsCell = document.createElement('td');

        if (binding.arguments && Object.keys(binding.arguments).length > 0) {
            const argsList = document.createElement('ul');
            argsList.style.margin = '0';
            argsList.style.paddingLeft = '1.25rem';

            for (const [key, value] of Object.entries(binding.arguments)) {
                const argItem = document.createElement('li');
                argItem.textContent = `${key}: ${formatArgValue(value)}`;
                argsList.appendChild(argItem);
            }

            argsCell.appendChild(argsList);
        } else {
            argsCell.textContent = 'None';
        }

        // Add all cells to the row
        row.appendChild(sourceCell);
        row.appendChild(destinationCell);
        row.appendChild(routingKeyCell);
        row.appendChild(argsCell);

        tableBody.appendChild(row);
    });
}

/**
 * Group bindings for better visualization
 * @param {Array} bindings - Array of binding objects
 * @returns {Array} Grouped bindings
 */
function groupBindings(bindings) {
    // For now, just sort bindings for better readability
    // This can be expanded to actually group related bindings
    return bindings.sort((a, b) => {
        // First by source
        if (a.source !== b.source) {
            return a.source.localeCompare(b.source);
        }

        // Then by destination
        if (a.destination !== b.destination) {
            return a.destination.localeCompare(b.destination);
        }

        // Then by routing key
        return (a.routing_key || '').localeCompare(b.routing_key || '');
    });
}

/**
 * Format argument values for display
 * @param {any} value - Argument value
 * @returns {string} Formatted value
 */
function formatArgValue(value) {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
}