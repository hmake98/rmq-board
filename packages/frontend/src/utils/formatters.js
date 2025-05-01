/**
 * Utility functions for formatting data consistently across the application
 */

/**
 * Format a rate value for display
 * @param {number} rate - Rate value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted rate
 */
export const formatRate = (rate, decimals = 2) => {
    if (rate === undefined || rate === null) return '0.00';
    return Number(rate).toFixed(decimals);
};

/**
 * Format uptime in milliseconds to human-readable format
 * @param {number} uptimeMs - Uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
export const formatUptime = (uptimeMs) => {
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
};

/**
 * Format a date string or timestamp
 * @param {string|number} date - Date to format
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
    if (!date) return '-';

    try {
        const dateObj = new Date(date);
        return dateObj.toLocaleString();
    } catch (e) {
        return date.toString();
    }
};

/**
 * Format file size in bytes to human-readable format
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size
 */
export const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format a string with ellipsis if it exceeds max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

/**
 * Get queue health status
 * @param {Object} queue - Queue object
 * @returns {string} Status (success, warning, error)
 */
export const getQueueHealthStatus = (queue) => {
    if (queue.state !== 'running') {
        return 'error';
    }
    if (queue.consumers === 0 && queue.messages > 0) {
        return 'warning';
    }
    return 'success';
};

/**
 * Get exchange type color
 * @param {string} type - Exchange type
 * @returns {string} Color name
 */
export const getExchangeTypeColor = (type) => {
    switch (type) {
        case 'direct':
            return 'blue';
        case 'fanout':
            return 'green';
        case 'topic':
            return 'orange';
        case 'headers':
            return 'purple';
        default:
            return 'default';
    }
};

/**
 * Determine if a string is valid JSON
 * @param {string} str - String to check
 * @returns {boolean} Whether string is valid JSON
 */
export const isValidJson = (str) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Generate a random ID
 * @returns {string} Random ID
 */
export const generateId = () => {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
};