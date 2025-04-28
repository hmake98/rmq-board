/**
 * Exchanges tab functionality
 */

/**
 * Update the exchanges table with new data
 * @param {Array} exchanges - Array of exchange objects from the API
 */
function updateExchanges(exchanges) {
    const tableBody = document.getElementById('exchanges-table-body');

    if (!tableBody) return;

    if (!exchanges || exchanges.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No exchanges found</td></tr>';
        return;
    }

    tableBody.innerHTML = '';

    exchanges.forEach(exchange => {
        const row = document.createElement('tr');

        // Exchange name cell
        const nameCell = document.createElement('td');
        const nameValue = exchange.name || '(unnamed)';

        // If it's the default exchange, add a visual indicator
        if (nameValue === '') {
            const defaultExchange = document.createElement('em');
            defaultExchange.textContent = '(default exchange)';
            nameCell.appendChild(defaultExchange);
        } else {
            nameCell.textContent = nameValue;
        }

        // If vhost is not default, add it
        if (exchange.vhost && exchange.vhost !== '/' && nameValue !== '') {
            const vhostSpan = document.createElement('small');
            vhostSpan.style.display = 'block';
            vhostSpan.style.color = 'var(--text-muted)';
            vhostSpan.textContent = `in ${exchange.vhost}`;
            nameCell.appendChild(vhostSpan);
        }

        // Exchange type cell
        const typeCell = document.createElement('td');
        const typeBadge = document.createElement('span');
        typeBadge.classList.add('badge');

        // Different colors for different exchange types
        switch (exchange.type) {
            case 'direct':
                typeBadge.style.backgroundColor = '#e0f2fe';
                typeBadge.style.color = '#0369a1';
                break;
            case 'fanout':
                typeBadge.style.backgroundColor = '#dcfce7';
                typeBadge.style.color = '#166534';
                break;
            case 'topic':
                typeBadge.style.backgroundColor = '#ffedd5';
                typeBadge.style.color = '#9a3412';
                break;
            case 'headers':
                typeBadge.style.backgroundColor = '#f3e8ff';
                typeBadge.style.color = '#7e22ce';
                break;
            default:
                // Default styling
                typeBadge.style.backgroundColor = '#f1f5f9';
                typeBadge.style.color = '#475569';
        }

        typeBadge.textContent = exchange.type;
        typeCell.appendChild(typeBadge);

        // Features cell
        const featuresCell = document.createElement('td');
        const features = [];

        if (exchange.durable) features.push('durable');
        if (exchange.auto_delete) features.push('auto-delete');
        if (exchange.internal) features.push('internal');

        featuresCell.textContent = features.join(', ') || 'none';

        // Stats cell
        const statsCell = document.createElement('td');
        const inRate = window.rmqBoard.formatRate(exchange.message_stats?.publish_in_details?.rate) || 0;
        const outRate = window.rmqBoard.formatRate(exchange.message_stats?.publish_out_details?.rate) || 0;

        const statsContainer = document.createElement('div');

        const inRateDiv = document.createElement('div');
        inRateDiv.innerHTML = `In: <strong>${inRate}</strong>/s`;

        const outRateDiv = document.createElement('div');
        outRateDiv.innerHTML = `Out: <strong>${outRate}</strong>/s`;

        statsContainer.appendChild(inRateDiv);
        statsContainer.appendChild(outRateDiv);

        statsCell.appendChild(statsContainer);

        // Actions cell
        const actionsCell = document.createElement('td');
        const actionButtons = document.createElement('div');
        actionButtons.className = 'action-buttons';

        // Only allow publishing to non-default exchanges
        if (nameValue !== '') {
            // Publish Message button
            const publishButton = document.createElement('button');
            publishButton.className = 'button button-secondary button-sm';
            publishButton.innerHTML = '<span class="button-icon">📤</span> Publish';
            publishButton.addEventListener('click', () => {
                openPublishTab(exchange.vhost, exchange.name);
            });

            actionButtons.appendChild(publishButton);
        }

        actionsCell.appendChild(actionButtons);

        // Add all cells to the row
        row.appendChild(nameCell);
        row.appendChild(typeCell);
        row.appendChild(featuresCell);
        row.appendChild(statsCell);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}

/**
 * Open the publish tab and pre-select an exchange
 * @param {string} vhost - Virtual host
 * @param {string} exchangeName - Exchange name
 */
function openPublishTab(vhost, exchangeName) {
    // Activate the publish tab
    document.querySelector('.tab[data-tab="publish"]').click();

    // Wait for the DOM to update
    setTimeout(() => {
        // Select the exchange in the dropdown
        const exchangeSelect = document.getElementById('exchange-select');
        if (exchangeSelect) {
            // Format the option value to match what loadExchangesForPublish() creates
            const optionValue = `${vhost}|${exchangeName}`;

            // Find and select the option
            for (let i = 0; i < exchangeSelect.options.length; i++) {
                if (exchangeSelect.options[i].value === optionValue) {
                    exchangeSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }, 100);
}