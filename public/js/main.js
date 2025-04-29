/**
 * Main JavaScript file for RMQ Board
 * Handles common functionality and setup
 */

// Global variables
let socket = null;
let connectionStatus = {
    http: false,
    amqp: false
};

document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

/**
 * Initialize the application
 */
function initializeApp() {
    // Set up tab switching
    setupTabs();

    // Set up Socket.io connection
    setupSocketConnection();

    // Set up UI event listeners
    setupEventListeners();

    // Set up mobile menu
    setupMobileMenu();

    // Set up modal close functionality
    setupModals();
}

/**
 * Set up tab switching functionality
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update active content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-tab`) {
                    content.classList.add('active');
                }
            });

            // Load tab-specific data if needed
            if (tabId === 'bindings') {
                updateBindings();
            } else if (tabId === 'publish') {
                loadExchangesForPublish();
            }

            // Close mobile menu if open
            const mobileMenu = document.querySelector('.mobile-tabs-menu');
            const overlay = document.querySelector('.mobile-tabs-overlay');
            if (mobileMenu && mobileMenu.classList.contains('open')) {
                mobileMenu.classList.remove('open');
                overlay.classList.remove('open');
            }
        });
    });
}

/**
 * Set up Socket.io connection
 */
function setupSocketConnection() {
    socket = io();

    const httpStatus = document.getElementById('http-status');
    const amqpStatus = document.getElementById('amqp-status');
    const mobileHttpStatus = document.getElementById('mobile-http-status');
    const mobileAmqpStatus = document.getElementById('mobile-amqp-status');

    // Connection established
    socket.on('connect', () => {
        updateConnectionStatus(httpStatus, true);
        updateConnectionStatus(mobileHttpStatus, true);
        connectionStatus.http = true;
    });

    // Connection lost
    socket.on('disconnect', () => {
        updateConnectionStatus(httpStatus, false);
        updateConnectionStatus(mobileHttpStatus, false);
        connectionStatus.http = false;
    });

    // Handling RabbitMQ data updates
    socket.on('rabbitmq-data', data => {
        // Update connection status based on server response
        if (data.connectionStatus) {
            connectionStatus.http = data.connectionStatus.http;
            connectionStatus.amqp = data.connectionStatus.amqp;

            // Update status indicators
            updateConnectionStatus(httpStatus, connectionStatus.http);
            updateConnectionStatus(amqpStatus, connectionStatus.amqp);
            updateConnectionStatus(mobileHttpStatus, connectionStatus.http);
            updateConnectionStatus(mobileAmqpStatus, connectionStatus.amqp);
        }

        // Update data in each tab
        updateOverview(data.overview);
        updateQueues(data.queues);
        updateExchanges(data.exchanges);

        // Update last updated timestamps
        updateTimestamp('overview-last-updated');
        updateTimestamp('queues-last-updated');
        updateTimestamp('exchanges-last-updated');
    });

    // Handle errors
    socket.on('rabbitmq-error', error => {
        console.error('RabbitMQ Error:', error);
        showToast(`Error: ${error.message}`, 'error');

        // Update connection status from error info if available
        if (error.connectionStatus) {
            connectionStatus.http = error.connectionStatus.http;
            connectionStatus.amqp = error.connectionStatus.amqp;

            updateConnectionStatus(httpStatus, connectionStatus.http);
            updateConnectionStatus(amqpStatus, connectionStatus.amqp);
            updateConnectionStatus(mobileHttpStatus, connectionStatus.http);
            updateConnectionStatus(mobileAmqpStatus, connectionStatus.amqp);
        }
    });
}

/**
 * Update a connection status indicator
 * @param {HTMLElement} element - The status indicator element
 * @param {boolean} isConnected - Whether the connection is active
 */
function updateConnectionStatus(element, isConnected) {
    if (!element) return;

    if (isConnected) {
        element.textContent = 'Connected';
        element.className = 'indicator active';
    } else {
        element.textContent = 'Disconnected';
        element.className = 'indicator error';
    }
}

/**
 * Set up common UI event listeners
 */
function setupEventListeners() {
    // Set up refresh buttons
    document.getElementById('refresh-overview').addEventListener('click', () => {
        refreshData('overview');
    });

    document.getElementById('refresh-queues').addEventListener('click', () => {
        refreshData('queues');
    });

    document.getElementById('refresh-exchanges').addEventListener('click', () => {
        refreshData('exchanges');
    });

    document.getElementById('refresh-bindings').addEventListener('click', () => {
        refreshData('bindings');
    });

    // Set up search functionality
    setupSearch('queue-search', 'queues-table');
    setupSearch('exchange-search', 'exchanges-table');
    setupSearch('binding-search', 'bindings-table');
}

/**
 * Refresh data for a specific section
 * @param {string} section - The section to refresh ('overview', 'queues', etc.)
 */
function refreshData(section) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';

    const refreshButton = document.getElementById(`refresh-${section}`);
    const originalContent = refreshButton.innerHTML;

    refreshButton.innerHTML = '';
    refreshButton.appendChild(spinner);
    refreshButton.appendChild(document.createTextNode(' Refreshing...'));
    refreshButton.disabled = true;

    // Fix: Use the correct base URL for the API
    const baseUrl = window.location.origin; // Get the domain root
    const apiUrl = `${baseUrl}/api/${section}`;

    fetch(apiUrl)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            // Update the UI with new data
            switch (section) {
                case 'overview':
                    updateOverview(data);
                    break;
                case 'queues':
                    updateQueues(data);
                    break;
                case 'exchanges':
                    updateExchanges(data);
                    break;
                case 'bindings':
                    updateBindingsUI(data);
                    break;
            }

            updateTimestamp(`${section}-last-updated`);
            showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} data refreshed`, 'success');
        })
        .catch(error => {
            console.error(`Error refreshing ${section}:`, error);
            showToast(`Failed to refresh ${section}: ${error.message}`, 'error');
        })
        .finally(() => {
            // Restore the button
            refreshButton.innerHTML = originalContent;
            refreshButton.disabled = false;
        });
}

/**
 * Set up search functionality for tables
 * @param {string} inputId - The ID of the search input element
 * @param {string} tableId - The ID of the table to search
 */
function setupSearch(inputId, tableId) {
    const searchInput = document.getElementById(inputId);
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const table = document.getElementById(tableId);
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

/**
 * Update the timestamp for a section
 * @param {string} elementId - The ID of the element to update
 */
function updateTimestamp(elementId) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = `Last updated: ${timeString}`;
    }
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'warning')
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = toast.querySelector('.toast-icon');

    // Clear existing classes
    toast.className = 'toast';
    toast.classList.add(`toast-${type}`);

    // Set icon based on type
    switch (type) {
        case 'success':
            toastIcon.textContent = '✓';
            break;
        case 'error':
            toastIcon.textContent = '✕';
            break;
        case 'warning':
            toastIcon.textContent = '!';
            break;
    }

    // Set message
    toastMessage.textContent = message;

    // Show the toast
    toast.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Set up mobile menu functionality
 */
function setupMobileMenu() {
    // Create mobile menu elements if they don't exist
    if (!document.querySelector('.mobile-tabs-menu')) {
        // Create the menu container
        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'mobile-tabs-menu';

        // Clone tabs into the mobile menu
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            const mobileTab = tab.cloneNode(true);
            mobileTab.addEventListener('click', () => {
                const tabId = mobileTab.getAttribute('data-tab');
                document.querySelector(`.tab[data-tab="${tabId}"]`).click();
            });
            mobileMenu.appendChild(mobileTab);
        });

        // Create the overlay
        const overlay = document.createElement('div');
        overlay.className = 'mobile-tabs-overlay';
        overlay.addEventListener('click', () => {
            mobileMenu.classList.remove('open');
            overlay.classList.remove('open');
        });

        // Add to document
        document.body.appendChild(mobileMenu);
        document.body.appendChild(overlay);

        // Set up menu button
        const menuButton = document.querySelector('.mobile-menu-button');
        if (menuButton) {
            menuButton.addEventListener('click', () => {
                mobileMenu.classList.add('open');
                overlay.classList.add('open');
            });
        }
    }
}

/**
 * Set up modal functionality
 */
function setupModals() {
    const modals = document.querySelectorAll('.modal');

    modals.forEach(modal => {
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

/**
 * Format an uptime duration
 * @param {number} uptimeMs - Uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(uptimeMs) {
    if (!uptimeMs) return '-';

    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Format a rate value
 * @param {number} rate - The rate value
 * @returns {string} Formatted rate
 */
function formatRate(rate) {
    if (rate === undefined || rate === null) return '0.00';
    return rate.toFixed(2);
}

// Export functions for other modules
window.rmqBoard = {
    showToast,
    formatUptime,
    formatRate,
    updateTimestamp,
    refreshData
};