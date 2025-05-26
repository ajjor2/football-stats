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
            const errorData = await response.json();
            if (errorData && (errorData.error || errorData.message)) {
                apiErrorMessage = errorData.error?.message || errorData.message;
            }
        } catch (e) {
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
 * @throws {Error} If the fetch operation fails or the API returns an error or invalid data.
 */
async function fetchMatchDetails(matchId) {
    const endpointName = 'match details';
    try {
        const response = await fetch(`${API_BASE_URL}getMatch?match_id=${matchId}`, { headers: API_HEADERS });
        await handleApiResponseError(response, endpointName);
        const data = await response.json();
        if (data.call && data.call.status !== 'ok' && data.call.status !== 'OK') {
            throw new Error(`Invalid API response for ${endpointName}: Call status was ${data.call.status}.`);
        }
        if (!data.match) {
            throw new Error(`No match data found for ID ${matchId}, or the data is invalid.`);
        }
        return data.match;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(`Network Error: Could not fetch ${endpointName}. Please check your internet connection.`);
        }
        throw error;
    }
}

/**
 * Fetches group information (standings, matches) from the API.
 * @async
 * @param {string} competition_id - The competition ID.
 * @param {string} category_id - The category ID.
 * @param {string} group_id - The group ID.
 * @returns {Promise<Object|null>} A promise that resolves to the group data object, or null if an error occurs.
 */
async function fetchGroupInfo(competition_id, category_id, group_id) {
    const endpointName = 'group information';
    if (!competition_id || !category_id || !group_id) {
        console.warn('Missing IDs for fetching group info.');
        return null;
    }
    try {
        const response = await fetch(`${API_BASE_URL}getGroup?competition_id=${competition_id}&category_id=${category_id}&group_id=${group_id}&matches=1`, { headers: API_HEADERS });
        await handleApiResponseError(response, endpointName);
        const data = await response.json();
        if (data.call && data.call.status !== 'ok' && data.call.status !== 'OK') {
            console.warn(`API issue fetching ${endpointName}: Call status ${data.call.status}.`);
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
 * @async
 * @param {string} teamId - The ID of the team.
 * @returns {Promise<Object|null>} A promise that resolves to the team data object, or null if an error occurs.
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
            console.warn(`API issue fetching ${endpointName}: Call status ${data.call.status}.`);
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
 * @async
 * @param {string} playerId - The ID of the player.
 * @returns {Promise<Object>} A promise that resolves to the raw player data object or an error object.
 */
async function fetchRawPlayerData(playerId) {
    const endpointName = `player data (ID: ${playerId})`;
    if (!playerId || playerId.toString().startsWith('oma_maali')) {
        console.warn(`Invalid Player ID: ${playerId}. Skipping fetch.`);
        return { error: 'Invalid Player ID.' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}getPlayer?player_id=${playerId.toString()}`, { headers: API_HEADERS });
        await handleApiResponseError(response, endpointName);
        const playerData = await response.json();
        if (playerData.call && playerData.call.status !== 'ok' && playerData.call.status !== 'OK') {
            return { error: `API call status was ${playerData.call.status} for player ${playerId}.` };
        }
        if (!playerData.player) {
            return { error: `Player ${playerId} not found or data from API is invalid.` };
        }
        return playerData.player;
    } catch (error) {
        console.error(`Failed to fetch ${endpointName}: ${error.message}`);
        return { error: error.message };
    }
}

// --- DATA PROCESSING ---

/**
 * Processes raw player data from the API into a structured format for display.
 * @param {Object} p - The raw player object (from playerData.player).
 * @param {Object} playerLineupInfoFromMatch - Lineup information for the player.
 * @param {Object} fullMatchData - The full data object for the current match.
 * @param {string} teamIdInMatch - The ID of the team the player belongs to in this context.
 * @returns {Object} A structured object containing processed player statistics and details.
 */
function processDetailedPlayerData(p, playerLineupInfoFromMatch, fullMatchData, teamIdInMatch) {
    const playerName = playerLineupInfoFromMatch.player_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const shirtNumber = playerLineupInfoFromMatch.shirt_number || 'N/A';

    let gamesPlayedThisYear = 0, goalsThisYear = 0, warningsThisYear = 0, suspensionsThisYear = 0;
    let goalsByTeamThisYear = {}, gamesByTeamThisYear = {}, goalsForThisSpecificTeamInSeason = 0;
    let pastMatchesDetails = [], gamesPlayedLastSeason = 0, goalsScoredLastSeason = 0;

    const teamNameForThisContext = (teamIdInMatch === fullMatchData.team_A_id)
        ? fullMatchData.team_A_name
        : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name : playerLineupInfoFromMatch.team_name_from_getTeam); // Fallback for non-lineup players

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
                    let opponentName = '', playerTeamScoreInPastMatch = '', opponentTeamScoreInPastMatch = '', resultIndicator = '';
                    const playerTeamIdInThisPastMatch = pastMatch.team_id;
                    let opponentTeamIdForThisPastMatch = null;

                    if (playerTeamIdInThisPastMatch === pastMatch.team_A_id) {
                        opponentName = pastMatch.team_B_name;
                        playerTeamScoreInPastMatch = pastMatch.fs_A;
                        opponentTeamScoreInPastMatch = pastMatch.fs_B;
                        opponentTeamIdForThisPastMatch = pastMatch.team_B_id;
                    } else if (playerTeamIdInThisPastMatch === pastMatch.team_B_id) {
                        opponentName = pastMatch.team_A_name;
                        playerTeamScoreInPastMatch = pastMatch.fs_B;
                        opponentTeamScoreInPastMatch = pastMatch.fs_A;
                        opponentTeamIdForThisPastMatch = pastMatch.team_A_id;
                    }

                    if (pastMatch.status === "Fixture") {
                        resultIndicator = 'fixture';
                        playerTeamScoreInPastMatch = ''; 
                        opponentTeamScoreInPastMatch = '';
                    } else if (pastMatch.winner_id && pastMatch.winner_id !== '-' && pastMatch.winner_id !== '0') {
                        if (pastMatch.winner_id === playerTeamIdInThisPastMatch) resultIndicator = 'win';
                        else if (opponentTeamIdForThisPastMatch && pastMatch.winner_id === opponentTeamIdForThisPastMatch) resultIndicator = 'loss';
                        else {
                            const pScore = parseInt(playerTeamScoreInPastMatch);
                            const oScore = parseInt(opponentTeamScoreInPastMatch);
                            if (!isNaN(pScore) && !isNaN(oScore)) {
                                if (pScore > oScore) resultIndicator = 'win';
                                else if (pScore < oScore) resultIndicator = 'loss';
                                else resultIndicator = 'draw';
                            } else resultIndicator = 'draw';
                        }
                    } else {
                         const pScoreNum = parseInt(playerTeamScoreInPastMatch);
                         const oScoreNum = parseInt(opponentTeamScoreInPastMatch);
                         if (!isNaN(pScoreNum) && !isNaN(oScoreNum)) {
                             if (pScoreNum > oScoreNum) resultIndicator = 'win';
                             else if (pScoreNum < oScoreNum) resultIndicator = 'loss';
                             else resultIndicator = 'draw';
                         } else resultIndicator = 'draw';
                    }
                    pastMatchesDetails.push({
                        date: pastMatch.date, opponentName: opponentName || 'N/A',
                        playerTeamScore: playerTeamScoreInPastMatch, opponentTeamScore: opponentTeamScoreInPastMatch,
                        resultIndicator: resultIndicator, playerTeamNameInPastMatch: pastMatch.team_name || 'N/A', status: pastMatch.status
                    });
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
    if (teamsThisYear.length === 0 && p.club_name) teamsThisYear.push(`${p.club_name} (Joukkueen tarkka sarja ${CURRENT_YEAR} ei tiedossa)`);
    if (teamsThisYear.length === 0) teamsThisYear.push('Ei joukkueita tiedossa tälle vuodelle.');

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
        clubNameForCrest: (teamIdInMatch === fullMatchData.team_A_id ? fullMatchData.team_A_name : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name : 'Joukkue')),
        hasError: false
    };
}


/**
 * Fetches and then processes data for a single player.
 * @async
 * @param {string} playerId - The ID of the player.
 * @param {string} teamIdInMatch - The ID of the team the player is in for the current match context.
 * @param {Object} fullMatchData - The full data object for the current match.
 * @param {Object} playerLineupInfoFromMatch - Lineup information for the player.
 * @returns {Promise<Object>} A promise that resolves to a processed player statistics object.
 */
async function fetchAndProcessPlayerData(playerId, teamIdInMatch, fullMatchData, playerLineupInfoFromMatch) {
    const clubNameForCrest = teamIdInMatch === fullMatchData.team_A_id ? fullMatchData.team_A_name : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name : (playerLineupInfoFromMatch.team_name_from_getTeam || 'Joukkueen'));
    
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

/** * Clears all previously displayed dynamic data from the UI containers. 
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
 * Displays general match information in the UI.
 * @param {Object} match - The match details object from the API.
 * @param {Object|null} groupDataForMatchInfo - Processed group data.
 * @param {number} [lineupGoalsA=0] - Total goals by team A's lineup for team A.
 * @param {number} [lineupGoalsB=0] - Total goals by team B's lineup for team B.
 */
function displayMatchInfo(match, groupDataForMatchInfo, lineupGoalsA = 0, lineupGoalsB = 0) { 
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
            <p class="text-gray-700 font-semibold text-sm mb-2">Maalivertailu (${CURRENT_YEAR}):</p>
            <div class="grid grid-cols-2 gap-x-2 text-xs">
                <div class="font-medium text-gray-800 text-left">${teamAName}</div>
                <div class="font-medium text-gray-800 text-left">${teamBName}</div>
                
                <div class="text-gray-600 text-left">Lohkossa (TM-PM):</div>
                <div class="text-gray-600 text-left">Lohkossa (TM-PM):</div>
                <div class="font-semibold text-gray-700 text-left">${teamAStatsInGroup ? (teamAStatsInGroup.goals_for || 0) + '-' + (teamAStatsInGroup.goals_against || 0) : 'N/A'}</div>
                <div class="font-semibold text-gray-700 text-left">${teamBStatsInGroup ? (teamBStatsInGroup.goals_for || 0) + '-' + (teamBStatsInGroup.goals_against || 0) : 'N/A'}</div>
                
                <div class="text-gray-600 mt-1 text-left">Kokoonpanon maalit:</div>
                <div class="text-gray-600 mt-1 text-left">Kokoonpanon maalit:</div>
                <div class="font-semibold text-gray-700 text-left">${lineupGoalsA}</div>
                <div class="font-semibold text-gray-700 text-left">${lineupGoalsB}</div>
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
        ).sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00:00')) - new Date(a.date + 'T' + (a.time || '00:00:00'))) 
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
        
        const getRefereeGamesList = (targetTeamId, targetTeamName) => {
            const games = groupDataForMatchInfo.matches
                .filter(m => 
                    m.referee_1_id === currentRefereeId &&
                    (m.team_A_id === targetTeamId || m.team_B_id === targetTeamId) &&
                    m.status === "Played" &&
                    m.match_id !== match.match_id
                )
                .sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00:00')) - new Date(a.date + 'T' + (a.time || '00:00:00')))
                .slice(0, 3);

            if (games.length > 0) {
                let listHtml = `<div class="mt-2 text-left"><h5 class="text-xs font-semibold text-gray-600">Erotuomarin aiemmat ottelut joukkueelle ${targetTeamName}:</h5><ul class="list-none pl-0 text-xs text-gray-500">`;
                games.forEach(pastGame => {
                    let opponentName, teamScore, opponentScore, resultIndicatorClass;
                    if (pastGame.team_A_id === targetTeamId) {
                        opponentName = pastGame.team_B_name;
                        teamScore = pastGame.fs_A;
                        opponentScore = pastGame.fs_B;
                        if (pastGame.winner_id === targetTeamId) resultIndicatorClass = 'win';
                        else if (pastGame.winner_id === pastGame.team_B_id) resultIndicatorClass = 'loss';
                        else resultIndicatorClass = 'draw';
                    } else { 
                        opponentName = pastGame.team_A_name;
                        teamScore = pastGame.fs_B;
                        opponentScore = pastGame.fs_A;
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
        refereePastGamesHtml = `<div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 mt-2">${getRefereeGamesList(match.team_A_id, teamAName)}${getRefereeGamesList(match.team_B_id, teamBName)}</div>`;
    }
    
    matchInfoContainer.innerHTML = `
        <h2 id="matchInfoHeader" class="text-2xl font-semibold text-gray-700 mb-2 text-center">
            ${teamAName} vs ${teamBName}
        </h2>
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
 * Displays group information and standings table in the UI.
 * @param {Object} group - The group data object from the API.
 * @param {string} currentMatchTeamAId - ID of team A in the current match.
 * @param {string} currentMatchTeamBId - ID of team B in the current match.
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

    let tableHtml = `
        <thead>
            <tr>
                <th class="rank">#</th>
                <th class="team-name">Joukkue</th>
                <th class="number-col">O</th>
                <th class="number-col">V</th>
                <th class="number-col">T</th>
                <th class="number-col">H</th>
                <th class="number-col">TM</th>
                <th class="number-col">PM</th>
                <th class="number-col">ME</th>
                <th class="number-col">P</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    const sortedTeams = [...group.teams].sort((a, b) => (parseInt(a.current_standing) || 999) - (parseInt(b.current_standing) || 999));

    sortedTeams.forEach(team => {
        let teamNameDisplay = team.team_name || 'N/A';
        if (team.team_id === currentMatchTeamAId || team.team_id === currentMatchTeamBId) {
            teamNameDisplay = `<strong>${teamNameDisplay}</strong>`;
        }
        tableHtml += `
            <tr>
                <td class="rank">${team.current_standing || '-'}</td>
                <td class="team-name">${teamNameDisplay}</td>
                <td class="number-col">${team.matches_played || 0}</td>
                <td class="number-col">${team.matches_won || 0}</td>
                <td class="number-col">${team.matches_tied || 0}</td>
                <td class="number-col">${team.matches_lost || 0}</td>
                <td class="number-col">${team.goals_for || 0}</td>
                <td class="number-col">${team.goals_against || 0}</td>
                <td class="number-col">${team.goals_diff || 0}</td>
                <td class="number-col"><strong>${team.points || 0}</strong></td>
            </tr>
        `;
    });
    tableHtml += `</tbody>`;
    
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
 * @param {Object} stats - Processed player statistics object.
 * @returns {HTMLElement} The player card HTML element.
 */
function createPlayerStatCardElement(stats) {
    const card = document.createElement('article'); // Changed from div to article for semantics
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
    if (stats.img_url && stats.img_url !== "https://www.palloliitto.fi/sites/all/themes/palloliitto/images/no-player-image.png") {
        playerImageHtml = `<img src="${stats.img_url}" alt="Kuva pelaajasta ${stats.name}" class="player-image" onerror="this.style.display='none';">`;
    }
    
    const crestUrl = stats.clubCrest && stats.clubCrest !== "https://cdn.torneopal.net/logo/palloliitto/x.png" 
        ? stats.clubCrest 
        : 'https://placehold.co/40x40/e2e8f0/64748b?text=LOGO'; 
    const crestAltText = `${stats.clubNameForCrest || 'Joukkueen'} logo`;
            
    let goalsDisplayContent = stats.goalsThisYear.toString();
    if (stats.goalsThisYear > 0 && stats.goalsByTeamThisYear && Object.keys(stats.goalsByTeamThisYear).length > 0) {
        if (Object.keys(stats.goalsByTeamThisYear).length === 1 && stats.goalsByTeamThisYear[Object.keys(stats.goalsByTeamThisYear)[0]] === stats.goalsThisYear) {
            goalsDisplayContent = stats.goalsThisYear.toString();
        } else {
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
        if (Object.keys(stats.gamesByTeamThisYear).length === 1 && stats.gamesByTeamThisYear[Object.keys(stats.gamesByTeamThisYear)[0]] === stats.gamesPlayedThisYear) {
             gamesPlayedDisplayContent = stats.gamesPlayedThisYear.toString();
        } else {
            gamesPlayedDisplayContent = Object.entries(stats.gamesByTeamThisYear)
                .map(([teamName, teamGames]) => `${teamName}: ${teamGames}`)
                .join('<br>');
            if (Object.keys(stats.gamesByTeamThisYear).length > 1) { 
                 gamesPlayedDisplayContent += `<br><b>Yhteensä: ${stats.gamesPlayedThisYear}</b>`;
            }
        }
    }

    let additionalInfoHtml = '';
    const fieldsToShow = [
        { key: 'position_fi', label: 'Pelipaikka', defaultValue: null },
        { key: 'height', label: 'Pituus', defaultValue: '0', suffix: ' cm' },
        { key: 'weight', label: 'Paino', defaultValue: '0', suffix: ' kg' },
        { key: 'finland_raised', label: 'Suomessa kasvanut', defaultValue: '0', displayValue: 'Kyllä' },
        { key: 'added', label: 'Lisätty joukkueeseen', defaultValue: '0000-00-00 00:00:00' },
        { key: 'removed', label: 'Poistettu joukkueesta', defaultValue: '0000-00-00 00:00:00' },
        { key: 'dual_representation', label: 'Kaksoisedustus', defaultValue: '0' },
        { key: 'dual_1_representation', label: 'Kaksoisedustus (1)', defaultValue: '0' },
        { key: 'dual_2_representation', label: 'Kaksoisedustus (2)', defaultValue: '0' },
        { key: 'overage', label: 'Yli-ikäisyys', defaultValue: '0' },
        { key: 'parallel_representation', label: 'Rinnakkaisedustus', defaultValue: '' },
        { key: 'exception_representation', label: 'Poikkeuslupa', defaultValue: '0' }
    ];
    if (stats.isCaptainInMatch) { 
        fieldsToShow.splice(4, 0, { key: 'isCaptainInMatch', label: 'Kapteeni tässä ottelussa', defaultValue: false, displayValue: 'Kyllä' });
    }

    fieldsToShow.forEach(field => {
        let value = stats[field.key];
        if (value !== null && value !== undefined && value !== field.defaultValue && (field.defaultValue !== '' || value !== '')) { 
            let displayValue = value;
            if (field.displayValue) { 
                if (value === true || String(value) === "1") displayValue = field.displayValue;
                else return; 
            }
            if (field.suffix && String(value) !== '0') { 
                 displayValue += field.suffix;
            }
            additionalInfoHtml += `<div class="bg-gray-50 p-3 rounded-md"><p class="font-medium text-gray-700">${field.label}:</p><p class="text-gray-600">${displayValue}</p></div>`;
        }
    });
    
    let suspensionsHtml = '';
    if (stats.suspensionsThisYear > 0) {
        suspensionsHtml = `<div class="bg-gray-50 p-3 rounded-md sm:col-span-2"> <p class="font-medium text-gray-700">Ulosajot (${CURRENT_YEAR}):</p> <p class="text-gray-600">${stats.suspensionsThisYear}</p> </div>`;
    }
    
    let previousSeasonStatsHtml = '';
    if (stats.gamesPlayedLastSeason > 0 || stats.goalsScoredLastSeason > 0) {
        previousSeasonStatsHtml = `
            <div class="bg-gray-50 p-3 rounded-md"><p class="font-medium text-gray-700">Ottelut (${PREVIOUS_YEAR}):</p><p class="text-gray-600">${stats.gamesPlayedLastSeason}</p></div>
            <div class="bg-gray-50 p-3 rounded-md"><p class="font-medium text-gray-700">Maalit (${PREVIOUS_YEAR}):</p><p class="text-gray-600">${stats.goalsScoredLastSeason}</p></div>
        `;
    }

    let pastMatchesHtml = '';
    if (stats.pastMatchesDetails && stats.pastMatchesDetails.length > 0) {
        pastMatchesHtml += `<div class="mt-4 pt-4 border-t border-gray-200 col-span-1 sm:col-span-2">
                                <h4 class="text-md font-semibold text-gray-700 mb-2">Pelatut ottelut tälle joukkueelle (${CURRENT_YEAR}):</h4>
                                <ul class="list-none pl-0 space-y-1">`;
        stats.pastMatchesDetails.slice(0, 10).forEach(match => { 
            let matchDisplay;
            if (match.status === "Fixture") {
                matchDisplay = `${match.date}: ${match.playerTeamNameInPastMatch} vs ${match.opponentName} (Tuleva)`;
            } else {
                let indicatorClass = '';
                if (match.resultIndicator === 'win') indicatorClass = 'win';
                else if (match.resultIndicator === 'draw') indicatorClass = 'draw';
                else if (match.resultIndicator === 'loss') indicatorClass = 'loss';
                matchDisplay = `<span class="result-indicator ${indicatorClass}"></span>
                                ${match.date}: ${match.playerTeamNameInPastMatch} vs ${match.opponentName} (${match.playerTeamScore}-${match.opponentTeamScore})`;
            }
            pastMatchesHtml += `<li class="past-match-item">${matchDisplay}</li>`;
        });
        pastMatchesHtml += `</ul></div>`;
    }

    card.innerHTML = `
        <div class="flex items-center mb-4">
            <img src="${crestUrl}" alt="${crestAltText}" class="w-10 h-10 mr-3 rounded-full object-contain" onerror="this.src='https://placehold.co/40x40/e2e8f0/64748b?text=LOGO'; this.onerror=null;">
            ${playerImageHtml}
            <div class="${playerImageHtml ? '' : 'ml-3'}">
                <h3 id="player-name-${playerIdSuffix}" class="text-xl font-semibold text-blue-700">${stats.name} (#${stats.shirtNumber})</h3>
                <p class="text-sm text-gray-500">Syntymävuosi: ${stats.birthYear}</p>
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div class="bg-gray-50 p-3 rounded-md"> <p class="font-medium text-gray-700">Joukkueet (${CURRENT_YEAR}):</p> <p class="text-gray-600">${stats.teamsThisYear || 'Ei tietoa'}</p> </div>
            <div class="bg-gray-50 p-3 rounded-md"> <p class="font-medium text-gray-700">Pelatut ottelut (${CURRENT_YEAR}):</p> <p class="text-gray-600">${gamesPlayedDisplayContent}</p> </div>
            <div class="bg-gray-50 p-3 rounded-md"> <p class="font-medium text-gray-700">Maalit (${CURRENT_YEAR}):</p> <p class="text-gray-600">${goalsDisplayContent}</p> </div>
            <div class="bg-gray-50 p-3 rounded-md"> <p class="font-medium text-gray-700">Varoitukset (${CURRENT_YEAR}):</p> <p class="text-gray-600">${stats.warningsThisYear}</p> </div>
            ${suspensionsHtml}
            ${previousSeasonStatsHtml}
        </div>
        ${additionalInfoHtml ? `<div class="mt-4 pt-4 border-t border-gray-200"><h4 class="text-md font-semibold text-gray-700 mb-2">Lisätiedot:</h4><div class="additional-info-grid">${additionalInfoHtml}</div></div>` : ''}
        ${pastMatchesHtml} 
    `;
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
 * Displays players who are in the team roster but not in the current match's lineup.
 * @async
 * @param {Object} teamApiData - The full team data object from the getTeam API call.
 * @param {Array<string>} matchLineupPlayerIds - Array of player IDs in the current match's lineup.
 * @param {string} teamDisplayName - The display name of the team.
 * @param {Object} originalMatchDetails - Details of the current match.
 */
async function displayPlayersNotInLineup(teamApiData, matchLineupPlayerIds, teamDisplayName, originalMatchDetails) {
    if (!teamApiData || !teamApiData.team || !teamApiData.team.players || teamApiData.team.players.length === 0) {
        console.warn(`No team details or players for ${teamDisplayName} to display in 'not in lineup' section.`);
        // Create a small section to indicate no other players or data issue for this team
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'mt-8 p-6 bg-gray-100 rounded-lg shadow-inner';
        const headerId = `not-in-lineup-header-${teamDisplayName.replace(/\s+/g, '-')}`;
        const header = document.createElement('h2');
        header.id = headerId;
        header.className = 'text-xl font-semibold text-gray-800 mb-4 border-b pb-2';
        header.textContent = `Muut joukkueen pelaajat (${teamDisplayName})`;
        sectionDiv.appendChild(header);
        sectionDiv.appendChild(Object.assign(document.createElement('p'), { className: 'text-gray-600', textContent: 'Ei muita listattuja pelaajia tälle joukkueelle tai tietoja ei voitu ladata.' }));
        playersNotInLineupContainer.appendChild(sectionDiv);
        return;
    }
    
    const teamDetails = teamApiData.team; 
    const playersNotInMatch = teamDetails.players.filter(player =>
        player.player_id && !matchLineupPlayerIds.includes(player.player_id.toString()) && player.inactive !== '1'
    );
    
    if (playersNotInMatch.length > 0) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'mt-8 p-6 bg-gray-100 rounded-lg shadow-inner';
        const headerId = `not-in-lineup-header-${teamDetails.team_id}`;
        const header = document.createElement('h2');
        header.id = headerId;
        header.className = 'text-xl font-semibold text-gray-800 mb-4 border-b pb-2';
        header.textContent = `Muut joukkueen pelaajat (${teamDisplayName})`;
        sectionDiv.appendChild(header);
        sectionDiv.setAttribute('aria-labelledby', headerId);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'space-y-6';
        
        playersNotInMatch.sort((a,b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || ''));

        const playerStatPromises = playersNotInMatch.map(playerFromTeam => {
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
        
        const resolvedPlayerStatsArray = await Promise.all(playerStatPromises);
        if (resolvedPlayerStatsArray.length > 0) {
            resolvedPlayerStatsArray.filter(stats => stats && !stats.hasError).forEach(stats => {
                cardsContainer.appendChild(createPlayerStatCardElement(stats));
            });
            // Myös virheelliset pelaajat voidaan näyttää yksinkertaistetulla kortilla halutessaan
            resolvedPlayerStatsArray.filter(stats => stats && stats.hasError).forEach(errorStats => {
                 cardsContainer.appendChild(createPlayerStatCardElement(errorStats));
            });
            sectionDiv.appendChild(cardsContainer);
        } else if (playersNotInMatch.length > 0 && resolvedPlayerStatsArray.length === 0) { 
            sectionDiv.appendChild(Object.assign(document.createElement('p'), { className: 'text-gray-600', textContent: 'Muiden pelaajien tilastojen haku epäonnistui.' }));
        }
        playersNotInLineupContainer.appendChild(sectionDiv);
    } else {
         const sectionDiv = document.createElement('div');
        sectionDiv.className = 'mt-8 p-6 bg-gray-100 rounded-lg shadow-inner';
        const headerId = `not-in-lineup-header-${teamDisplayName.replace(/\s+/g, '-')}`;
        const header = document.createElement('h2');
        header.id = headerId;
        header.className = 'text-xl font-semibold text-gray-800 mb-4 border-b pb-2';
        header.textContent = `Muut joukkueen pelaajat (${teamDisplayName})`;
        sectionDiv.appendChild(header);
        sectionDiv.appendChild(Object.assign(document.createElement('p'), { className: 'text-gray-600', textContent: 'Ei muita listattuja pelaajia tälle joukkueelle, jotka eivät olleet kokoonpanossa.' }));
        playersNotInLineupContainer.appendChild(sectionDiv);
    }
}


// --- MAIN APPLICATION LOGIC ---

/**
 * Main handler for the "Hae Tiedot" button click.
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

        if (competition_id && category_id && group_id) {
            groupDataForInfo = await fetchGroupInfo(competition_id, category_id, group_id);
            if (groupDataForInfo) {
                displayGroupInfoAndStandings(groupDataForInfo, team_A_id, team_B_id);
            } else if (!groupInfoContainer.querySelector('p')) { 
                displayError('Sarjataulukon tietoja ei voitu ladata tai niitä ei ole saatavilla.', 'warning');
                groupInfoContainer.classList.remove('hidden'); 
            }
        } else {
             console.warn("Otteludatasta puuttuu tarvittavat tiedot lohkon hakemiseksi (competition_id, category_id, or group_id). Sarjataulukkoa ei haeta.");
        }
        
        // Haetaan joukkueiden tiedot rinnakkain
        const teamDataPromises = [];
        if (team_A_id) teamDataPromises.push(fetchTeamData(team_A_id)); else teamDataPromises.push(Promise.resolve(null));
        if (team_B_id) teamDataPromises.push(fetchTeamData(team_B_id)); else teamDataPromises.push(Promise.resolve(null));
        
        const [teamAResponse, teamBResponse] = await Promise.all(teamDataPromises);
        teamAData = teamAResponse;
        teamBData = teamBResponse;

        if (!teamAData && team_A_id) {
            displayError(`Kotijoukkueen (ID: ${team_A_id}) pelaajalistaa ei voitu ladata.`, 'warning');
        }
        if (!teamBData && team_B_id) {
            displayError(`Vierasjoukkueen (ID: ${team_B_id}) pelaajalistaa ei voitu ladata.`, 'warning');
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
        
        playersNotInLineupContainer.innerHTML = ''; // Tyhjennetään ensin
        if (teamAData) { 
            await displayPlayersNotInLineup(teamAData, matchLineupPlayerIds, originalMatchDetails.team_A_name || 'Kotijoukkue', originalMatchDetails);
        }
        if (teamBData) {
           await displayPlayersNotInLineup(teamBData, matchLineupPlayerIds, originalMatchDetails.team_B_name || 'Vierasjoukkue', originalMatchDetails);
        }

    } catch (error) { 
        console.error('Main data fetching or processing error:', error);
        displayError(`Päävirhe tietoja haettaessa: ${error.message}`, 'error');
        // Yritä näyttää ottelutiedot silti, jos ne on haettu
        if (originalMatchDetails && !matchInfoContainer.innerHTML.includes('vs')) { 
            displayMatchInfo(originalMatchDetails, null, 0, 0); 
        }
    } finally {
        showLoading(false);
    }
}

// --- EVENT LISTENERS ---
if (fetchDataButton) {
    fetchDataButton.addEventListener('click', handleFetchData);
} else {
    console.error("fetchDataButton not found!");
}

// --- INITIALIZATION ---
// (Any setup code if needed when the script loads)
