// js/apiService.js
// Service for fetching data from the API

import { config } from './config.js';
import { globalRateLimiter, endpointRateLimiters, displayError } from './utils.js'; // Removed throttle as it's not directly used here

/**
 * Fetches data from the API with rate limiting.
 * @param {string} endpoint - The API endpoint (e.g., 'getMatch').
 * @param {Object} params - Query parameters for the API call.
 * @returns {Promise<Object>} - The JSON response data.
 * @throws {Error} - If the API call fails, returns an error status, or rate limit is exceeded.
 */
async function fetchAPIData(endpoint, params = {}) {
    const isTestEnvironment = typeof process !== 'undefined' &&
                             process.env.NODE_ENV === 'test';

    if (!isTestEnvironment) {
        if (globalRateLimiter && !globalRateLimiter()) {
            const errorMessage = `Yleinen käyttöraja ylitetty. Yritä hetken kuluttua uudelleen.`;
            displayError(errorMessage); // displayError is available from utils.js
            throw new Error(errorMessage);
        }

        if (endpointRateLimiters && endpointRateLimiters[endpoint] && !endpointRateLimiters[endpoint]()) {
            const errorMessage = `Liian monta pyyntöä kohteeseen ${endpoint}. Yritä hetken kuluttua uudelleen.`;
            // displayError(errorMessage);
            throw new Error(errorMessage);
        }

        if (config.RATE_LIMIT.THROTTLE_DELAY > 0) {
            await new Promise(resolve => setTimeout(resolve, config.RATE_LIMIT.THROTTLE_DELAY));
        }
    }

    const queryParams = new URLSearchParams(params).toString();
    const url = `${config.API_BASE_URL}${endpoint}?${queryParams}`;

    const response = await fetch(url, { headers: config.API_HEADERS });

    if (!response.ok) {
        let errorText = `API-kutsu kohteeseen ${endpoint} epäonnistui. Tila: ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData && (errorData.error || errorData.message)) {
                errorText += ` - ${errorData.error?.message || errorData.message}`;
            }
        } catch (e) {
            // Ignore if parsing error response fails
        }
        throw new Error(errorText);
    }

    const data = await response.json();
    if (data.call && data.call.status !== "ok" && data.call.status !== "OK") {
        throw new Error(`API-virhe kohteelle ${endpoint}: ${data.call.status}`);
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
            throw new Error(`Ottelun data on virheellistä ottelulle ID ${matchId}.`);
        }
        return matchData.match;
    } catch (error) {
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
        console.warn("Ottelun tiedoista puuttuu kilpailu-, sarja- tai lohkotunnus. Lohkodatan haku epäonnistui.");
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
        console.error(`Virhe haettaessa lohkon ${group_id} tietoja: ${error.message}`);
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
        console.error(`Virhe haettaessa joukkueen ${teamId} tietoja: ${error.message}`);
        return null;
    }
}

/**
 * Fetches all matches for a specific team from a given start date.
 * @param {string} teamId - The ID of the team.
 * @param {string} startDate - The start date for fetching matches (YYYY-MM-DD).
 * @returns {Promise<Array<Object>|null>} An array of match objects or null if an error occurs.
 */
async function fetchTeamMatches(teamId, startDate) {
    if (!teamId) {
        console.warn("Joukkueen ID vaaditaan otteluiden hakemiseen.");
        return null;
    }
    try {
        const params = { team_id: teamId };
        if (startDate) {
            params.start_date = startDate;
        }
        const data = await fetchAPIData('getMatches', params);
        return data.matches || []; // Return matches array or empty if not found/error at that level
    } catch (error) {
        // displayError is available from utils.js
        displayError(`Joukkueen ${teamId} otteluiden haku epäonnistui: ${error.message}`);
        return null; // Return null to indicate failure to the caller
    }
}

export { fetchAPIData, fetchMatchDetails, fetchGroupDetails, fetchTeamData, fetchTeamMatches };
