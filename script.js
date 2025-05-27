// Import rate limiting utilities if in a module environment
let throttle, createRateLimiter;
if (typeof require !== 'undefined') {
    const utils = require('./utils');
    throttle = utils.throttle;
    createRateLimiter = utils.createRateLimiter;
}

// DOM Element Constants - Initialize only in browser environment
let matchIdInput, fetchDataButton, playerStatsContainer, matchInfoContainer, 
    groupInfoContainer, playersNotInLineupContainer, loadingIndicator, errorMessageContainer;

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    matchIdInput = document.getElementById('matchIdInput');
    fetchDataButton = document.getElementById('fetchDataButton');
    playerStatsContainer = document.getElementById('playerStatsContainer');
    matchInfoContainer = document.getElementById('matchInfo');
    groupInfoContainer = document.getElementById('groupInfoContainer');
    playersNotInLineupContainer = document.getElementById('playersNotInLineupContainer');
    loadingIndicator = document.getElementById('loadingIndicator');
    errorMessageContainer = document.getElementById('errorMessage');
    
    // Define rate limiting utilities in browser environment if not imported
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

// Configuration
const config = {
    API_BASE_URL: 'https://spl.torneopal.net/taso/rest/',
    CURRENT_YEAR: "2025",
    PREVIOUS_YEAR: (parseInt("2025") - 1).toString(),
    API_HEADERS: {
        'Accept': 'json/df8e84j9xtdz269euy3h'
    },
    NO_PLAYER_IMAGE_URL: "https://www.palloliitto.fi/sites/all/themes/palloliitto/images/no-player-image.png",
    DEFAULT_CREST_URL: "https://cdn.torneopal.net/logo/palloliitto/x.png",
    PLACEHOLDER_CREST_URL: 'https://placehold.co/40x40/e2e8f0/64748b?text=LOGO',
    // Rate limiting configuration
    RATE_LIMIT: {
        MAX_CALLS_PER_MINUTE: 30,  // Maximum API calls per minute
        MAX_CALLS_PER_ENDPOINT: {   // Endpoint-specific limits
            'getMatch': 5,
            'getGroup': 3,
            'getTeam': 5,
            'getPlayer': 20
        },
        THROTTLE_DELAY: 1000        // Minimum delay between API calls in milliseconds
    }
};

// Initialize rate limiters
const globalRateLimiter = createRateLimiter(
    config.RATE_LIMIT.MAX_CALLS_PER_MINUTE, 
    60 * 1000 // 1 minute in milliseconds
);

// Create endpoint-specific rate limiters
const endpointRateLimiters = {};
Object.keys(config.RATE_LIMIT.MAX_CALLS_PER_ENDPOINT).forEach(endpoint => {
    endpointRateLimiters[endpoint] = createRateLimiter(
        config.RATE_LIMIT.MAX_CALLS_PER_ENDPOINT[endpoint],
        60 * 1000 // 1 minute in milliseconds
    );
});

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
        if (!globalRateLimiter()) {
            throw new Error(`Rate limit exceeded. Please try again in a moment.`);
        }
        
        // Check endpoint-specific rate limit
        if (endpointRateLimiters[endpoint] && !endpointRateLimiters[endpoint]()) {
            throw new Error(`Too many requests to ${endpoint}. Please try again in a moment.`);
        }
        
        // Apply throttling delay if configured
        if (config.RATE_LIMIT.THROTTLE_DELAY > 0) {
            await new Promise(resolve => setTimeout(resolve, config.RATE_LIMIT.THROTTLE_DELAY));
        }
    }
    
    const queryParams = new URLSearchParams(params).toString();
    const url = `${config.API_BASE_URL}${endpoint}?${queryParams}`;
    
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

// --- UI Helper Functions ---

/**
 * Clears all previously displayed data from the UI.
 */
function clearPreviousData() { 
    matchInfoContainer.innerHTML = '';
    groupInfoContainer.innerHTML = ''; 
    groupInfoContainer.classList.add('hidden'); 
    playerStatsContainer.innerHTML = '';
    playersNotInLineupContainer.innerHTML = '';
    errorMessageContainer.textContent = '';
    errorMessageContainer.classList.add('hidden');
}

/**
 * Shows or hides the loading indicator.
 * @param {boolean} isLoading - True to show loading, false to hide.
 */
function showLoading(isLoading) { 
    loadingIndicator.classList.toggle('hidden', !isLoading);
}

/**
 * Displays an error message in the UI.
 * @param {string} message - The error message to display.
 */
function displayError(message) { 
    errorMessageContainer.textContent = message;
    errorMessageContainer.classList.toggle('hidden', !message);
    console.error(message); // Also log to console for developers
}

// --- Data Fetching Functions ---

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
        console.error(`Error fetching team data for team ID ${teamId}: ${error.message}`);
        return null;
    }
}


// --- Data Processing Functions ---

/**
 * Processes a player's match history to extract season statistics.
 * @param {Array<Object>} matches - Array of match objects from player data.
 * @param {string} currentSeasonId - Identifier for the current season.
 * @param {string} previousSeasonId - Identifier for the previous season.
 * @param {string|null} teamNameForContext - Name of the team for context-specific stats.
 * @returns {Object} Contains stats like gamesPlayedThisYear, goalsThisYear, etc.
 */
function processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext) {
    const stats = {
        gamesPlayedThisYear: 0, goalsThisYear: 0, warningsThisYear: 0, suspensionsThisYear: 0,
        goalsByTeamThisYear: {}, gamesByTeamThisYear: {},
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [],
        gamesPlayedLastSeason: 0, goalsScoredLastSeason: 0
    };

    if (!Array.isArray(matches)) return stats;

    matches.forEach(pastMatch => {
        const isCurrentSeason = pastMatch.season_id === currentSeasonId;
        const isPreviousSeason = pastMatch.season_id === previousSeasonId;

        if (isCurrentSeason) {
            stats.gamesPlayedThisYear++;
            const teamNameForGame = pastMatch.team_name || 'Tuntematon joukkue';
            stats.gamesByTeamThisYear[teamNameForGame] = (stats.gamesByTeamThisYear[teamNameForGame] || 0) + 1;

            const playerGoals = parseInt(pastMatch.player_goals) || 0;
            stats.goalsThisYear += playerGoals;
            if (playerGoals > 0) {
                stats.goalsByTeamThisYear[teamNameForGame] = (stats.goalsByTeamThisYear[teamNameForGame] || 0) + playerGoals;
                if (teamNameForGame && teamNameForContext && teamNameForGame === teamNameForContext) {
                    stats.goalsForThisSpecificTeamInSeason += playerGoals;
                }
            }
            stats.warningsThisYear += parseInt(pastMatch.player_warnings) || 0;
            stats.suspensionsThisYear += parseInt(pastMatch.player_suspensions) || 0;

            if (pastMatch.team_name && teamNameForContext && pastMatch.team_name === teamNameForContext) {
                let opponentName = '', playerTeamScore = '', opponentScore = '', resultIndicator = '';
                const playerTeamId = pastMatch.team_id;
                let opponentTeamId = null;

                if (playerTeamId === pastMatch.team_A_id) {
                    opponentName = pastMatch.team_B_name; 
                    playerTeamScore = pastMatch.fs_A; 
                    opponentScore = pastMatch.fs_B; 
                    opponentTeamId = pastMatch.team_B_id;
                } else if (playerTeamId === pastMatch.team_B_id) {
                    opponentName = pastMatch.team_A_name; 
                    playerTeamScore = pastMatch.fs_B; 
                    const tempOpponentScore = pastMatch.fs_A; // Use a temporary variable
                    opponentScore = tempOpponentScore;       // Assign from the temporary variable
                    opponentTeamId = pastMatch.team_A_id;
                }

                if (pastMatch.status === "Fixture") resultIndicator = 'fixture';
                else if (pastMatch.winner_id && pastMatch.winner_id !== '-' && pastMatch.winner_id !== '0') {
                    if (pastMatch.winner_id === playerTeamId) resultIndicator = 'win';
                    else if (opponentTeamId && pastMatch.winner_id === opponentTeamId) resultIndicator = 'loss';
                    else resultIndicator = 'draw'; 
                } else { 
                    const pScore = parseInt(playerTeamScore); const oScore = parseInt(opponentScore);
                    if (!isNaN(pScore) && !isNaN(oScore)) resultIndicator = pScore > oScore ? 'win' : (pScore < oScore ? 'loss' : 'draw');
                    else resultIndicator = 'draw'; 
                }
                stats.pastMatchesDetails.push({
                    date: pastMatch.date, opponentName: opponentName || 'N/A', playerTeamScore, opponentScore,
                    resultIndicator, playerTeamNameInPastMatch: pastMatch.team_name || 'N/A', status: pastMatch.status
                });
            }
        } else if (isPreviousSeason) {
            stats.gamesPlayedLastSeason++;
            stats.goalsScoredLastSeason += parseInt(pastMatch.player_goals) || 0;
        }
    });
    return stats;
}

/**
 * Fetches and processes data for a single player.
 * @param {string} playerId - The ID of the player.
 * @param {string} teamIdInMatch - The ID of the team the player belongs to in this specific match.
 * @param {Object} fullMatchData - The full details of the current match.
 * @param {Object} playerLineupInfoFromMatch - Lineup info for the player from the match data.
 * @returns {Promise<Object|null>} - Processed player stats object or null if an error occurs or player is invalid.
 */
async function fetchAndProcessPlayerData(playerId, teamIdInMatch, fullMatchData, playerLineupInfoFromMatch) {
    const defaultPlayerInfo = { 
        name: playerLineupInfoFromMatch.player_name || `Pelaaja ${playerId}`,
        shirtNumber: playerLineupInfoFromMatch.shirt_number || 'N/A',
        birthYear: 'N/A', teamsThisYear: 'Ei voitu hakea', gamesPlayedThisYear: 0, 
        gamesByTeamThisYear: {}, goalsThisYear: 0, goalsByTeamThisYear: {},
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [], gamesPlayedLastSeason: 0, 
        goalsScoredLastSeason: 0, warningsThisYear: 0, suspensionsThisYear: 0, 
        position_fi: null, nationality: null, img_url: null, height: null, weight: null, 
        finland_raised: null, isCaptainInMatch: false, added: null, removed: null, 
        dual_representation: null, dual_1_representation: null, dual_2_representation: null, 
        overage: null, parallel_representation: null, exception_representation: null,
        teamIdInMatch: teamIdInMatch, 
        clubCrest: teamIdInMatch === fullMatchData.team_A_id ? fullMatchData.club_A_crest : fullMatchData.club_B_crest
    };

    if (!playerId || playerId.toString().startsWith("oma_maali")) { 
        console.warn(`Player ID puuttuu tai on "oma maali" (${playerId}), ohitetaan pelaaja.`);
        return null; 
    }
    try {
        const playerData = await fetchAPIData('getPlayer', { player_id: playerId.toString() });
        if (!playerData.player) { 
            console.error(`Pelaajaa ${playerId} ei löytynyt tai data on virheellistä (API response).`);
            return {...defaultPlayerInfo, teamsThisYear: `Ei löytynyt (API)`};
        }
        
        const playerDataFromAPI = playerData.player;
        const playerName = playerLineupInfoFromMatch.player_name || `${playerDataFromAPI.first_name || ''} ${playerDataFromAPI.last_name || ''}`.trim();
        const shirtNumber = playerLineupInfoFromMatch.shirt_number || 'N/A';        
        const teamNameForThisContext = (teamIdInMatch === fullMatchData.team_A_id) 
                                    ? fullMatchData.team_A_name 
                                    : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name : 
                                       (playerLineupInfoFromMatch && playerLineupInfoFromMatch.team_name_from_getTeam ? playerLineupInfoFromMatch.team_name_from_getTeam : null));

        const seasonStats = processPlayerMatchHistory(playerDataFromAPI.matches, config.CURRENT_YEAR, config.PREVIOUS_YEAR, teamNameForThisContext);
        
        let teamsThisYear = [];
        if (playerDataFromAPI.teams && Array.isArray(playerDataFromAPI.teams)) {
             playerDataFromAPI.teams.forEach(teamEntry => {
                if (teamEntry.primary_category && 
                    ( (teamEntry.primary_category.competition_id && teamEntry.primary_category.competition_id.toLowerCase().includes(config.CURRENT_YEAR.substring(2))) || 
                      (teamEntry.primary_category.competition_name && teamEntry.primary_category.competition_name.includes(config.CURRENT_YEAR)) )) {
                    teamsThisYear.push(`${teamEntry.team_name} (${teamEntry.primary_category.category_name || 'Sarja tuntematon'})`);
                }
             });
        }
         if (teamsThisYear.length === 0 && playerDataFromAPI.club_name) { 
            teamsThisYear.push(`${playerDataFromAPI.club_name} (Joukkueen tarkka sarja ${config.CURRENT_YEAR} ei tiedossa)`);
        }
        if (teamsThisYear.length === 0) {
            teamsThisYear.push("Ei joukkueita tiedossa tälle vuodelle.");
        }

        return { 
            ...defaultPlayerInfo, 
            name: playerName, shirtNumber: shirtNumber, birthYear: playerDataFromAPI.birthyear || 'N/A', 
            ...seasonStats, 
            teamsThisYear: teamsThisYear.join('<br>'),
            position_fi: playerDataFromAPI.position_fi, nationality: playerDataFromAPI.nationality, 
            img_url: playerDataFromAPI.img_url, height: playerDataFromAPI.height, weight: playerDataFromAPI.weight,
            finland_raised: playerDataFromAPI.finland_raised,
            isCaptainInMatch: playerLineupInfoFromMatch.captain === "1" || playerLineupInfoFromMatch.captain === "C",
            added: playerDataFromAPI.added, removed: playerDataFromAPI.removed, 
            dual_representation: playerDataFromAPI.dual_representation, 
            dual_1_representation: playerDataFromAPI.dual_1_representation,
            dual_2_representation: playerDataFromAPI.dual_2_representation, 
            overage: playerDataFromAPI.overage, 
            parallel_representation: playerDataFromAPI.parallel_representation, 
            exception_representation: playerDataFromAPI.exception_representation,
        };
    } catch (error) { 
        console.error(`Virhe pelaajan ${playerId} tietojen käsittelyssä (${error.message}):`, error);
         return {...defaultPlayerInfo, teamsThisYear: `Virhe haussa pelaajalle ${playerId}`}; 
    }
}

// --- DOM Manipulation Functions ---

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

/**
 * Creates the HTML element for a player statistics card.
 * @param {Object} stats - The player's statistics object.
 * @returns {HTMLElement} - The card element.
 */
function createPlayerStatCardElement(stats) {
    const card = document.createElement('div');
    card.className = 'stat-card bg-white border border-gray-200 p-5 rounded-lg shadow-lg hover:shadow-xl';
    
    const playerImageHtml = (stats.img_url && stats.img_url !== config.NO_PLAYER_IMAGE_URL)
        ? `<img src="${stats.img_url}" alt="Pelaajan kuva" class="player-image" onerror="this.style.display='none';">`
        : '';
    
    const crestUrl = (stats.clubCrest && stats.clubCrest !== config.DEFAULT_CREST_URL) 
        ? stats.clubCrest 
        : config.PLACEHOLDER_CREST_URL;
    
    let goalsDisplayContent = stats.goalsThisYear.toString();
    if (stats.goalsThisYear > 0 && stats.goalsByTeamThisYear && Object.keys(stats.goalsByTeamThisYear).length > 0) {
        if (!(Object.keys(stats.goalsByTeamThisYear).length === 1 && stats.goalsByTeamThisYear[Object.keys(stats.goalsByTeamThisYear)[0]] === stats.goalsThisYear)) {
            goalsDisplayContent = Object.entries(stats.goalsByTeamThisYear)
                .map(([teamName, teamGoals]) => `${teamName}: ${teamGoals}`)
                .join('<br>');
            if (Object.keys(stats.goalsByTeamThisYear).length > 1) {
                 goalsDisplayContent += `<br><b>Yhteensä: ${stats.goalsThisYear}</b>`;
            }
        }
    }

    let gamesPlayedDisplayContent = stats.gamesPlayedThisYear.toString(); 
    if (stats.gamesPlayedThisYear > 0 && stats.gamesByTeamThisYear && Object.keys(stats.gamesByTeamThisYear).length > 0) {
        if (!(Object.keys(stats.gamesByTeamThisYear).length === 1 && stats.gamesByTeamThisYear[Object.keys(stats.gamesByTeamThisYear)[0]] === stats.gamesPlayedThisYear)) {
            gamesPlayedDisplayContent = Object.entries(stats.gamesByTeamThisYear)
                .map(([teamName, teamGames]) => `${teamName}: ${teamGames}`)
                .join('<br>');
            if (Object.keys(stats.gamesByTeamThisYear).length > 1) { 
                 gamesPlayedDisplayContent += `<br><b>Yhteensä: ${stats.gamesPlayedThisYear}</b>`;
            }
        }
    }

    let additionalInfoHtmlSegments = [];
    const fieldsToShow = [
        { key: 'position_fi', label: 'Pelipaikka' }, { key: 'height', label: 'Pituus', suffix: ' cm' }, 
        { key: 'weight', label: 'Paino', suffix: ' kg' }, { key: 'finland_raised', label: 'Suomessa kasvanut', displayValue: 'Kyllä' },
        { key: 'added', label: 'Lisätty joukkueeseen' }, { key: 'removed', label: 'Poistettu joukkueesta' },
        { key: 'dual_representation', label: 'Kaksoisedustus' }, { key: 'dual_1_representation', label: 'Kaksoisedustus (1)' },
        { key: 'dual_2_representation', label: 'Kaksoisedustus (2)' }, { key: 'overage', label: 'Yli-ikäisyys' },
        { key: 'parallel_representation', label: 'Rinnakkaisedustus' }, { key: 'exception_representation', label: 'Poikkeuslupa' }
    ];
    if (stats.isCaptainInMatch) { 
        fieldsToShow.splice(4, 0, { key: 'isCaptainInMatch', label: 'Kapteeni tässä ottelussa', displayValue: 'Kyllä' });
    }

    fieldsToShow.forEach(field => {
        let value = stats[field.key];
        let displayValue = value;
        if (field.displayValue) { 
            if (value === true || String(value) === "1") displayValue = field.displayValue;
            else return; 
        }
        if (field.suffix && String(value) !== '0' && value) { 
             displayValue += field.suffix;
        }
        additionalInfoHtmlSegments.push(createStatItemHtml(field.label, displayValue));
    });
    const additionalInfoHtml = additionalInfoHtmlSegments.filter(s => s).join('');
        
    const suspensionsHtml = (stats.suspensionsThisYear > 0) 
        ? createStatItemHtml(`Ulosajot (${config.CURRENT_YEAR})`, stats.suspensionsThisYear, "bg-gray-50 p-3 rounded-md sm:col-span-2") : '';
    
    const previousSeasonStatsHtml = (stats.gamesPlayedLastSeason > 0 || stats.goalsScoredLastSeason > 0)
        ? `${createStatItemHtml(`Ottelut (${config.PREVIOUS_YEAR})`, stats.gamesPlayedLastSeason)}
           ${createStatItemHtml(`Maalit (${config.PREVIOUS_YEAR})`, stats.goalsScoredLastSeason)}`
        : '';

    let pastMatchesDisplayHtml = '';
    if (stats.pastMatchesDetails && stats.pastMatchesDetails.length > 0) {
        const matchesHtml = stats.pastMatchesDetails.slice(0, 10).map(match => { 
            let matchDisplay;
            if (match.status === "Fixture") {
                matchDisplay = `${match.date}: ${match.playerTeamNameInPastMatch} vs ${match.opponentName} (Tuleva)`;
            } else {
                const indicatorClass = match.resultIndicator || 'draw'; 
                matchDisplay = `<span class="result-indicator ${indicatorClass}"></span>
                                ${match.date}: ${match.playerTeamNameInPastMatch} vs ${match.opponentName} (${match.playerTeamScore}-${match.opponentScore})`;
            }
            return `<li class="past-match-item">${matchDisplay}</li>`;
        }).join('');
        pastMatchesDisplayHtml = `<div class="mt-4 pt-4 border-t border-gray-200 col-span-1 sm:col-span-2">
                                <h4 class="text-md font-semibold text-gray-700 mb-2">Pelatut ottelut tälle joukkueelle (${config.CURRENT_YEAR}):</h4>
                                <ul class="list-none pl-0 space-y-1">${matchesHtml}</ul></div>`;
    }

    card.innerHTML = `
        <div class="flex items-center mb-4">
            <img src="${crestUrl}" alt="Seuran logo" class="w-10 h-10 mr-3 rounded-full object-contain" onerror="this.src='${config.PLACEHOLDER_CREST_URL}'; this.onerror=null;">
            ${playerImageHtml}
            <div class="${playerImageHtml ? '' : 'ml-3'}">
                <h3 class="text-xl font-semibold text-blue-700">${stats.name} ${stats.shirtNumber !== 'N/A' ? `(#${stats.shirtNumber})` : ''}</h3>
                ${createStatItemHtml("Syntymävuosi", stats.birthYear, "text-sm text-gray-500 p-0")}
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            ${createStatItemHtml(`Joukkueet (${config.CURRENT_YEAR})`, stats.teamsThisYear)}
            ${createStatItemHtml(`Pelatut ottelut (${config.CURRENT_YEAR})`, gamesPlayedDisplayContent)}
            ${createStatItemHtml(`Maalit (${config.CURRENT_YEAR})`, goalsDisplayContent)}
            ${createStatItemHtml(`Varoitukset (${config.CURRENT_YEAR})`, stats.warningsThisYear)}
            ${suspensionsHtml}
            ${previousSeasonStatsHtml}
        </div>
        ${additionalInfoHtml ? `<div class="mt-4 pt-4 border-t border-gray-200"><h4 class="text-md font-semibold text-gray-700 mb-2">Lisätiedot:</h4><div class="additional-info-grid">${additionalInfoHtml}</div></div>` : ''}
        ${pastMatchesDisplayHtml} 
    `;
    return card;
}

/**
 * Displays general match information.
 * @param {Object} match - The match details object.
 * @param {Object|null} groupDataForMatchInfo - Group data for H2H and referee comparison.
 * @param {number} [lineupGoalsA=0] - Total goals from team A's lineup this season.
 * @param {number} [lineupGoalsB=0] - Total goals from team B's lineup this season.
 * @param {HTMLElement} container - The HTML element to display the info in.
 */
function displayMatchInfo(match, groupDataForMatchInfo, lineupGoalsA = 0, lineupGoalsB = 0, container) { 
    const teamAName = match.team_A_name || 'Kotijoukkue';
    const teamBName = match.team_B_name || 'Vierasjoukkue';
    const scoreA = match.fs_A !== undefined ? match.fs_A : '-';
    const scoreB = match.fs_B !== undefined ? match.fs_B : '-';

    let teamAStatsInGroup = null;
    let teamBStatsInGroup = null;

    if (groupDataForMatchInfo && groupDataForMatchInfo.teams) {
        teamAStatsInGroup = groupDataForMatchInfo.teams.find(t => t.team_id === match.team_A_id);
        teamBStatsInGroup = groupDataForMatchInfo.teams.find(t => t.team_id === match.team_B_id);
    }
    
    let goalComparisonHtml = '';
    if (teamAStatsInGroup || teamBStatsInGroup || lineupGoalsA > 0 || lineupGoalsB > 0 || (match.lineups && match.lineups.length > 0)) {
        goalComparisonHtml = `
        <div class="mt-3 mb-3 text-center">
            <p class="text-gray-700 font-semibold text-sm mb-2">Maalivertailu (${config.CURRENT_YEAR}):</p>
            <div class="grid grid-cols-2 gap-x-2 text-xs">
                <div class="font-medium text-gray-800">${teamAName}</div>
                <div class="font-medium text-gray-800">${teamBName}</div>
                <div class="text-gray-600">Lohkossa (TM-PM):</div>
                <div class="text-gray-600">Lohkossa (TM-PM):</div>
                <div class="font-semibold text-gray-700">${teamAStatsInGroup ? `${(teamAStatsInGroup.goals_for || 0)}-${(teamAStatsInGroup.goals_against || 0)}` : 'N/A'}</div>
                <div class="font-semibold text-gray-700">${teamBStatsInGroup ? `${(teamBStatsInGroup.goals_for || 0)}-${(teamBStatsInGroup.goals_against || 0)}` : 'N/A'}</div>
                <div class="text-gray-600 mt-1">Kokoonpanon maalit:</div>
                <div class="text-gray-600 mt-1">Kokoonpanon maalit:</div>
                <div class="font-semibold text-gray-700">${lineupGoalsA}</div>
                <div class="font-semibold text-gray-700">${lineupGoalsB}</div>
            </div>
        </div>`;
    }

    let headToHeadHtml = '';
    if (groupDataForMatchInfo && groupDataForMatchInfo.matches) {
        const teamAId = match.team_A_id;
        const teamBId = match.team_B_id;
        const currentMatchId = match.match_id;

        const previousEncounters = groupDataForMatchInfo.matches.filter(m =>
            m.match_id !== currentMatchId && 
            ((m.team_A_id === teamAId && m.team_B_id === teamBId) || (m.team_A_id === teamBId && m.team_B_id === teamAId)) &&
            m.status === "Played" 
        ).sort((a, b) => new Date(`${b.date}T${b.time || '00:00:00'}`) - new Date(`${a.date}T${a.time || '00:00:00'}`)) 
         .slice(0, 3);

        if (previousEncounters.length > 0) {
            headToHeadHtml = `<div class="mt-4 pt-3 border-t border-gray-200">
                                <h4 class="text-sm font-semibold text-gray-700 mb-1 text-center">Viimeiset keskinäiset kohtaamiset:</h4>
                                <ul class="head-to-head-list text-center">`;
            previousEncounters.forEach(enc => {
                headToHeadHtml += `<li>${enc.date}: ${enc.team_A_name} ${enc.fs_A !== undefined ? enc.fs_A : '-'} - ${enc.fs_B !== undefined ? enc.fs_B : '-'} ${enc.team_B_name}</li>`;
            });
            headToHeadHtml += `</ul></div>`;
        }
    }

    let refereeInfoHtml = '';
    if (match.referee_1_name) {
        refereeInfoHtml += `<p class="text-sm text-gray-600 text-center mt-3">Erotuomari: ${match.referee_1_name}</p>`;
    }

    let refereePastGamesHtml = '';
    if (match.referee_1_id && groupDataForMatchInfo && groupDataForMatchInfo.matches) {
        const currentRefereeId = match.referee_1_id;
        const teamAId = match.team_A_id;
        const teamBId = match.team_B_id;

        const getRefereeGamesList = (targetTeamId, targetTeamName) => {
            const games = groupDataForMatchInfo.matches
                .filter(m => 
                    m.referee_1_id === currentRefereeId &&
                    (m.team_A_id === targetTeamId || m.team_B_id === targetTeamId) &&
                    m.status === "Played" &&
                    m.match_id !== match.match_id
                )
                .sort((a, b) => new Date(`${b.date}T${b.time || '00:00:00'}`) - new Date(`${a.date}T${a.time || '00:00:00'}`))
                .slice(0, 3);

            if (games.length > 0) {
                let listHtml = `<div class="mt-2"><h5 class="text-xs font-semibold text-gray-600">Erotuomarin aiemmat ottelut joukkueelle ${targetTeamName}:</h5><ul class="list-none pl-0 text-xs text-gray-500">`;
                games.forEach(pastGame => {
                    let opponentName, teamScore, opponentScore, resultIndicatorClass;
                    if (pastGame.team_A_id === targetTeamId) {
                        opponentName = pastGame.team_B_name; teamScore = pastGame.fs_A; opponentScore = pastGame.fs_B;
                        if (pastGame.winner_id === targetTeamId) resultIndicatorClass = 'win';
                        else if (pastGame.winner_id === pastGame.team_B_id) resultIndicatorClass = 'loss';
                        else resultIndicatorClass = 'draw';
                    } else { 
                        opponentName = pastGame.team_A_name; teamScore = pastGame.fs_B; opponentScore = pastGame.fs_A;
                        if (pastGame.winner_id === targetTeamId) resultIndicatorClass = 'win';
                        else if (pastGame.winner_id === pastGame.team_A_id) resultIndicatorClass = 'loss';
                        else resultIndicatorClass = 'draw';
                    }
                    if (!pastGame.winner_id || pastGame.winner_id === '-' || pastGame.winner_id === '0') {
                        resultIndicatorClass = 'draw';
                    }
                    listHtml += `<li class="referee-past-game-item"><span class="result-indicator ${resultIndicatorClass}"></span> ${pastGame.date}: vs ${opponentName} (${teamScore !== undefined ? teamScore : '-'}-${opponentScore !== undefined ? opponentScore : '-'})</li>`;
                });
                listHtml += `</ul></div>`;
                return listHtml;
            }
            return '';
        };
        refereePastGamesHtml += `<div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 text-center">${getRefereeGamesList(teamAId, teamAName)}${getRefereeGamesList(teamBId, teamBName)}</div>`;
    }
    
    container.innerHTML = `
        <h2 class="text-2xl font-semibold text-gray-700 mb-2 text-center">${teamAName} vs ${teamBName}</h2>
        <p class="text-xl text-gray-600 text-center mb-2">Tulos: ${scoreA} - ${scoreB}</p>
        ${goalComparisonHtml}
        ${headToHeadHtml}    
        ${refereeInfoHtml} 
        ${refereePastGamesHtml}
        <p class="text-sm text-gray-500 text-center mt-3">Päivämäärä: ${match.date || 'N/A'}</p>
        <p class="text-sm text-gray-500 text-center">Sarja: ${match.category_name || 'N/A'} (${match.competition_name || 'N/A'})</p>
    `;
}

/**
 * Displays group information and standings table.
 * @param {Object} group - The group details object.
 * @param {string} currentMatchTeamAId - ID of team A in the current match.
 * @param {string} currentMatchTeamBId - ID of team B in the current match.
 * @param {HTMLElement} container - The HTML element to display the info in.
 */
function displayGroupInfoAndStandings(group, currentMatchTeamAId, currentMatchTeamBId, container) {
    if (!group || !group.teams || group.teams.length === 0) {
        container.innerHTML = '<p class="text-gray-700 text-center">Sarjataulukkoa ei löytynyt tälle lohkolle.</p>';
        container.classList.remove('hidden');
        return;
    }

    const groupName = group.group_name || 'Lohko';
    const categoryName = group.category_name || 'Sarja';
    const competitionName = group.competition_name || '';

    let tableHtml = `
        <h3 class="text-xl font-semibold text-gray-700 mb-1 text-center">${categoryName} - ${groupName}</h3>
        <p class="text-sm text-gray-500 text-center mb-4">(${competitionName})</p>
        <div class="overflow-x-auto">
            <table class="standings-table min-w-full">
                <thead><tr>
                    <th class="rank">#</th><th class="team-name">Joukkue</th>
                    <th class="number-col">O</th><th class="number-col">V</th><th class="number-col">T</th><th class="number-col">H</th>
                    <th class="number-col">TM</th><th class="number-col">PM</th><th class="number-col">ME</th><th class="number-col">P</th>
                </tr></thead><tbody>`;
    
    const sortedTeams = [...group.teams].sort((a, b) => (parseInt(a.current_standing) || 999) - (parseInt(b.current_standing) || 999));

    sortedTeams.forEach(team => {
        const isCurrentTeam = team.team_id === currentMatchTeamAId || team.team_id === currentMatchTeamBId;
        tableHtml += `
            <tr>
                <td class="rank">${team.current_standing || '-'}</td>
                <td class="team-name">${isCurrentTeam ? `<strong>${team.team_name || 'N/A'}</strong>` : (team.team_name || 'N/A')}</td>
                <td class="number-col">${team.matches_played || 0}</td><td class="number-col">${team.matches_won || 0}</td>
                <td class="number-col">${team.matches_tied || 0}</td><td class="number-col">${team.matches_lost || 0}</td>
                <td class="number-col">${team.goals_for || 0}</td><td class="number-col">${team.goals_against || 0}</td>
                <td class="number-col">${team.goals_diff || 0}</td><td class="number-col"><strong>${team.points || 0}</strong></td>
            </tr>`;
    });

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
    container.classList.remove('hidden');
}

/**
 * Processes and displays player statistics for players in the match lineup.
 * @param {Array<Object>} playersInMatch - Array of player lineup info from match details.
 * @param {Object} matchDetails - The full details of the current match.
 * @param {Object|null} groupDataForInfo - Group data for context.
 * @param {HTMLElement} container - The HTML element to append player cards to.
 * @returns {Promise<{lineupPlayerIds: string[], teamAName: string, teamBName: string}>} Player IDs and team names.
 */
async function processAndDisplayPlayerStats(playersInMatch, matchDetails, groupDataForInfo, container) {
    const teamAName = matchDetails.team_A_name || 'Kotijoukkue';
    const teamBName = matchDetails.team_B_name || 'Vierasjoukkue';

    if (!playersInMatch || playersInMatch.length === 0) {
        container.innerHTML = '<p class="text-gray-700 text-center">Ottelulle ei löytynyt pelaajatietoja kokoonpanosta.</p>';
        displayMatchInfo(matchDetails, groupDataForInfo, 0, 0, matchInfoContainer);
        return { lineupPlayerIds: [], teamAName, teamBName };
    }

    const playerPromises = playersInMatch.map(playerLineupInfo =>
        fetchAndProcessPlayerData(playerLineupInfo.player_id, playerLineupInfo.team_id, matchDetails, playerLineupInfo)
    );

    const allPlayerStats = (await Promise.all(playerPromises)).filter(stats => stats !== null);

    let totalLineupGoalsTeamA = 0;
    let totalLineupGoalsTeamB = 0;

    allPlayerStats.forEach(player => {
        if (player.teamIdInMatch === matchDetails.team_A_id) {
            totalLineupGoalsTeamA += (player.goalsForThisSpecificTeamInSeason || 0);
        } else if (player.teamIdInMatch === matchDetails.team_B_id) {
            totalLineupGoalsTeamB += (player.goalsForThisSpecificTeamInSeason || 0);
        }
    });

    displayMatchInfo(matchDetails, groupDataForInfo, totalLineupGoalsTeamA, totalLineupGoalsTeamB, matchInfoContainer);

    allPlayerStats.sort((a, b) => { // Sorting logic remains the same
        const getTeamSortOrder = (teamId) => (teamId === matchDetails.team_A_id ? 1 : (teamId === matchDetails.team_B_id ? 2 : 3));
        const teamOrderA = getTeamSortOrder(a.teamIdInMatch);
        const teamOrderB = getTeamSortOrder(b.teamIdInMatch);
        if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB;
        const numA = parseInt(a.shirtNumber);
        const numB = parseInt(b.shirtNumber);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return a.name.localeCompare(b.name);
    });

    if (allPlayerStats.length === 0) {
        container.innerHTML = '<p class="text-gray-700 text-center">Pelaajien tilastojen haku epäonnistui kaikille kokoonpanon pelaajille.</p>';
    } else {
        container.innerHTML = ''; // Clear previous content before adding new cards
        let currentTeamIdDisplayed = null;
        allPlayerStats.forEach(playerFullStats => {
            if (playerFullStats.teamIdInMatch !== currentTeamIdDisplayed) {
                currentTeamIdDisplayed = playerFullStats.teamIdInMatch;
                const teamHeader = document.createElement('h2');
                teamHeader.className = 'text-2xl font-semibold text-gray-700 mt-8 mb-4 pt-4 border-t border-gray-200';
                teamHeader.textContent = currentTeamIdDisplayed === matchDetails.team_A_id ? teamAName : (currentTeamIdDisplayed === matchDetails.team_B_id ? teamBName : `Joukkue ID: ${currentTeamIdDisplayed}`);
                container.appendChild(teamHeader);
            }
            displayPlayerStats(playerFullStats, container);
        });
    }
    return { lineupPlayerIds: playersInMatch.map(p => p.player_id.toString()), teamAName, teamBName };
}

/**
 * Displays a single player's statistics card in the UI.
 * @param {Object} stats - The player's statistics object.
 * @param {HTMLElement} container - The HTML element to append the card to.
 */
function displayPlayerStats(stats, container) { 
    const cardElement = createPlayerStatCardElement(stats);
    container.appendChild(cardElement);
}

/**
 * Displays players who are in the team roster but not in the current match lineup.
 * @param {Object} teamDetails - Full team details from getTeam API.
 * @param {Array<string>} matchLineupPlayerIds - Array of player IDs who are in the match lineup.
 * @param {string} teamDisplayName - The display name of the team.
 * @param {string} teamType - 'A' or 'B' to denote home/away, for context.
 * @param {Object} originalMatchDetails - The original match details for context.
 * @param {HTMLElement} container - The HTML element to append player cards to.
 */
async function displayPlayersNotInLineup(teamDetails, matchLineupPlayerIds, teamDisplayName, teamType, originalMatchDetails, container) {
    if (!teamDetails || !teamDetails.players || teamDetails.players.length === 0) {
        return; 
    }

    const playersNotInMatch = teamDetails.players.filter(player => 
        player.player_id && !matchLineupPlayerIds.includes(player.player_id.toString()) && player.inactive !== "1"
    );

    if (playersNotInMatch.length > 0) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'mt-8 p-6 bg-gray-100 rounded-lg shadow-inner';
        
        const header = document.createElement('h3');
        header.className = 'text-xl font-semibold text-gray-800 mb-4 border-b pb-2';
        header.textContent = `Muut joukkueen pelaajat (${teamDisplayName})`;
        sectionDiv.appendChild(header);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'space-y-6'; 
        
        playersNotInMatch.sort((a,b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || ''));

        const playerStatPromises = playersNotInMatch.map(async (playerFromTeam) => {
            const playerLineupInfo = { 
                player_id: playerFromTeam.player_id,
                player_name: `${playerFromTeam.first_name || ''} ${playerFromTeam.last_name || ''}`.trim() || `Pelaaja ID: ${playerFromTeam.player_id}`,
                shirt_number: playerFromTeam.shirt_number || 'N/A',
                team_id: teamDetails.team_id, 
                team_name_from_getTeam: teamDetails.team_name, 
                captain: '' 
            };
            return fetchAndProcessPlayerData(playerFromTeam.player_id, teamDetails.team_id, originalMatchDetails, playerLineupInfo);
        });

        const resolvedPlayerStatsArray = (await Promise.all(playerStatPromises)).filter(stats => stats !== null);

        if (resolvedPlayerStatsArray.length > 0) {
            resolvedPlayerStatsArray.forEach(stats => {
                displayPlayerStats(stats, cardsContainer); 
            });
            sectionDiv.appendChild(cardsContainer);
        } else if (playersNotInMatch.length > 0) { 
            const noPlayersMsg = document.createElement('p');
            noPlayersMsg.className = 'text-gray-600';
            noPlayersMsg.textContent = 'Ei muita pelaajia näytettäväksi tälle joukkueelle (tilastojen haku saattoi epäonnistua).';
            sectionDiv.appendChild(noPlayersMsg);
        }
        container.appendChild(sectionDiv);
    }
}

// --- Main Application Logic ---

/**
 * Main function to orchestrate fetching and displaying all data.
 */
async function loadMatchData() {
    const matchId = matchIdInput.value.trim();
    if (!matchId) {
        displayError("Syötä ottelun ID.");
        return;
    }

    clearPreviousData();
    showLoading(true);
    displayError("");

    try {
        const matchDetails = await fetchMatchDetails(matchId);
        if (!matchDetails) return;

        const groupDataForInfo = await fetchGroupDetails(matchDetails);
        if (groupDataForInfo) {
            displayGroupInfoAndStandings(groupDataForInfo, matchDetails.team_A_id, matchDetails.team_B_id, groupInfoContainer);
        }

        const [teamAData, teamBData] = await Promise.all([
            fetchTeamData(matchDetails.team_A_id),
            fetchTeamData(matchDetails.team_B_id)
        ]);
        
        const { lineupPlayerIds, teamAName, teamBName } = await processAndDisplayPlayerStats(matchDetails.lineups, matchDetails, groupDataForInfo, playerStatsContainer);

        if (teamAData && teamAData.team) {
            await displayPlayersNotInLineup(teamAData.team, lineupPlayerIds, teamAName, 'A', matchDetails, playersNotInLineupContainer);
        }
        if (teamBData && teamBData.team) {
            await displayPlayersNotInLineup(teamBData.team, lineupPlayerIds, teamBName, 'B', matchDetails, playersNotInLineupContainer);
        }

    } catch (error) {
        console.error("Käsittelemätön virhe pääfunktiossa loadMatchData:", error);
        displayError(`Odottamaton virhe: ${error.message}. Tarkista konsoli.`);
    } finally {
        showLoading(false);
    }
}

// --- Event Listeners ---
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if(fetchDataButton) { // Ensure fetchDataButton exists before adding listener
        fetchDataButton.addEventListener('click', loadMatchData);
    }
}

// Export functions for testing
module.exports = {
    processPlayerMatchHistory,
    config, 
    // Potentially export other pure functions if they become complex enough for direct testing
    // createStatItemHtml, // Example if it were more complex
};
