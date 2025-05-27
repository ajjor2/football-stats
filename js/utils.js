import { config } from './config.js';

// DOM Element Constants - These are defined in script.js and are assumed to be globally available.
// let matchIdInput, fetchDataButton, playerStatsContainer, matchInfoContainer, 
//     groupInfoContainer, playersNotInLineupContainer, loadingIndicator, errorMessageContainer;
// We will address this dependency more explicitly in a later refactoring step.

let throttle, createRateLimiter;

// Define rate limiting utilities in browser environment if not already defined (e.g. by a testing environment)
// This check ensures that if these are already defined (e.g. by JSDOM in tests), we don't overwrite them,
// but in a pure browser context, they will be defined here.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (typeof throttle === 'undefined') {
        throttle = function(func, limit) {
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
        };
    }
    
    if (typeof createRateLimiter === 'undefined') {
        createRateLimiter = function(maxCalls, timeWindow) {
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
        };
    }
}


// Initialize rate limiters
// These need createRateLimiter to be defined. If it's not (e.g. non-browser, non-Node env), this will fail.
// This scenario should ideally be handled by ensuring createRateLimiter is always defined.
// For Node.js, it would be expected to be required/imported.
// For this step, we assume the browser-defined one or a pre-existing one is available.
const globalRateLimiter = createRateLimiter ? createRateLimiter(
    config.RATE_LIMIT.MAX_CALLS_PER_MINUTE,
    60 * 1000 // 1 minute in milliseconds
) : null; // Basic fallback if createRateLimiter is somehow still undefined.

const endpointRateLimiters = {};
if (createRateLimiter && config.RATE_LIMIT.MAX_CALLS_PER_ENDPOINT) {
    Object.keys(config.RATE_LIMIT.MAX_CALLS_PER_ENDPOINT).forEach(endpoint => {
        endpointRateLimiters[endpoint] = createRateLimiter(
            config.RATE_LIMIT.MAX_CALLS_PER_ENDPOINT[endpoint],
            60 * 1000 // 1 minute in milliseconds
        );
    });
}

/**
 * Clears all previously displayed data from the UI.
 */
function clearPreviousData() { 
    if (typeof matchInfoContainer !== 'undefined' && matchInfoContainer) matchInfoContainer.innerHTML = '';
    if (typeof groupInfoContainer !== 'undefined' && groupInfoContainer) {
        groupInfoContainer.innerHTML = '';
        groupInfoContainer.classList.add('hidden');
    }
    if (typeof playerStatsContainer !== 'undefined' && playerStatsContainer) playerStatsContainer.innerHTML = '';
    if (typeof playersNotInLineupContainer !== 'undefined' && playersNotInLineupContainer) playersNotInLineupContainer.innerHTML = '';
    if (typeof errorMessageContainer !== 'undefined' && errorMessageContainer) {
        errorMessageContainer.textContent = '';
        errorMessageContainer.classList.add('hidden');
    }
}

/**
 * Shows or hides the loading indicator.
 * @param {boolean} isLoading - True to show loading, false to hide.
 */
function showLoading(isLoading) { 
    if (typeof loadingIndicator !== 'undefined' && loadingIndicator) loadingIndicator.classList.toggle('hidden', !isLoading);
}

/**
 * Displays an error message in the UI.
 * @param {string} message - The error message to display.
 */
function displayError(message) { 
    if (typeof errorMessageContainer !== 'undefined' && errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.classList.toggle('hidden', !message);
    }
    console.error(message); // Also log to console for developers
}

/**
 * Creates a stat item HTML string.
 * @param {string} label - The label for the stat.
 * @param {string|number} value - The value of the stat.
 * @param {string} [containerClasses="bg-gray-50 p-3 rounded-md"] - CSS classes for the container.
 * @returns {string} HTML string for the stat item, or empty string if value is not meaningful.
 */
function createStatItemHtml(label, value, containerClasses = "bg-gray-50 p-3 rounded-md") {
    if (value === null || value === undefined || value === '' || value === 'N/A' || (typeof value === 'string' && value.includes('0000-00-00'))) {
        return ''; 
    }
    return `<div class="${containerClasses}"><p class="font-medium text-gray-700">${label}:</p><p class="text-gray-600">${value}</p></div>`;
}

export { 
    throttle, 
    createRateLimiter, 
    globalRateLimiter, 
    endpointRateLimiters, 
    clearPreviousData, 
    showLoading, 
    displayError, 
    createStatItemHtml 
};
