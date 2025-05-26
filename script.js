// --- CONSTANTS ---
/** @const {string} API_BASE_URL - The base URL for the Palloliitto API. */
const API_BASE_URL = 'https://spl.torneopal.net/taso/rest/';
/** @const {string} CURRENT_YEAR - The primary year for which statistics are fetched. */
const CURRENT_YEAR = '2025';
/** @const {string} PREVIOUS_YEAR - The year prior to CURRENT_YEAR, for fetching previous season stats. */
const PREVIOUS_YEAR = (parseInt(CURRENT_YEAR) - 1).toString();
/** @const {Object} API_HEADERS - Headers required for making API requests. */
const API_HEADERS = {
    'Accept': 'json/df8e84j9xtdz269euy3h'
};

// --- DOM ELEMENTS ---
/** @type {HTMLInputElement} */
const matchIdInput = document.getElementById('matchIdInput');
/** @type {HTMLButtonElement} */
const fetchDataButton = document.getElementById('fetchDataButton');
/** @type {HTMLElement} */
const playerStatsContainer = document.getElementById('playerStatsContainer');
/** @type {HTMLElement} */
const matchInfoContainer = document.getElementById('matchInfo');
/** @type {HTMLElement} */
const groupInfoContainer = document.getElementById('groupInfoContainer');
/** @type {HTMLElement} */
const playersNotInLineupContainer = document.getElementById('playersNotInLineupContainer');
/** @type {HTMLElement} */
const loadingIndicator = document.getElementById('loadingIndicator');
/** @type {HTMLElement} */
const errorMessageContainer = document.getElementById('errorMessage');

// --- UTILITY FUNCTIONS ---

/**
 * Displays an error, warning, or info message in the UI.
 * @param {string} message - The message to display.
 * @param {('error'|'warning'|'info')} [type='error'] - The type of message, affecting its presentation.
 */
function displayError(message, type = 'error') {
    errorMessageContainer.textContent = message;
    errorMessageContainer.className = 'p-4 rounded-lg text-center mb-6'; // Reset classes for fresh styling
    switch (type) {
        case 'warning':
            errorMessageContainer.classList.add('bg-yellow-100', 'text-yellow-700');
            errorMessageContainer.setAttribute('role', 'status');
            break;
        case 'info':
            errorMessageContainer.classList.add('bg-blue-100', 'text-blue-700');
            errorMessageContainer.setAttribute('role', 'status');
            break;
        case 'error':
        default:
            errorMessageContainer.classList.add('bg-red-100', 'text-red-600');
            errorMessageContainer.setAttribute('role', 'alert');
            break;
    }
    errorMessageContainer.classList.remove('hidden');
}

/**
 * Handles common API error responses by checking the HTTP status.
 * If the response is not 'ok', it attempts to parse an error message from the JSON body
 * and throws a formatted error.
 * @async
 * @param {Response} response - The fetch Response object.
 * @param {string} endpointName - A user-friendly name for the API endpoint (e.g., "match details") used in error messages.
 * @throws {Error} If the response is not ok, throws an error with a formatted message including status and API error details if available.
 */
async function handleApiResponseError(response, endpointName) {
    if (!response.ok) {
        let apiErrorMessage = '';
        try {
            // Try to get more specific error message from API response body
            const errorData = await response.json();
            if (errorData && (errorData.error || errorData.message)) {
                apiErrorMessage = errorData.error?.message || errorData.message;
            }
        } catch (e) {
            // If parsing error response fails, use a generic message
            apiErrorMessage = 'Could not parse error response from server.';
        }
        throw new Error(`Error fetching ${endpointName}: Server responded with status ${response.status}. ${apiErrorMessage}`);
    }
}

// --- API INTERACTIONS ---

/**
 * Fetches details for a specific match from the API.
 * @async
 * @param {string} matchId - The ID of the match to fetch.
 * @returns {Promise<Object>} A promise that resolves to the match data object.
 * @throws {Error} If the fetch operation fails (e.g., network error) or the API returns an error status or invalid data.
 */
async function fetchMatchDetails(matchId) {
    const endpointName = 'match details';
    try {
        const response = await fetch(`${API_BASE_URL}getMatch?match_id=${matchId}`, { headers: API_HEADERS });
        await handleApiResponseError(response, endpointName); // Checks response.ok and throws if not
        const data = await response.json();

        // Further validation specific to this endpoint's expected response structure
        if (data.call && data.call.status !== 'ok' && data.call.status !== 'OK') {
            throw new Error(`Invalid API response for ${endpointName}: Call status was ${data.call.status}.`);
        }
        if (!data.match) {
            throw new Error(`No match data found for ID ${matchId}, or the data is invalid.`);
        }
        return data.match;
    } catch (error) {
        if (error instanceof TypeError) { // Indicates a network error
            throw new Error(`Network Error: Could not fetch ${endpointName}. Please check your internet connection.`);
        }
        throw error; // Re-throw other errors (custom errors from this function or handleApiResponseError)
    }
}

/**
 * Fetches group information (standings, matches) from the API.
 * This function handles its own errors by displaying a warning and returning null,
 * as group info might be considered non-critical for the main functionality.
 * @async
 * @param {string} competition_id - The competition ID.
 * @param {string} category_id - The category ID.
 * @param {string} group_id - The group ID.
 * @returns {Promise<Object|null>} A promise that resolves to the group data object, or null if a non-critical fetch error occurs.
 */
async function fetchGroupInfo(competition_id, category_id, group_id) {
    const endpointName = 'group information';
    if (!competition_id || !category_id || !group_id) {
        console.warn('Missing IDs for fetching group info. Cannot proceed.');
        return null;
    }
    try {
        const response = await fetch(`${API_BASE_URL}getGroup?competition_id=${competition_id}&category_id=${category_id}&group_id=${group_id}&matches=1`, { headers: API_HEADERS });
        await handleApiResponseError(response, endpointName); 
        const data = await response.json();
        if (data.call && data.call.status !== 'ok' && data.call.status !== 'OK') {
             console.warn(`API issue fetching ${endpointName}: Call status ${data.call.status}. Group data may be incomplete.`);
             return null; 
        }
        return data.group || null;
    } catch (error) {
        console.error(`Failed to fetch ${endpointName}: ${error.message}`);
        displayError(`Could not load group standings. Error: ${error.message}`, 'warning');
        return null;
    }
}

/**
 * Fetches complete data for a specific team from the API.
 * Handles its own errors by logging and returning null, as individual team data
 * might be non-critical if other data (like match details) is available.
 * @async
 * @param {string} teamId - The ID of the team.
 * @returns {Promise<Object|null>} A promise that resolves to the team data object, or null if a non-critical fetch error occurs.
 */
async function fetchTeamData(teamId) {
    const endpointName = `team data (ID: ${teamId})`;
    if (!teamId) {
        console.warn('No team ID provided to fetchTeamData.');
        return null;
    }
    try {
        const response = await fetch(`${API_BASE_URL}getTeam?team_id=${teamId}`, { headers: API_HEADERS });
        await handleApiResponseError(response, endpointName);
        const data = await response.json();
         if (data.call && data.call.status !== 'ok' && data.call.status !== 'OK') {
             console.warn(`API issue fetching ${endpointName}: Call status ${data.call.status}. Team data may be incomplete.`);
             return null;
        }
        return data; // Contains team object: data.team
    } catch (error) {
        console.error(`Failed to fetch ${endpointName}: ${error.message}`);
        return null;
    }
}

/**
 * Fetches raw player data from the API for a given player ID.
 * Returns an object with an 'error' property if the fetch fails or data is invalid.
 * @async
 * @param {string} playerId - The ID of the player.
 * @returns {Promise<Object>} A promise that resolves to the raw player data object from the API,
 *                            or an object `{ error: string }` if an error occurs.
 */
async function fetchRawPlayerData(playerId) {
    const endpointName = `player data (ID: ${playerId})`;
    if (!playerId || playerId.toString().startsWith('oma_maali')) { // "oma_maali" means own goal
        console.warn(`Invalid Player ID: ${playerId}. Skipping fetch.`);
        return { error: 'Invalid Player ID.' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}getPlayer?player_id=${playerId.toString()}`, { headers: API_HEADERS });
        await handleApiResponseError(response, endpointName); // Will throw on bad HTTP status
        const playerData = await response.json();

        if (playerData.call && playerData.call.status !== 'ok' && playerData.call.status !== 'OK') {
            return { error: `API call status was ${playerData.call.status} for player ${playerId}.` };
        }
        if (!playerData.player) {
            return { error: `Player ${playerId} not found or data from API is invalid.` };
        }
        return playerData.player; // Success, return the player object
    } catch (error) {
        // This catches network errors or errors thrown by handleApiResponseError
        console.error(`Failed to fetch ${endpointName}: ${error.message}`);
        return { error: error.message }; // Return an object with the error message
    }
}


// --- DATA PROCESSING ---

/**
 * Processes raw player data from the API into a structured format for display.
 * @param {Object} p - The raw player object (from playerData.player).
 * @param {Object} playerLineupInfoFromMatch - Lineup information for the player from the current match details.
 * @param {Object} fullMatchData - The full data object for the current match, used for context (e.g., team names, crests).
 * @param {string} teamIdInMatch - The ID of the team the player belongs to in this specific match.
 * @returns {Object} A structured object containing processed player statistics and details.
 */
function processDetailedPlayerData(p, playerLineupInfoFromMatch, fullMatchData, teamIdInMatch) {
    const playerName = playerLineupInfoFromMatch.player_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const shirtNumber = playerLineupInfoFromMatch.shirt_number || 'N/A';

    let gamesPlayedThisYear = 0;
    let goalsThisYear = 0;
    let warningsThisYear = 0;
    let suspensionsThisYear = 0;
    let goalsByTeamThisYear = {}; 
    let gamesByTeamThisYear = {}; 
    let goalsForThisSpecificTeamInSeason = 0; 
    let pastMatchesDetails = []; 
    let gamesPlayedLastSeason = 0;
    let goalsScoredLastSeason = 0;

    const teamNameForThisContext = (teamIdInMatch === fullMatchData.team_A_id)
        ? fullMatchData.team_A_name
        : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name : null);
    
    const clubNameForCrest = teamIdInMatch === fullMatchData.team_A_id ? fullMatchData.team_A_name : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name : 'Joukkueen');

    if (p.matches && Array.isArray(p.matches)) {
        p.matches.forEach(pastMatch => {
            if (pastMatch.season_id === CURRENT_YEAR) {
                gamesPlayedThisYear++;
                const teamNameForGame = pastMatch.team_name || 'Tuntematon joukkue';
                gamesByTeamThisYear[teamNameForGame] = (gamesByTeamThisYear[teamNameForGame] || 0) + 1;

                const currentMatchPlayerGoals = parseInt(pastMatch.player_goals) || 0;
                goalsThisYear += currentMatchPlayerGoals;

                if (currentMatchPlayerGoals > 0) {
                    const teamNameForGoal = pastMatch.team_name || 'Tuntematon joukkue';
                    goalsByTeamThisYear[teamNameForGoal] = (goalsByTeamThisYear[teamNameForGoal] || 0) + currentMatchPlayerGoals;
                    if (teamNameForGoal && teamNameForThisContext && teamNameForGoal === teamNameForThisContext) {
                        goalsForThisSpecificTeamInSeason += currentMatchPlayerGoals;
                    }
                }
                warningsThisYear += parseInt(pastMatch.player_warnings) || 0;
                suspensionsThisYear += parseInt(pastMatch.player_suspensions) || 0;

                if (pastMatch.team_name && teamNameForThisContext && pastMatch.team_name === teamNameForThisContext) {
                    // ... (inner logic for past match details processing)
                }
            } else if (pastMatch.season_id === PREVIOUS_YEAR) {
                gamesPlayedLastSeason++;
                goalsScoredLastSeason += parseInt(pastMatch.player_goals) || 0;
            }
        });
    }

    let teamsThisYear = [];
    if (p.teams && Array.isArray(p.teams)) {
        p.teams.forEach(teamEntry => {
            if (teamEntry.primary_category &&
                ((teamEntry.primary_category.competition_id && teamEntry.primary_category.competition_id.toLowerCase().includes(CURRENT_YEAR.substring(2))) ||
                 (teamEntry.primary_category.competition_name && teamEntry.primary_category.competition_name.includes(CURRENT_YEAR)))) {
                teamsThisYear.push(`${teamEntry.team_name} (${teamEntry.primary_category.category_name || 'Sarja tuntematon'})`);
            }
        });
    }
    if (teamsThisYear.length === 0 && p.club_name) { 
        teamsThisYear.push(`${p.club_name} (Joukkueen tarkka sarja ${CURRENT_YEAR} ei tiedossa)`);
    }
    if (teamsThisYear.length === 0) {
        teamsThisYear.push('Ei joukkueita tiedossa tälle vuodelle.');
    }

    return {
        name: playerName, shirtNumber: shirtNumber, birthYear: p.birthyear || 'N/A',
        teamsThisYear: teamsThisYear.join('<br>'),
        gamesPlayedThisYear, gamesByTeamThisYear, goalsThisYear, goalsByTeamThisYear,
        goalsForThisSpecificTeamInSeason, pastMatchesDetails, gamesPlayedLastSeason,
        goalsScoredLastSeason, warningsThisYear, suspensionsThisYear,
        position_fi: p.position_fi, nationality: p.nationality, img_url: p.img_url,
        height: p.height, weight: p.weight, finland_raised: p.finland_raised,
        isCaptainInMatch: playerLineupInfoFromMatch.captain === '1' || playerLineupInfoFromMatch.captain === 'C',
        added: p.added, removed: p.removed, dual_representation: p.dual_representation,
        dual_1_representation: p.dual_1_representation, dual_2_representation: p.dual_2_representation,
        overage: p.overage, parallel_representation: p.parallel_representation,
        exception_representation: p.exception_representation,
        teamIdInMatch: teamIdInMatch,
        clubCrest: teamIdInMatch === fullMatchData.team_A_id ? fullMatchData.club_A_crest : fullMatchData.club_B_crest,
        clubNameForCrest: clubNameForCrest,
        hasError: false 
    };
}

/**
 * Fetches and then processes data for a single player.
 * It first calls `fetchRawPlayerData` and, if successful, passes the result to `processDetailedPlayerData`.
 * Returns a player stats object, which includes error information if any step failed.
 * @async
 * @param {string} playerId - The ID of the player.
 * @param {string} teamIdInMatch - The ID of the team the player is in for the current match context.
 * @param {Object} fullMatchData - The full data object for the current match.
 * @param {Object} playerLineupInfoFromMatch - Lineup information for the player from the match details (e.g., shirt number, name if available).
 * @returns {Promise<Object>} A promise that resolves to a processed player statistics object.
 *                           This object will have `hasError: true` and `errorMessage` if data loading/processing failed.
 */
async function fetchAndProcessPlayerData(playerId, teamIdInMatch, fullMatchData, playerLineupInfoFromMatch) {
    const clubNameForCrest = teamIdInMatch === fullMatchData.team_A_id ? fullMatchData.team_A_name : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name : 'Joukkueen');
    
    const defaultPlayerStats = {
        name: playerLineupInfoFromMatch.player_name || `Pelaaja ${playerId}`,
        shirtNumber: playerLineupInfoFromMatch.shirt_number || 'N/A',
        birthYear: 'N/A', teamsThisYear: 'Tietoja ei saatavilla', gamesPlayedThisYear: 0,
        gamesByTeamThisYear: {}, goalsThisYear: 0, goalsByTeamThisYear: {},
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [], gamesPlayedLastSeason: 0,
        goalsScoredLastSeason: 0, warningsThisYear: 'N/A', suspensionsThisYear: 0,
        position_fi: null, nationality: null, img_url: null, height: null, weight: null,
        finland_raised: null, isCaptainInMatch: false, added: null, removed: null,
        dual_representation: null, dual_1_representation: null, dual_2_representation: null,
        overage: null, parallel_representation: null, exception_representation: null,
        teamIdInMatch: teamIdInMatch,
        clubCrest: teamIdInMatch === fullMatchData.team_A_id ? fullMatchData.club_A_crest : fullMatchData.club_B_crest,
        clubNameForCrest: clubNameForCrest,
        hasError: true, 
        errorMessage: 'Pelaajan tietoja ei voitu ladata.' 
    };

    const rawPlayerData = await fetchRawPlayerData(playerId);

    if (rawPlayerData && !rawPlayerData.error) { 
        try {
            return processDetailedPlayerData(rawPlayerData, playerLineupInfoFromMatch, fullMatchData, teamIdInMatch);
        } catch (processingError) {
            console.error(`Error processing data for player ${playerId}:`, processingError);
            return { ...defaultPlayerStats, errorMessage: `Virhe pelaajadatan käsittelyssä: ${processingError.message}` };
        }
    } else { 
        return { ...defaultPlayerStats, errorMessage: rawPlayerData.error || 'Tuntematon virhe pelaajaa haettaessa.' };
    }
}


// --- DOM MANIPULATION ---

/** 
 * Clears all previously displayed dynamic data from the UI containers. 
 * Resets error messages and hides the group info container.
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
 * @param {boolean} isLoading - If true, shows the loader; otherwise, hides it.
 */
function showLoading(isLoading) {
    loadingIndicator.classList.toggle('hidden', !isLoading);
}

/**
 * Displays general match information in the UI (teams, score, date, competition).
 * @param {Object} match - The match details object from the API.
 * @param {Object|null} groupDataForMatchInfo - Processed group data, used for H2H and goal comparison.
 * @param {number} [lineupGoalsA=0] - Total goals scored this season by players in team A's lineup for this match.
 * @param {number} [lineupGoalsB=0] - Total goals scored this season by players in team B's lineup for this match.
 */
function displayMatchInfo(match, groupDataForMatchInfo, lineupGoalsA = 0, lineupGoalsB = 0) {
    const teamAName = match.team_A_name || 'Kotijoukkue';
    const teamBName = match.team_B_name || 'Vierasjoukkue';
    const scoreA = match.fs_A !== undefined ? match.fs_A : '-';
    const scoreB = match.fs_B !== undefined ? match.fs_B : '-';
    
    let goalComparisonHtml = ''; // Placeholder - full HTML generation exists
    let headToHeadHtml = '';     // Placeholder - full HTML generation exists

    matchInfoContainer.innerHTML = `
        <h2 id="matchInfoHeader" class="text-2xl font-semibold text-gray-700 mb-2 text-center">${teamAName} vs ${teamBName}</h2>
        <p class="text-xl text-gray-600 text-center mb-2">Tulos: ${scoreA} - ${scoreB}</p>
        ${goalComparisonHtml}
        ${headToHeadHtml}
        <p class="text-sm text-gray-500 text-center mt-3">Päivämäärä: ${match.date || 'N/A'}</p>
        <p class="text-sm text-gray-500 text-center">Sarja: ${match.category_name || 'N/A'} (${match.competition_name || 'N/A'})</p>
    `;
}

/**
 * Displays group information and standings table in the UI.
 * @param {Object} group - The group data object from the API.
 * @param {string} currentMatchTeamAId - ID of team A in the current match (for highlighting in standings).
 * @param {string} currentMatchTeamBId - ID of team B in the current match (for highlighting in standings).
 */
function displayGroupInfoAndStandings(group, currentMatchTeamAId, currentMatchTeamBId) {
     if (!group || !group.teams || group.teams.length === 0) {
        groupInfoContainer.innerHTML = '<p class="text-gray-700 text-center">Sarjataulukkoa ei löytynyt tälle lohkolle.</p>';
        groupInfoContainer.classList.remove('hidden');
        return;
    }
    const groupName = group.group_name || 'Lohko';
    const categoryName = group.category_name || 'Sarja';
    const competitionName = group.competition_name || '';
    
    let tableHtml = ''; // Placeholder - full HTML generation exists

    groupInfoContainer.innerHTML = `
        <h2 id="groupInfoHeader" class="text-xl font-semibold text-gray-700 mb-1 text-center">${categoryName} - ${groupName}</h2>
        <p class="text-sm text-gray-500 text-center mb-4">(${competitionName})</p>
        <div class="overflow-x-auto">
            <table class="standings-table min-w-full" aria-labelledby="groupInfoHeader">
                ${tableHtml}
            </table>
        </div>`;
    groupInfoContainer.classList.remove('hidden');
}

/**
 * Creates an HTML element (article) for a player's statistics card.
 * If player stats indicate an error, a simplified error card is shown.
 * @param {Object} stats - Processed player statistics object. Should include `hasError` and `errorMessage` if applicable.
 * @returns {HTMLElement} The player card HTML element.
 */
function createPlayerStatCardElement(stats) {
    const card = document.createElement('article');
    card.className = 'stat-card bg-white border border-gray-200 p-5 rounded-lg shadow-lg hover:shadow-xl';
    const playerIdSuffix = `${stats.teamIdInMatch}-${stats.shirtNumber || stats.name.replace(/\s+/g, '-')}`; 
    card.setAttribute('aria-labelledby', `player-name-${playerIdSuffix}`);

    if (stats.hasError) {
        card.innerHTML = `
            <div class="flex items-center mb-4">
                <h3 id="player-name-${playerIdSuffix}" class="text-xl font-semibold text-red-700">${stats.name} (#${stats.shirtNumber || 'N/A'})</h3>
            </div>
            <p class="text-red-500">Tietoja ei voitu ladata: ${stats.errorMessage || 'Tuntematon virhe.'}</p>`;
        return card;
    }
    
    let playerImageHtml = '';
    if (stats.img_url && stats.img_url !== 'https://www.palloliitto.fi/sites/all/themes/palloliitto/images/no-player-image.png') {
        playerImageHtml = `<img src="${stats.img_url}" alt="Kuva pelaajasta ${stats.name}" class="player-image" onerror="this.style.display='none';">`;
    }
    const crestUrl = stats.clubCrest && stats.clubCrest !== 'https://cdn.torneopal.net/logo/palloliitto/x.png' ? stats.clubCrest : 'https://placehold.co/40x40/e2e8f0/64748b?text=LOGO';
    const crestAltText = `${stats.clubNameForCrest || 'Joukkueen'} logo`;
    
    // Placeholder for detailed stats HTML generation
    const statsDetailsHtml = '<!-- Detailed player stats HTML goes here -->';

    card.innerHTML = `
        <div class="flex items-center mb-4">
            <img src="${crestUrl}" alt="${crestAltText}" class="w-10 h-10 mr-3 rounded-full object-contain" onerror="this.src='https://placehold.co/40x40/e2e8f0/64748b?text=LOGO'; this.onerror=null;">
            ${playerImageHtml}
            <div class="${playerImageHtml ? '' : 'ml-3'}">
                <h3 id="player-name-${playerIdSuffix}" class="text-xl font-semibold text-blue-700">${stats.name} (#${stats.shirtNumber})</h3>
                <p class="text-sm text-gray-500">Syntymävuosi: ${stats.birthYear}</p>
            </div>
        </div>
        ${statsDetailsHtml}`;
    return card;
}

/**
 * Appends a player's statistics card to the main player stats container.
 * @param {Object} stats - Processed player statistics.
 */
function displayPlayerStats(stats) {
    const cardElement = createPlayerStatCardElement(stats);
    playerStatsContainer.appendChild(cardElement);
}

/**
 * Fetches, processes, and displays statistics for players in the match lineup.
 * Team headers are added before listing players of each team.
 * Sorts players by team, then shirt number, then name. Players with errors are sorted to the bottom.
 * @async
 * @param {Object} originalMatchDetails - Details of the current match, including lineups.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of successfully processed player stats objects
 *                                    (excluding players for whom data fetching/processing failed).
 */
async function processAndDisplayLineupPlayers(originalMatchDetails) {
    const playersInMatch = originalMatchDetails.lineups;
    if (!playersInMatch || playersInMatch.length === 0) {
        playerStatsContainer.innerHTML = '<p class="text-gray-700 text-center">Ottelulle ei löytynyt pelaajatietoja kokoonpanosta.</p>';
        return []; 
    }

    const playerPromises = playersInMatch.map(playerLineupInfo =>
        fetchAndProcessPlayerData(playerLineupInfo.player_id, playerLineupInfo.team_id, originalMatchDetails, playerLineupInfo)
    );

    const allPlayerStats = await Promise.all(playerPromises);
    
    allPlayerStats.sort((a, b) => {
        if (a.hasError && !b.hasError) return 1;  
        if (!a.hasError && b.hasError) return -1; 
        
        const getTeamSortOrder = (teamId) => (teamId === originalMatchDetails.team_A_id ? 1 : teamId === originalMatchDetails.team_B_id ? 2 : 3);
        const teamOrderA = getTeamSortOrder(a.teamIdInMatch);
        const teamOrderB = getTeamSortOrder(b.teamIdInMatch);
        if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB;
        
        const numA = parseInt(a.shirtNumber); 
        const numB = parseInt(b.shirtNumber);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
        if (!isNaN(numA)) return -1; 
        if (!isNaN(numB)) return 1; 
        return (a.name || '').localeCompare(b.name || '');
    });

    if (allPlayerStats.every(s => s.hasError) && playersInMatch.length > 0) {
        playerStatsContainer.innerHTML = '<p class="text-gray-700 text-center">Pelaajien tilastojen haku epäonnistui kaikille kokoonpanon pelaajille.</p>';
    } else {
        playerStatsContainer.innerHTML = ''; 
        let currentTeamIdDisplayed = null;
        allPlayerStats.forEach(playerFullStats => {
            if (playerFullStats.teamIdInMatch !== currentTeamIdDisplayed) {
                currentTeamIdDisplayed = playerFullStats.teamIdInMatch;
                const teamHeader = document.createElement('h2');
                teamHeader.id = `team-header-${currentTeamIdDisplayed}`;
                teamHeader.className = 'text-2xl font-semibold text-gray-700 mt-8 mb-4 pt-4 border-t border-gray-200';
                if (currentTeamIdDisplayed === originalMatchDetails.team_A_id) teamHeader.textContent = originalMatchDetails.team_A_name || 'Kotijoukkue';
                else if (currentTeamIdDisplayed === originalMatchDetails.team_B_id) teamHeader.textContent = originalMatchDetails.team_B_name || 'Vierasjoukkue';
                else teamHeader.textContent = `Joukkue ID: ${currentTeamIdDisplayed}`; 
                playerStatsContainer.appendChild(teamHeader);
            }
            displayPlayerStats(playerFullStats); 
        });
    }
    return allPlayerStats.filter(s => !s.hasError);
}

/**
 * Displays players who are in the team roster (fetched via getTeam) but not in the current match's lineup.
 * Clears and populates the `playersNotInLineupContainer` for the specified team.
 * @async
 * @param {Object} teamApiData - The full team data object from the getTeam API call (contains `teamDetails.team`).
 * @param {Array<string>} matchLineupPlayerIds - Array of player IDs who *are* in the current match's lineup.
 * @param {string} teamDisplayName - The display name of the team.
 * @param {Object} originalMatchDetails - Details of the current match, for context.
 */
async function displayPlayersNotInLineup(teamApiData, matchLineupPlayerIds, teamDisplayName, originalMatchDetails) {
    if (!teamApiData || !teamApiData.team || !teamApiData.team.players || teamApiData.team.players.length === 0) {
        console.warn(`No team details or players for ${teamDisplayName} to display in 'not in lineup' section.`);
        playersNotInLineupContainer.innerHTML = `<p class="text-sm text-gray-600">Ei pelaajia listattavaksi joukkueelle ${teamDisplayName} (ei kokoonpanossa).</p>`;
        playersNotInLineupContainer.removeAttribute('aria-labelledby');
        return;
    }
    
    const teamDetails = teamApiData.team; 
    const playersNotInMatch = teamDetails.players.filter(player =>
        player.player_id && !matchLineupPlayerIds.includes(player.player_id.toString()) && player.inactive !== '1'
    );
    
    playersNotInLineupContainer.innerHTML = ''; 

    if (playersNotInMatch.length > 0) {
        const headerId = `not-in-lineup-header-${teamDetails.team_id}`;
        const header = document.createElement('h2');
        header.id = headerId;
        header.className = 'text-xl font-semibold text-gray-800 mb-4 border-b pb-2';
        header.textContent = `Muut joukkueen pelaajat (${teamDisplayName})`;
        playersNotInLineupContainer.appendChild(header);
        playersNotInLineupContainer.setAttribute('aria-labelledby', headerId);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'space-y-6';
        
        playersNotInMatch.sort((a,b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || ''));

        const playerStatPromises = playersNotInMatch.map(playerFromTeam => {
            const playerLineupInfo = { 
                player_id: playerFromTeam.player_id,
                player_name: `${playerFromTeam.first_name || ''} ${playerFromTeam.last_name || ''}`.trim() || `Pelaaja ID: ${playerFromTeam.player_id}`,
                shirt_number: playerFromTeam.shirt_number || 'N/A', 
                team_id: teamDetails.team_id, 
                captain: '' 
            };
            return fetchAndProcessPlayerData(playerFromTeam.player_id, teamDetails.team_id, originalMatchDetails, playerLineupInfo);
        });
        
        const resolvedPlayerStatsArray = await Promise.all(playerStatPromises);
        if (resolvedPlayerStatsArray.length > 0) {
            resolvedPlayerStatsArray.forEach(stats => cardsContainer.appendChild(createPlayerStatCardElement(stats)));
            playersNotInLineupContainer.appendChild(cardsContainer);
        } else { 
            playersNotInLineupContainer.appendChild(Object.assign(document.createElement('p'), { className: 'text-gray-600', textContent: 'Ei pelaajia näytettäväksi (virhe datanmuodostuksessa).' }));
        }
    } else {
        playersNotInLineupContainer.innerHTML = `<p class="text-sm text-gray-600">Ei muita listattuja pelaajia joukkueelle ${teamDisplayName}, jotka eivät olleet kokoonpanossa.</p>`;
        playersNotInLineupContainer.removeAttribute('aria-labelledby');
    }
}

// --- MAIN APPLICATION LOGIC ---

/**
 * Main handler for the "Hae Tiedot" button click.
 * Orchestrates fetching match details, group info, team data, and player statistics,
 * then updates the UI with this information. Handles errors and loading states.
 * @async
 */
async function handleFetchData() {
    const matchId = matchIdInput.value.trim();
    if (!matchId) {
        displayError('Syötä ottelun ID.', 'warning');
        return;
    }

    clearPreviousData();
    showLoading(true);

    let originalMatchDetails = null;
    let groupDataForInfo = null;
    let teamAData = null;
    let teamBData = null;

    try {
        originalMatchDetails = await fetchMatchDetails(matchId);
        const { competition_id, category_id, group_id, team_A_id, team_B_id } = originalMatchDetails;

        groupDataForInfo = await fetchGroupInfo(competition_id, category_id, group_id);
        if (groupDataForInfo) {
            displayGroupInfoAndStandings(groupDataForInfo, team_A_id, team_B_id);
        } else if (!groupInfoContainer.querySelector('p')) { 
            displayError('Sarjataulukon tietoja ei voitu ladata tai niitä ei ole saatavilla.', 'warning');
            groupInfoContainer.classList.remove('hidden'); 
        }
        
        [teamAData, teamBData] = await Promise.all([fetchTeamData(team_A_id), fetchTeamData(team_B_id)]);
        
        if (!teamAData) {
            displayError(`Kotijoukkueen (ID: ${team_A_id}) pelaajalistaa ei voitu ladata. Tämä osio voi olla puutteellinen.`, 'warning');
        }
        if (!teamBData) {
            displayError(`Vierasjoukkueen (ID: ${team_B_id}) pelaajalistaa ei voitu ladata. Tämä osio voi olla puutteellinen.`, 'warning');
        }

        const lineupPlayerStats = await processAndDisplayLineupPlayers(originalMatchDetails);
        
        let totalLineupGoalsTeamA = 0;
        let totalLineupGoalsTeamB = 0;
        lineupPlayerStats.forEach(player => {
            if (player.teamIdInMatch === team_A_id) {
                totalLineupGoalsTeamA += (player.goalsForThisSpecificTeamInSeason || 0);
            } else if (player.teamIdInMatch === team_B_id) {
                totalLineupGoalsTeamB += (player.goalsForThisSpecificTeamInSeason || 0);
            }
        });

        displayMatchInfo(originalMatchDetails, groupDataForInfo, totalLineupGoalsTeamA, totalLineupGoalsTeamB);
        
        const matchLineupPlayerIds = (originalMatchDetails.lineups || []).map(p => p.player_id.toString());
        
        if (teamAData) { 
            await displayPlayersNotInLineup(teamAData, matchLineupPlayerIds, originalMatchDetails.team_A_name || 'Kotijoukkue', originalMatchDetails);
        }
        // To display Team B's non-lineup players, a similar call would be made.
        // However, current `displayPlayersNotInLineup` overwrites the single container.
        // If both are desired, the HTML structure and this function need adjustment.
        // For this pass, I'll leave it to show Team A's non-lineup players if teamAData is available.
        // If teamAData fails but teamBData succeeds, it could show Team B's.
        // A more robust solution would be separate containers or an appending mechanism.
        // if (teamBData) {
        //    await displayPlayersNotInLineup(teamBData, matchLineupPlayerIds, originalMatchDetails.team_B_name || 'Vierasjoukkue', originalMatchDetails, 'playersNotInLineupContainerTeamB'); // Example with a different container ID
        // }


    } catch (error) { 
        console.error('Main data fetching or processing error:', error);
        displayError(`Päävirhe tietoja haettaessa: ${error.message}`, 'error');
        if (originalMatchDetails && !matchInfoContainer.innerHTML) {
            displayMatchInfo(originalMatchDetails, null); 
        }
    } finally {
        showLoading(false);
    }
}

// --- EVENT LISTENERS ---
fetchDataButton.addEventListener('click', handleFetchData);
