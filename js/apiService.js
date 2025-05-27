// Service for fetching data from the API

import { config } from './config.js';
// Note: throttle is imported as per instruction but not directly used by the functions moved here.
// globalRateLimiter, endpointRateLimiters, and displayError are used.
import { globalRateLimiter, endpointRateLimiters, displayError, throttle } from './utils.js';

/**
 * Fetches data from the API with rate limiting.
 * @param {string} endpoint - The API endpoint (e.g., 'getMatch').
 * @param {Object} params - Query parameters for the API call.
 * @returns {Promise<Object>} - The JSON response data.
 * @throws {Error} - If the API call fails, returns an error status, or rate limit is exceeded.
 */
async function fetchAPIData(endpoint, params = {}) {
    // Skip rate limiting in test environments
    const isTestEnvironment = typeof process !== 'undefined' && 
                             process.env.NODE_ENV === 'test';
    
    if (!isTestEnvironment) {
        // Check global rate limit
        if (globalRateLimiter && !globalRateLimiter()) {
            throw new Error(`Rate limit exceeded. Please try again in a moment.`);
        }
        
        // Check endpoint-specific rate limit
        if (endpointRateLimiters && endpointRateLimiters[endpoint] && !endpointRateLimiters[endpoint]()) {
            throw new Error(`Too many requests to ${endpoint}. Please try again in a moment.`);
        }
        
        // Apply throttling delay if configured
        if (config.RATE_LIMIT.THROTTLE_DELAY > 0) {
            // setTimeout is a global function, no need to import it explicitly.
            await new Promise(resolve => setTimeout(resolve, config.RATE_LIMIT.THROTTLE_DELAY));
        }
    }
    
    const queryParams = new URLSearchParams(params).toString();
    const url = `${config.API_BASE_URL}${endpoint}?${queryParams}`;
    
    // fetch is a global function in modern browsers and Node.js (v18+)
    const response = await fetch(url, { headers: config.API_HEADERS });

    if (!response.ok) {
        let errorText = `API call to ${endpoint} failed. Status: ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData && (errorData.error || errorData.message)) {
                errorText += ` - ${errorData.error?.message || errorData.message}`;
            }
        } catch (e) {
            // Ignore if parsing error response fails, the original errorText is sufficient
        }
        throw new Error(errorText);
    }

    const data = await response.json();
    if (data.call && data.call.status !== "ok" && data.call.status !== "OK") {
        throw new Error(`API error for ${endpoint}: ${data.call.status}`);
    }
    return data;
}

/**
 * Fetches match details from the API.
 * @param {string} matchId - The ID of the match.
 * @returns {Promise<Object|null>} The match details object or null if an error occurs.
 */
async function fetchMatchDetails(matchId) {
    try {
        const matchData = await fetchAPIData('getMatch', { match_id: matchId });
        if (!matchData.match) {
            throw new Error(`Match data is invalid for match ID ${matchId}.`);
        }
        return matchData.match;
    } catch (error) {
        // displayError is imported from utils.js
        displayError(`Ottelun ${matchId} tietojen haku epäonnistui: ${error.message}`);
        return null;
    }
}

/**
 * Fetches group details from the API.
 * @param {Object} matchDetails - The details of the match.
 * @returns {Promise<Object|null>} The group details object or null if an error occurs.
 */
async function fetchGroupDetails(matchDetails) {
    const { competition_id, category_id, group_id } = matchDetails;
    if (!competition_id || !category_id || !group_id) {
        // console.warn is a global function
        console.warn("Match details missing competition, category, or group ID. Cannot fetch group data.");
        return null;
    }
    try {
        const groupData = await fetchAPIData('getGroup', {
            competition_id,
            category_id,
            group_id,
            matches: 1 // Include matches for H2H and referee past games
        });
        return groupData.group || null;
    } catch (error) {
        // console.error is a global function
        console.error(`Error fetching group details for group ID ${group_id}: ${error.message}`);
        return null;
    }
}

/**
 * Fetches team data (full player roster) from the API.
 * @param {string} teamId - The ID of the team.
 * @returns {Promise<Object|null>} The team data object or null if an error occurs.
 */
async function fetchTeamData(teamId) {
    if (!teamId) return null;
    try {
        return await fetchAPIData('getTeam', { team_id: teamId });
    } catch (error) {
        // console.error is a global function
        console.error(`Error fetching team data for team ID ${teamId}: ${error.message}`);
        return null;
    }
}

export { fetchAPIData, fetchMatchDetails, fetchGroupDetails, fetchTeamData };
