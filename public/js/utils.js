/**
 * Utility functions for RMQ Board
 */

/**
 * Format file size to human-readable format
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format a date string or timestamp to a human-readable format
 * @param {string|number} dateValue - Date string or timestamp
 * @returns {string} Formatted date
 */
function formatDate(dateValue) {
    if (!dateValue) return '-';

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) return dateValue; // Return original if invalid

    return date.toLocaleString();
}

/**
 * Truncate text with ellipsis if it exceeds max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;

    return text.substring(0, maxLength) + '...';
}

/**
 * Create a DOM element with attributes and content
 * @param {string} tag - Tag name
 * @param {Object} attrs - Element attributes
 * @param {string|HTMLElement|Array} content - Element content
 * @returns {HTMLElement} Created element
 */
function createElement(tag, attrs = {}, content = null) {
    const element = document.createElement(tag);

    // Set attributes
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else {
            element.setAttribute(key, value);
        }
    });

    // Add content
    if (content !== null) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof HTMLElement) {
            element.appendChild(content);
        } else if (Array.isArray(content)) {
            content.forEach(item => {
                if (typeof item === 'string') {
                    element.appendChild(document.createTextNode(item));
                } else if (item instanceof HTMLElement) {
                    element.appendChild(item);
                }
            });
        }
    }

    return element;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // Navigator clipboard API method
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback method using a temporary textarea
            const textArea = document.createElement('textarea');
            textArea.value = text;

            // Move textarea out of the viewport
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            // Execute copy command
            const success = document.execCommand('copy');

            // Clean up
            document.body.removeChild(textArea);

            return success;
        }
    } catch (error) {
        console.error('Failed to copy text:', error);
        return false;
    }
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Get URL parameters as an object
 * @returns {Object} URL parameters
 */
function getUrlParams() {
    const params = {};
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }

    return params;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} html - HTML string to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * Format a duration in milliseconds to a human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
    if (!ms) return '-';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const parts = [];

    if (days > 0) {
        parts.push(`${days}d`);
    }

    if (hours > 0 || parts.length > 0) {
        parts.push(`${hours % 24}h`);
    }

    if (minutes > 0 || parts.length > 0) {
        parts.push(`${minutes % 60}m`);
    }

    if (parts.length === 0 || seconds < 60) {
        parts.push(`${seconds % 60}s`);
    }

    return parts.join(' ');
}

/**
 * Wait for an element to be present in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<HTMLElement>} Found element
 */
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);

        if (element) {
            return resolve(element);
        }

        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);

            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Set timeout
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
        }, timeout);
    });
}

/**
 * Get a properly formatted API URL
 * @param {string} endpoint - API endpoint
 * @returns {string} Formatted URL
 */
function getApiUrl(endpoint) {
    const base = window.location.origin;
    if (endpoint.startsWith('/')) {
        return `${base}${endpoint}`;
    }
    return `${base}/${endpoint}`;
}

// Make utility functions globally available
window.rmqUtils = {
    formatFileSize,
    formatDate,
    truncateText,
    createElement,
    copyToClipboard,
    generateUniqueId,
    debounce,
    getUrlParams,
    escapeHtml,
    formatDuration,
    waitForElement,
    getApiUrl
};