/**
 * Rate limiting utility functions
 */

/**
 * Creates a throttled function that only invokes the provided function at most once per specified interval.
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} - The throttled function
 */
function throttle(func, limit) {
    let inThrottle = false;
    let lastResult = null;
    
    return function(...args) {
        if (!inThrottle) {
            inThrottle = true;
            lastResult = func.apply(this, args);
            
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
        
        return lastResult;
    };
}

/**
 * Creates a rate limiter that allows a specified number of calls within a time window.
 * @param {number} maxCalls - Maximum number of calls allowed in the time window
 * @param {number} timeWindow - Time window in milliseconds
 * @returns {Function} - Function that returns true if call is allowed, false otherwise
 */
function createRateLimiter(maxCalls, timeWindow) {
    const calls = [];
    
    return function() {
        const now = Date.now();
        
        // Remove calls outside the time window
        while (calls.length > 0 && calls[0] < now - timeWindow) {
            calls.shift();
        }
        
        // Check if we're under the limit
        if (calls.length < maxCalls) {
            calls.push(now);
            return true;
        }
        
        return false;
    };
}

// Export for use in other modules and for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        throttle,
        createRateLimiter
    };
}
