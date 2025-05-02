// src/utils/helpers.js

/**
 * Format a rate value for display
 * @param {number} rate - The rate value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted rate
 */
function formatRate(rate, decimals = 2) {
    if (rate === undefined || rate === null) return '0.00';
    return Number(rate).toFixed(decimals);
}

/**
 * Format an uptime duration for display
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
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Sanitize a name for use in URLs or IDs
 * @param {string} name - Name to sanitize
 * @returns {string} Sanitized name
 */
function sanitizeName(name) {
    return name
        .replace(/[^a-zA-Z0-9-_.]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Create retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Options for retries
 * @returns {Function} Function that will retry with backoff
 */
function withRetry(fn, options = {}) {
    const {
        maxRetries = 5,
        initialDelay = 300,
        maxDelay = 10000,
        factor = 2,
        onRetry = null
    } = options;

    return async (...args) => {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn(...args);
            } catch (error) {
                lastError = error;

                if (attempt >= maxRetries) {
                    break; // Max retries reached, rethrow last error
                }

                // Calculate delay with exponential backoff and jitter
                const delay = Math.min(
                    initialDelay * Math.pow(factor, attempt) + Math.random() * 100,
                    maxDelay
                );

                if (onRetry) {
                    onRetry(error, attempt, delay);
                }

                // Wait before next attempt
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    };
}

/**
 * Deep merge objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

/**
 * Check if value is an object
 * @param {any} item - Value to check
 * @returns {boolean} Whether value is an object
 */
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Convert bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Human-readable size
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Returns a debounced version of the given function that delays its execution until after a specified wait time has elapsed since the last invocation.
 *
 * @param {Function} func - The function to debounce.
 * @param {number} [wait=300] - The delay in milliseconds to wait after the last call before invoking {@link func}.
 * @returns {Function} A debounced function that postpones execution of {@link func} until after {@link wait} milliseconds have passed since the last call.
 */
function debounce(func, wait = 300) {
    let timeout;

    return function (...args) {
        const context = this;
        clearTimeout(timeout);

        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * Recursively serializes data into a plain structure, omitting functions and special properties to avoid circular references.
 *
 * Returns primitives as-is, serializes arrays and plain objects recursively, and excludes properties named `__proto__` or `constructor`.
 *
 * @param {any} data - The value to serialize.
 * @returns {any} A safely serialized version of {@link data} with unsupported or unsafe properties omitted.
 */
function safeSerialize(data) {
    // For null or primitive types, just return the value
    if (data === null || data === undefined || typeof data !== 'object') {
        return data;
    }

    // For arrays, map each item through safeSerialize
    if (Array.isArray(data)) {
        return data.map(item => safeSerialize(item));
    }

    // For objects, create a new object with serialized properties
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        // Skip functions and special properties
        if (typeof value !== 'function' && key !== '__proto__' && key !== 'constructor') {
            result[key] = safeSerialize(value);
        }
    }

    return result;
}

module.exports = {
    formatRate,
    formatUptime,
    generateUniqueId,
    sanitizeName,
    withRetry,
    deepMerge,
    isObject,
    formatBytes,
    debounce,
    safeSerialize
};