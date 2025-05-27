// Import rate limiting utilities if in a module environment
let throttle, createRateLimiter;
if (typeof require !== 'undefined') {
    const utils = require('./utils'); //
    throttle = utils.throttle; //
    createRateLimiter = utils.createRateLimiter; //
}

// DOM Element Constants
let matchIdInput, fetchDataButton, playerStatsContainer, matchInfoContainer,
    groupInfoContainer, playersNotInLineupContainer, loadingIndicator, errorMessageContainer,
    showAdvancedStatsButton, advancedStatsContainer, teamFormGuideContainer,
    detailedH2HStatsContainer, expandedRefereeStatsContainer, playerDerivedStatsContainer,
    additionalStandingsStatsContainer;
// Team specific display elements will be selected within displayMatchInfo after HTML is populated

// Global data cache
let lastFetchedMatchDetails = null;
let lastFetchedGroupData = null;
let lastFetchedAllPlayerStats = [];
let lastFetchedTeamAMatches = null; 
let lastFetchedTeamBMatches = null; 


if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    matchIdInput = document.getElementById('matchIdInput'); //
    fetchDataButton = document.getElementById('fetchDataButton'); //
    playerStatsContainer = document.getElementById('playerStatsContainer'); //
    matchInfoContainer = document.getElementById('matchInfo'); //
    groupInfoContainer = document.getElementById('groupInfoContainer'); //
    playersNotInLineupContainer = document.getElementById('playersNotInLineupContainer'); //
    loadingIndicator = document.getElementById('loadingIndicator'); //
    errorMessageContainer = document.getElementById('errorMessage'); //

    showAdvancedStatsButton = document.getElementById('showAdvancedStatsButton');
    advancedStatsContainer = document.getElementById('advancedStatsContainer');
    teamFormGuideContainer = document.getElementById('teamFormGuide');
    detailedH2HStatsContainer = document.getElementById('detailedH2HStats');
    expandedRefereeStatsContainer = document.getElementById('expandedRefereeStats');
    playerDerivedStatsContainer = document.getElementById('playerDerivedStats');
    additionalStandingsStatsContainer = document.getElementById('additionalStandingsStats');

    // Rate limiting functions (copied from original if not in module env)
    if (typeof throttle === 'undefined') { //
        throttle = function(func, limit) { //
            let inThrottle = false; //
            let lastResult = null; //
            return function(...args) { //
                if (!inThrottle) { //
                    inThrottle = true; //
                    lastResult = func.apply(this, args); //
                    setTimeout(() => { inThrottle = false; }, limit); //
                }
                return lastResult; //
            };
        };
    }
    if (typeof createRateLimiter === 'undefined') { //
        createRateLimiter = function(maxCalls, timeWindow) { //
            const calls = []; //
            return function() { //
                const now = Date.now(); //
                while (calls.length > 0 && calls[0] < now - timeWindow) { calls.shift(); } //
                if (calls.length < maxCalls) { calls.push(now); return true; } //
                return false; //
            };
        };
    }
}

// Configuration
const config = {
    API_BASE_URL: 'https://spl.torneopal.net/taso/rest/', //
    CURRENT_YEAR: "2025", //
    PREVIOUS_YEAR: (parseInt("2025") - 1).toString(), //
    API_HEADERS: { 'Accept': 'json/df8e84j9xtdz269euy3h' }, //
    NO_PLAYER_IMAGE_URL: "https://www.palloliitto.fi/sites/all/themes/palloliitto/images/no-player-image.png", //
    DEFAULT_CREST_URL: "https://cdn.torneopal.net/logo/palloliitto/x.png", //
    PLACEHOLDER_CREST_URL: 'https://placehold.co/40x40/e2e8f0/64748b?text=LOGO', //
    RATE_LIMIT: { //
        MAX_CALLS_PER_MINUTE: 60,  //
        MAX_CALLS_PER_ENDPOINT: { //
            'getMatch': 5, //
            'getGroup': 3, //
            'getTeam': 5, //
            'getPlayer': 55, //
            'getMatches': 10 //
        },
        THROTTLE_DELAY: 1750 //
    }
};

const globalRateLimiter = typeof createRateLimiter !== 'undefined' ? createRateLimiter(config.RATE_LIMIT.MAX_CALLS_PER_MINUTE, 60000) : () => true; //
const endpointRateLimiters = {}; //
if (typeof createRateLimiter !== 'undefined') { //
    Object.keys(config.RATE_LIMIT.MAX_CALLS_PER_ENDPOINT).forEach(endpoint => { //
        endpointRateLimiters[endpoint] = createRateLimiter(config.RATE_LIMIT.MAX_CALLS_PER_ENDPOINT[endpoint], 60000); //
    });
}

async function fetchAPIData(endpoint, params = {}) { //
    const isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'; //
    if (!isTestEnvironment) { //
        if (config.RATE_LIMIT.THROTTLE_DELAY > 0) { //
            await new Promise(resolve => setTimeout(resolve, config.RATE_LIMIT.THROTTLE_DELAY)); //
        }
        if (!globalRateLimiter()) { //
            throw new Error(`Rate limit exceeded. Please try again in a moment.`); //
        }
        if (endpointRateLimiters[endpoint] && !endpointRateLimiters[endpoint]()) { //
            throw new Error(`Too many requests to ${endpoint}. Please try again in a moment.`); //
        }
    }
    const queryParams = new URLSearchParams(params).toString(); //
    const url = `${config.API_BASE_URL}${endpoint}?${queryParams}`; //
    const response = await fetch(url, { headers: config.API_HEADERS }); //
    if (!response.ok) { //
        let errorText = `API call to ${endpoint} failed. Status: ${response.status}`; //
        try { const errorData = await response.json(); if (errorData && (errorData.error || errorData.message)) errorText += ` - ${errorData.error?.message || errorData.message}`; } catch (e) {} //
        throw new Error(errorText); //
    }
    const data = await response.json(); //
    if (data.call && data.call.status !== "ok" && data.call.status !== "OK") throw new Error(`API error for ${endpoint}: ${data.call.status}`); //
    return data; //
}

async function WorkspaceTeamMatches(teamId, startDate = `${config.CURRENT_YEAR}-01-01`) {
    if (!teamId) { console.warn("Team ID is required for WorkspaceTeamMatches."); return null; }
    try {
        const params = { team_id: teamId, start_date: startDate };
        const data = await fetchAPIData('getMatches', params);
        return data.matches || null;
    } catch (error) {
        console.error(`Error fetching matches for team ID ${teamId}: ${error.message}`);
        displayError(`Joukkueen ${teamId} otteluiden haku epäonnistui: ${error.message}`);
        return null;
    }
}

function clearPreviousData() { //
    if (matchInfoContainer) matchInfoContainer.innerHTML = ''; //
    if (groupInfoContainer) { groupInfoContainer.innerHTML = ''; groupInfoContainer.classList.add('hidden'); } //
    if (playerStatsContainer) playerStatsContainer.innerHTML = ''; //
    if (playersNotInLineupContainer) playersNotInLineupContainer.innerHTML = ''; //
    if (errorMessageContainer) { errorMessageContainer.textContent = ''; errorMessageContainer.classList.add('hidden'); } //
    if (advancedStatsContainer) {
        advancedStatsContainer.classList.add('hidden');
        if (teamFormGuideContainer) teamFormGuideContainer.innerHTML = '';
        if (detailedH2HStatsContainer) detailedH2HStatsContainer.innerHTML = '';
        if (expandedRefereeStatsContainer) expandedRefereeStatsContainer.innerHTML = '';
        if (playerDerivedStatsContainer) playerDerivedStatsContainer.innerHTML = '';
        if (additionalStandingsStatsContainer) additionalStandingsStatsContainer.innerHTML = '';
    }
    if (showAdvancedStatsButton) { showAdvancedStatsButton.classList.add('hidden'); showAdvancedStatsButton.textContent = 'Näytä Lisätilastot'; }
    
    lastFetchedMatchDetails = null; //
    lastFetchedGroupData = null; //
    lastFetchedAllPlayerStats = []; //
    lastFetchedTeamAMatches = null; 
    lastFetchedTeamBMatches = null; 
}

function showLoading(isLoading) { if (loadingIndicator) loadingIndicator.classList.toggle('hidden', !isLoading); } //
function displayError(message) { if (errorMessageContainer) { errorMessageContainer.textContent = message; errorMessageContainer.classList.toggle('hidden', !message); } console.error(message); } //

async function fetchMatchDetails(matchId) { //
    try {
        const matchData = await fetchAPIData('getMatch', { match_id: matchId }); //
        if (!matchData.match) { //
            throw new Error(`Match data is invalid for match ID ${matchId}.`); //
        }
        lastFetchedMatchDetails = matchData.match; //
        return matchData.match; //
    } catch (error) {
        displayError(`Ottelun ${matchId} tietojen haku epäonnistui: ${error.message}`); //
        return null; //
    }
}
async function fetchGroupDetails(matchDetails) { //
    const { competition_id, category_id, group_id } = matchDetails; //
    if (!competition_id || !category_id || !group_id) { //
        console.warn("Match details missing competition, category, or group ID. Cannot fetch group data."); //
        return null; //
    }
    try {
        const groupData = await fetchAPIData('getGroup', { //
            competition_id, //
            category_id, //
            group_id, //
            matches: 1 //
        });
        lastFetchedGroupData = groupData.group || null; //
        return groupData.group || null; //
    } catch (error) {
        console.error(`Error fetching group details for group ID ${group_id}: ${error.message}`); //
        return null; //
    }
}
async function fetchTeamData(teamId) { //
    if (!teamId) return null; //
    try {
        return await fetchAPIData('getTeam', { team_id: teamId }); //
    } catch (error) {
        console.error(`Error fetching team data for team ID ${teamId}: ${error.message}`); //
        return null; //
    }
}
function processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext) { //
    const stats = { //
        gamesPlayedThisYear: 0, goalsThisYear: 0, warningsThisYear: 0, suspensionsThisYear: 0, //
        goalsByTeamThisYear: {}, gamesByTeamThisYear: {}, //
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [], //
        gamesPlayedLastSeason: 0, goalsScoredLastSeason: 0 //
    };

    if (!Array.isArray(matches)) return stats; //

    matches.forEach(pastMatch => { //
        const isCurrentSeason = pastMatch.season_id === currentSeasonId; //
        const isPreviousSeason = pastMatch.season_id === previousSeasonId; //

        if (isCurrentSeason) { //
            stats.gamesPlayedThisYear++; //
            const teamNameForGame = pastMatch.team_name || 'Tuntematon joukkue'; //
            stats.gamesByTeamThisYear[teamNameForGame] = (stats.gamesByTeamThisYear[teamNameForGame] || 0) + 1; //

            const playerGoals = parseInt(pastMatch.player_goals) || 0; //
            stats.goalsThisYear += playerGoals; //
            if (playerGoals > 0) { //
                stats.goalsByTeamThisYear[teamNameForGame] = (stats.goalsByTeamThisYear[teamNameForGame] || 0) + playerGoals; //
                if (teamNameForGame && teamNameForContext && teamNameForGame === teamNameForContext) { //
                    stats.goalsForThisSpecificTeamInSeason += playerGoals; //
                }
            }
            stats.warningsThisYear += parseInt(pastMatch.player_warnings) || 0; //
            stats.suspensionsThisYear += parseInt(pastMatch.player_suspensions) || 0; //

            if (pastMatch.team_name && teamNameForContext && pastMatch.team_name === teamNameForContext) { //
                let opponentName = '', playerTeamScore = '', opponentScore = '', resultIndicator = ''; //
                const playerTeamId = pastMatch.team_id; //
                let opponentTeamId = null; //

                if (playerTeamId === pastMatch.team_A_id) { //
                    opponentName = pastMatch.team_B_name; //
                    playerTeamScore = pastMatch.fs_A; //
                    opponentScore = pastMatch.fs_B; //
                    opponentTeamId = pastMatch.team_B_id; //
                } else if (playerTeamId === pastMatch.team_B_id) { //
                    opponentName = pastMatch.team_A_name; //
                    playerTeamScore = pastMatch.fs_B; //
                    const tempOpponentScore = pastMatch.fs_A; //
                    opponentScore = tempOpponentScore; //
                    opponentTeamId = pastMatch.team_A_id; //
                }

                if (pastMatch.status === "Fixture") { //
                     resultIndicator = 'fixture'; //
                } else if (pastMatch.winner_id && pastMatch.winner_id !== '-' && pastMatch.winner_id !== '0') { //
                    if (pastMatch.winner_id === playerTeamId) resultIndicator = 'win'; //
                    else if (opponentTeamId && pastMatch.winner_id === opponentTeamId) resultIndicator = 'loss'; //
                    else resultIndicator = 'draw'; //
                } else { //
                    const pScore = parseInt(playerTeamScore); //
                    const oScore = parseInt(opponentScore); //
                    if (!isNaN(pScore) && !isNaN(oScore)) { //
                         resultIndicator = pScore > oScore ? 'win' : (pScore < oScore ? 'loss' : 'draw'); //
                    } else {
                        resultIndicator = 'draw'; //
                    }
                }
                stats.pastMatchesDetails.push({ //
                    date: pastMatch.date, //
                    time: pastMatch.time, //
                    opponentName: opponentName || 'N/A', //
                    playerTeamScore, opponentScore, //
                    resultIndicator, //
                    playerTeamNameInPastMatch: pastMatch.team_name || 'N/A', //
                    status: pastMatch.status //
                });
            }
        } else if (isPreviousSeason) { //
            stats.gamesPlayedLastSeason++; //
            stats.goalsScoredLastSeason += parseInt(pastMatch.player_goals) || 0; //
        }
    });
    stats.pastMatchesDetails.sort((a, b) => { //
        const dateA = new Date(`${a.date}T${a.time || '00:00:00'}`); //
        const dateB = new Date(`${b.date}T${b.time || '00:00:00'}`); //
        return dateB - dateA; //
    });
    return stats; //
}

async function fetchAndProcessPlayerData(playerId, teamIdInMatch, fullMatchData, playerLineupInfoFromMatch) { //
    const defaultPlayerInfo = { //
        playerId: playerId, //
        name: playerLineupInfoFromMatch.player_name || `Pelaaja ${playerId}`, //
        shirtNumber: playerLineupInfoFromMatch.shirt_number || 'N/A', //
        birthYear: 'N/A', teamsThisYear: 'Ei voitu hakea', gamesPlayedThisYear: 0, //
        gamesByTeamThisYear: {}, goalsThisYear: 0, goalsByTeamThisYear: {}, //
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [], gamesPlayedLastSeason: 0, //
        goalsScoredLastSeason: 0, warningsThisYear: 0, suspensionsThisYear: 0, //
        position_fi: null, nationality: null, img_url: null, height: null, weight: null, //
        finland_raised: null, isCaptainInMatch: false, added: null, removed: null, //
        dual_representation: null, dual_1_representation: null, dual_2_representation: null, //
        overage: null, parallel_representation: null, exception_representation: null, //
        teamIdInMatch: teamIdInMatch, //
        clubCrest: teamIdInMatch === fullMatchData.team_A_id ? fullMatchData.club_A_crest : fullMatchData.club_B_crest //
    };

    if (!playerId || playerId.toString().startsWith("oma_maali")) { //
        console.warn(`Player ID puuttuu tai on "oma maali" (${playerId}), ohitetaan pelaaja.`); //
        return null; //
    }
    try {
        const playerData = await fetchAPIData('getPlayer', { player_id: playerId.toString() }); //
        if (!playerData.player) { //
            console.error(`Pelaajaa ${playerId} ei löytynyt tai data on virheellistä (API response).`); //
            return {...defaultPlayerInfo, teamsThisYear: `Ei löytynyt (API)`}; //
        }

        const playerDataFromAPI = playerData.player; //
        const playerName = playerLineupInfoFromMatch.player_name || `${playerDataFromAPI.first_name || ''} ${playerDataFromAPI.last_name || ''}`.trim(); //
        const shirtNumber = playerLineupInfoFromMatch.shirt_number || 'N/A'; //
        const teamNameForThisContext = (teamIdInMatch === fullMatchData.team_A_id) //
                                    ? fullMatchData.team_A_name //
                                    : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name : //
                                       (playerLineupInfoFromMatch && playerLineupInfoFromMatch.team_name_from_getTeam ? playerLineupInfoFromMatch.team_name_from_getTeam : null)); //

        const seasonStats = processPlayerMatchHistory(playerDataFromAPI.matches, config.CURRENT_YEAR, config.PREVIOUS_YEAR, teamNameForThisContext); //

        let teamsThisYear = []; //
        if (playerDataFromAPI.teams && Array.isArray(playerDataFromAPI.teams)) { //
             playerDataFromAPI.teams.forEach(teamEntry => { //
                if (teamEntry.primary_category && //
                    ( (teamEntry.primary_category.competition_id && teamEntry.primary_category.competition_id.toLowerCase().includes(config.CURRENT_YEAR.substring(2))) || //
                      (teamEntry.primary_category.competition_name && teamEntry.primary_category.competition_name.includes(config.CURRENT_YEAR)) )) { //
                    teamsThisYear.push(`${teamEntry.team_name} (${teamEntry.primary_category.category_name || 'Sarja tuntematon'})`); //
                }
             });
        }
         if (teamsThisYear.length === 0 && playerDataFromAPI.club_name) { //
            teamsThisYear.push(`${playerDataFromAPI.club_name} (Joukkueen tarkka sarja ${config.CURRENT_YEAR} ei tiedossa)`); //
        }
        if (teamsThisYear.length === 0) { //
            teamsThisYear.push("Ei joukkueita tiedossa tälle vuodelle."); //
        }

        return { //
            ...defaultPlayerInfo, //
            name: playerName, shirtNumber: shirtNumber, birthYear: playerDataFromAPI.birthyear || 'N/A', //
            ...seasonStats, //
            teamsThisYear: teamsThisYear.join('<br>'), //
            position_fi: playerDataFromAPI.position_fi, nationality: playerDataFromAPI.nationality, //
            img_url: playerDataFromAPI.img_url, height: playerDataFromAPI.height, weight: playerDataFromAPI.weight, //
            finland_raised: playerDataFromAPI.finland_raised, //
            isCaptainInMatch: playerLineupInfoFromMatch.captain === "1" || playerLineupInfoFromMatch.captain === "C", //
            added: playerDataFromAPI.added, removed: playerDataFromAPI.removed, //
            dual_representation: playerDataFromAPI.dual_representation, //
            dual_1_representation: playerDataFromAPI.dual_1_representation, //
            dual_2_representation: playerDataFromAPI.dual_2_representation, //
            overage: playerDataFromAPI.overage, //
            parallel_representation: playerDataFromAPI.parallel_representation, //
            exception_representation: playerDataFromAPI.exception_representation, //
        };
    } catch (error) { 
        console.error(`Virhe pelaajan ${playerId} tietojen käsittelyssä (${error.message}):`, error); //
         return {...defaultPlayerInfo, teamsThisYear: `Virhe haussa pelaajalle ${playerId}`}; //
    }
}

function createStatItemHtml(label, value, containerClasses = "bg-gray-50 p-3 rounded-md") { /* ... unchanged ... */ } //
function createPlayerStatCardElement(stats) { /* ... unchanged ... */ } //

function displayTeamGames(allTeamMatches, container, currentMatchId, perspectiveTeamId) {
    if (!allTeamMatches || allTeamMatches.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Ei otteluhistoriaa.</p>';
        return; 
    }

    const sortedMatches = [...allTeamMatches].sort((a, b) => new Date(`${a.date}T${a.time || '00:00:00'}`) - new Date(`${b.date}T${b.time || '00:00:00'}`));
    const currentMatchIndex = sortedMatches.findIndex(m => m.match_id === currentMatchId);
    let gamesToShow = [];

    if (currentMatchIndex !== -1) {
        const previousPlayed = sortedMatches.slice(0, currentMatchIndex).filter(m => m.status === "Played").slice(-2);
        const nextFixtures = sortedMatches.slice(currentMatchIndex + 1).filter(m => m.status === "Fixture" || m.status === "Postponed").slice(0, 2);
        gamesToShow = [...previousPlayed, ...nextFixtures];
    } else {
        const now = new Date();
        const played = sortedMatches.filter(m => m.status === "Played" && new Date(`${m.date}T${m.time || '23:59:59'}`) < now).slice(-2);
        const fixtures = sortedMatches.filter(m => (m.status === "Fixture" || m.status === "Postponed") && new Date(`${m.date}T${m.time || '00:00:00'}`) >= now).slice(0, 2);
        gamesToShow = [...played, ...fixtures];
    }
    gamesToShow.sort((a, b) => new Date(`${a.date}T${a.time || '00:00:00'}`) - new Date(`${b.date}T${b.time || '00:00:00'}`));

    if (gamesToShow.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Ei ed./seuraavia otteluita.</p>';
        return;
    }

    let listHtml = '<ul class="list-none pl-0 space-y-px">';
    gamesToShow.forEach(match => {
        let opponentName = '', teamScore = '-', opponentScore = '-', resultIndicator = match.status === "Fixture" ? 'fixture' : (match.status === "Postponed" ? 'postponed' : 'draw');
        if (match.team_A_id === perspectiveTeamId) { opponentName = match.team_B_name || 'N/A'; teamScore = match.fs_A; opponentScore = match.fs_B; }
        else if (match.team_B_id === perspectiveTeamId) { opponentName = match.team_A_name || 'N/A'; teamScore = match.fs_B; opponentScore = match.fs_A; }
        else { opponentName = `${match.team_A_name} vs ${match.team_B_name}`; }

        if (match.status === "Played") {
            if (match.winner_id && match.winner_id !== '-' && match.winner_id !== '0') {
                if (match.winner_id === perspectiveTeamId) resultIndicator = 'win';
                else if (match.winner_id === (match.team_A_id === perspectiveTeamId ? match.team_B_id : match.team_A_id) ) resultIndicator = 'loss';
                else resultIndicator = 'draw';
            } else {
                const pScore = parseInt(teamScore); const oScore = parseInt(opponentScore);
                if (!isNaN(pScore) && !isNaN(oScore)) resultIndicator = pScore > oScore ? 'win' : (pScore < oScore ? 'loss' : 'draw'); else resultIndicator = 'draw';
            }
        }
        const scoreDisplay = match.status === "Played" ? `(${teamScore === undefined ? '-' : teamScore}-${opponentScore === undefined ? '-' : opponentScore})` : (match.status === "Postponed" ? '(Siirretty)' : '(Tuleva)');
        listHtml += `<li class="team-game-item"><span class="result-indicator ${resultIndicator}"></span>${match.date} vs ${opponentName} ${scoreDisplay}</li>`;
    });
    listHtml += '</ul>';
    container.innerHTML = listHtml;
}

function displayMatchInfo(match, groupDataForMatchInfo, lineupGoalsA = 0, lineupGoalsB = 0, container) {
    const teamANameEl = container.querySelector('#teamANameDisplay');
    const teamBNameEl = container.querySelector('#teamBNameDisplay');
    const showTeamAGamesBtn = container.querySelector('#showTeamAGamesButton');
    const showTeamBGamesBtn = container.querySelector('#showTeamBGamesButton');
    const teamAGamesDisp = container.querySelector('#teamAGamesDisplay');
    const teamBGamesDisp = container.querySelector('#teamBGamesDisplay');
    const matchCenterDetailsEl = container.querySelector('#matchCenterDetails');

    const teamAName = match.team_A_name || 'Kotijoukkue';
    const teamBName = match.team_B_name || 'Vierasjoukkue';

    if (teamANameEl) { teamANameEl.textContent = teamAName; teamANameEl.title = teamAName; }
    if (teamBNameEl) { teamBNameEl.textContent = teamBName; teamBNameEl.title = teamBName; }

    if (showTeamAGamesBtn && teamAGamesDisp) {
        showTeamAGamesBtn.dataset.teamid = match.team_A_id;
        if (lastFetchedTeamAMatches && lastFetchedTeamAMatches.length > 0) { // Only show button if there's data to show
            showTeamAGamesBtn.classList.remove('hidden');
             // Clone and replace to remove old listeners if any
            const newBtnA = showTeamAGamesBtn.cloneNode(true);
            showTeamAGamesBtn.parentNode.replaceChild(newBtnA, showTeamAGamesBtn);
            newBtnA.addEventListener('click', () => {
                displayTeamGames(lastFetchedTeamAMatches, teamAGamesDisp, match.match_id, match.team_A_id);
                teamAGamesDisp.classList.toggle('hidden');
                newBtnA.textContent = teamAGamesDisp.classList.contains('hidden') ? '+/-' : 'Piilota';
            });
        } else {
            showTeamAGamesBtn.classList.add('hidden');
            teamAGamesDisp.classList.add('hidden'); // Ensure display is hidden
        }
    }

    if (showTeamBGamesBtn && teamBGamesDisp) {
        showTeamBGamesBtn.dataset.teamid = match.team_B_id;
         if (lastFetchedTeamBMatches && lastFetchedTeamBMatches.length > 0) {
            showTeamBGamesBtn.classList.remove('hidden');
            const newBtnB = showTeamBGamesBtn.cloneNode(true);
            showTeamBGamesBtn.parentNode.replaceChild(newBtnB, showTeamBGamesBtn);
            newBtnB.addEventListener('click', () => {
                displayTeamGames(lastFetchedTeamBMatches, teamBGamesDisp, match.match_id, match.team_B_id);
                teamBGamesDisp.classList.toggle('hidden');
                newBtnB.textContent = teamBGamesDisp.classList.contains('hidden') ? '+/-' : 'Piilota';
            });
        } else {
            showTeamBGamesBtn.classList.add('hidden');
            teamBGamesDisp.classList.add('hidden');
        }
    }
    
    if (matchCenterDetailsEl) {
        matchCenterDetailsEl.innerHTML = ''; 

        const scoreA = match.fs_A !== undefined ? match.fs_A : '-';
        const scoreB = match.fs_B !== undefined ? match.fs_B : '-';
        const scoreEl = document.createElement('p');
        scoreEl.className = 'text-3xl font-bold text-gray-800 mb-3';
        scoreEl.textContent = `${scoreA} - ${scoreB}`;
        matchCenterDetailsEl.appendChild(scoreEl);

        let teamAStatsInGroup = null, teamBStatsInGroup = null;
        if (groupDataForMatchInfo && groupDataForMatchInfo.teams) {
            teamAStatsInGroup = groupDataForMatchInfo.teams.find(t => t.team_id === match.team_A_id);
            teamBStatsInGroup = groupDataForMatchInfo.teams.find(t => t.team_id === match.team_B_id);
        }

        let goalComparisonHtml = ''; //
        if (teamAStatsInGroup || teamBStatsInGroup || lineupGoalsA > 0 || lineupGoalsB > 0 || (match.lineups && match.lineups.length > 0)) { //
            goalComparisonHtml = `
            <div class="my-3 text-center">
                <p class="text-gray-700 font-semibold text-sm mb-2">Maalivertailu (${config.CURRENT_YEAR}):</p>
                <div class="grid grid-cols-2 gap-x-2 text-xs">
                    <div class="font-medium text-gray-800">${teamAName}</div><div class="font-medium text-gray-800">${teamBName}</div>
                    <div class="text-gray-600">Lohkossa (TM-PM):</div><div class="text-gray-600">Lohkossa (TM-PM):</div>
                    <div class="font-semibold text-gray-700">${teamAStatsInGroup ? `${(teamAStatsInGroup.goals_for || 0)}-${(teamAStatsInGroup.goals_against || 0)}` : 'N/A'}</div>
                    <div class="font-semibold text-gray-700">${teamBStatsInGroup ? `${(teamBStatsInGroup.goals_for || 0)}-${(teamBStatsInGroup.goals_against || 0)}` : 'N/A'}</div>
                    <div class="text-gray-600 mt-1">Kokoonpanon maalit:</div><div class="text-gray-600 mt-1">Kokoonpanon maalit:</div>
                    <div class="font-semibold text-gray-700">${lineupGoalsA}</div><div class="font-semibold text-gray-700">${lineupGoalsB}</div>
                </div>
            </div>`;
        } //

        let headToHeadHtml = ''; //
        if (groupDataForMatchInfo && groupDataForMatchInfo.matches) { //
            const prevEnc = groupDataForMatchInfo.matches.filter(m => m.match_id !== match.match_id && ((m.team_A_id === match.team_A_id && m.team_B_id === match.team_B_id) || (m.team_A_id === match.team_B_id && m.team_B_id === match.team_A_id)) && m.status === "Played").sort((a,b) => new Date(`${b.date}T${b.time||'00:00:00'}`) - new Date(`${a.date}T${a.time||'00:00:00'}`)).slice(0,3); //
            if (prevEnc.length > 0) { //
                headToHeadHtml = `<div class="mt-3 pt-3 border-t border-gray-200"><h4 class="text-xs font-semibold text-gray-700 mb-1 text-center">Viimeiset keskinäiset (lohko):</h4><ul class="head-to-head-list text-center text-xs">`; //
                prevEnc.forEach(e => { headToHeadHtml += `<li>${e.date}: ${e.team_A_name} ${e.fs_A!==undefined?e.fs_A:'-'} - ${e.fs_B!==undefined?e.fs_B:'-'} ${e.team_B_name}</li>`; }); //
                headToHeadHtml += `</ul></div>`; //
            }
        }
        
        let refereeInfoHtml = match.referee_1_name ? `<p class="text-xs text-gray-600 text-center mt-2">Erotuomari: ${match.referee_1_name}</p>` : ''; //
        
        const detailsDiv = document.createElement('div');
        detailsDiv.innerHTML = `
            ${goalComparisonHtml}
            ${headToHeadHtml}
            ${refereeInfoHtml}
            <p class="text-xs text-gray-500 text-center mt-2">Pvm: ${match.date || 'N/A'}</p>
            <p class="text-xs text-gray-500 text-center">Sarja: ${match.category_name || 'N/A'} (${match.competition_name || 'N/A'})</p>
        `;
        matchCenterDetailsEl.appendChild(detailsDiv);
    }
}

function displayGroupInfoAndStandings(group, currentMatchTeamAId, currentMatchTeamBId, container) { /* ... unchanged, uses groupData ... */ } //

async function processAndDisplayPlayerStats(playersInMatch, matchDetails, groupDataForInfo, container) { //
    const teamAName = matchDetails.team_A_name || 'Kotijoukkue'; //
    const teamBName = matchDetails.team_B_name || 'Vierasjoukkue'; //

    let freshPlayerStatsList = []; //

    if (!playersInMatch || playersInMatch.length === 0) { //
        if (container) container.innerHTML = '<p class="text-gray-700 text-center">Ottelulle ei löytynyt pelaajatietoja kokoonpanosta.</p>'; //
        // Call displayMatchInfo with 0 goals, as no players to sum from
        displayMatchInfo(matchDetails, groupDataForInfo, 0, 0, matchInfoContainer); //
        return { lineupPlayerIds: [], teamAName, teamBName }; //
    }

    const playerPromises = playersInMatch.map(playerLineupInfo => //
        fetchAndProcessPlayerData(playerLineupInfo.player_id, playerLineupInfo.team_id, matchDetails, playerLineupInfo) //
    );

    freshPlayerStatsList = (await Promise.all(playerPromises)).filter(stats => stats !== null); //
    lastFetchedAllPlayerStats = [...freshPlayerStatsList]; //


    let totalLineupGoalsTeamA = 0; //
    let totalLineupGoalsTeamB = 0; //

    freshPlayerStatsList.forEach(player => { //
        if (player.teamIdInMatch === matchDetails.team_A_id) { //
            totalLineupGoalsTeamA += (player.goalsForThisSpecificTeamInSeason || 0); //
        } else if (player.teamIdInMatch === matchDetails.team_B_id) { //
            totalLineupGoalsTeamB += (player.goalsForThisSpecificTeamInSeason || 0); //
        }
    });

    displayMatchInfo(matchDetails, groupDataForInfo, totalLineupGoalsTeamA, totalLineupGoalsTeamB, matchInfoContainer); //

    freshPlayerStatsList.sort((a, b) => { //
        const getTeamSortOrder = (teamId) => (teamId === matchDetails.team_A_id ? 1 : (teamId === matchDetails.team_B_id ? 2 : 3)); //
        const teamOrderA = getTeamSortOrder(a.teamIdInMatch); //
        const teamOrderB = getTeamSortOrder(b.teamIdInMatch); //
        if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB; //
        const numA = parseInt(a.shirtNumber); //
        const numB = parseInt(b.shirtNumber); //
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB; //
        if (!isNaN(numA)) return -1; //
        if (!isNaN(numB)) return 1; //
        return (a.name || '').localeCompare(b.name || ''); //
    });

    if (container) { //
        if (freshPlayerStatsList.length === 0) { //
            container.innerHTML = '<p class="text-gray-700 text-center">Pelaajien tilastojen haku epäonnistui kaikille kokoonpanon pelaajille.</p>'; //
        } else {
            container.innerHTML = ''; //
            let currentTeamIdDisplayed = null; //
            freshPlayerStatsList.forEach(playerFullStats => { //
                if (playerFullStats.teamIdInMatch !== currentTeamIdDisplayed) { //
                    currentTeamIdDisplayed = playerFullStats.teamIdInMatch; //
                    const teamHeader = document.createElement('h2'); //
                    teamHeader.className = 'text-2xl font-semibold text-gray-700 mt-8 mb-4 pt-4 border-t border-gray-200'; //
                    teamHeader.textContent = currentTeamIdDisplayed === matchDetails.team_A_id ? teamAName : (currentTeamIdDisplayed === matchDetails.team_B_id ? teamBName : `Joukkue ID: ${currentTeamIdDisplayed}`); //
                    container.appendChild(teamHeader); //
                }
                displayPlayerStats(playerFullStats, container); //
            });
        }
    }
    return { //
        lineupPlayerIds: playersInMatch.map(p => p.player_id.toString()), //
        teamAName, //
        teamBName //
    };
}

function displayPlayerStats(stats, container) { /* ... unchanged ... */ } //
async function displayPlayersNotInLineup(teamDetails, matchLineupPlayerIds, teamDisplayName, teamType, originalMatchDetails, container) { /* ... unchanged ... */ } //
function displayPlayerDerivedStats(allPlayerStats, container) { /* ... unchanged ... */ }

function displayDetailedH2HStats(matchDetails, teamAMatches, teamBMatches, container) {
    container.innerHTML = '';
    if (!matchDetails || (!teamAMatches && !teamBMatches)) {
        container.innerHTML = '<p class="text-gray-600">H2H-tilastojen laskemiseen tarvittavaa joukkuedataa ei löytynyt.</p>';
        return;
    }

    const teamAId = matchDetails.team_A_id;
    const teamBId = matchDetails.team_B_id;
    const teamAName = matchDetails.team_A_name || 'Joukkue A';
    const teamBName = matchDetails.team_B_name || 'Joukkue B';
    const currentMatchId = matchDetails.match_id;

    const allRelevantMatches = [];
    if (teamAMatches) allRelevantMatches.push(...teamAMatches);
    if (teamBMatches) {
        teamBMatches.forEach(matchB => {
            if (!allRelevantMatches.some(matchA => matchA.match_id === matchB.match_id)) {
                allRelevantMatches.push(matchB);
            }
        });
    }
    
    const h2hMatches = allRelevantMatches.filter(m =>
        m.match_id !== currentMatchId &&
        m.status === "Played" &&
        ((m.team_A_id === teamAId && m.team_B_id === teamBId) || (m.team_A_id === teamBId && m.team_B_id === teamAId))
    ).sort((a, b) => new Date(`${b.date}T${b.time || '00:00:00'}`) - new Date(`${a.date}T${a.time || '00:00:00'}`));
    
    const uniqueH2HMatches = h2hMatches.filter((match, index, self) =>
        index === self.findIndex((t) => (t.match_id === match.match_id))
    );

    if (uniqueH2HMatches.length === 0) {
        container.innerHTML = `<p class="text-gray-600">Ei aiempia keskinäisiä kohtaamisia (${teamAName} vs ${teamBName}) löydettyjen otteluiden perusteella.</p>`;
        return;
    }

    let teamAWins = 0;
    let teamBWins = 0;
    let draws = 0;
    let teamAGoalsH2H = 0;
    let teamBGoalsH2H = 0;

    uniqueH2HMatches.forEach(m => {
        let scoreTeamAThisMatch, scoreTeamBThisMatch;
        if (m.team_A_id === teamAId) {
            scoreTeamAThisMatch = parseInt(m.fs_A) || 0;
            scoreTeamBThisMatch = parseInt(m.fs_B) || 0;
        } else { 
            scoreTeamAThisMatch = parseInt(m.fs_B) || 0;
            scoreTeamBThisMatch = parseInt(m.fs_A) || 0;
        }
        teamAGoalsH2H += scoreTeamAThisMatch;
        teamBGoalsH2H += scoreTeamBThisMatch;
        if (scoreTeamAThisMatch > scoreTeamBThisMatch) teamAWins++;
        else if (scoreTeamBThisMatch > scoreTeamAThisMatch) teamBWins++;
        else draws++;
    });

    const totalH2HGames = uniqueH2HMatches.length;
    const avgGoalsPerH2H = totalH2HGames > 0 ? ((teamAGoalsH2H + teamBGoalsH2H) / totalH2HGames).toFixed(2) : 'N/A';

    let statsHtml = `
        <div class="text-sm">
        <p><strong>${teamAName} vs ${teamBName} (Kaikki löydetyt keskinäiset):</strong></p>
        <p>Otteluita: ${totalH2HGames}</p>
        <p>${teamAName} voitot: ${teamAWins}</p>
        <p>${teamBName} voitot: ${teamBWins}</p>
        <p>Tasapelit: ${draws}</p>
        <p>Maalit: ${teamAName} ${teamAGoalsH2H} - ${teamBGoalsH2H} ${teamBName}</p>
        <p>Keskim. maalit/ottelu: ${avgGoalsPerH2H}</p>
        <h5 class="font-semibold mt-3 mb-1">Viimeisimmät kohtaamiset (max 5):</h5>
        <ul class="list-disc pl-5">
    `;
    uniqueH2HMatches.slice(0, 5).forEach(m => {
        statsHtml += `<li>${m.date}: ${m.team_A_name} ${m.fs_A !== undefined ? m.fs_A : '-'} - ${m.fs_B !== undefined ? m.fs_B : '-'} ${m.team_B_name}</li>`;
    });
    statsHtml += `</ul></div>`;
    container.innerHTML = statsHtml;
}

function displayExpandedRefereeStats(matchDetails, teamAMatches, teamBMatches, container) {
    container.innerHTML = '';
    const currentRefereeId = matchDetails.referee_1_id;
    const currentRefereeName = matchDetails.referee_1_name;

    if (!currentRefereeId || !currentRefereeName) {
        container.innerHTML = '<p class="text-gray-600">Ottelun erotuomaritietoja ei saatavilla.</p>';
        return;
    }
    if ((!teamAMatches || teamAMatches.length === 0) && (!teamBMatches || teamBMatches.length === 0)) {
         container.innerHTML = `<p class="text-gray-600">Erotuomarin ${currentRefereeName} aiempien otteluiden tietoja ei voitu hakea.</p>`;
        return;
    }

    let htmlContent = `<div class="text-sm"><p class="font-semibold">Erotuomari: ${currentRefereeName}</p>`;
    const getRefereeGamesForTeamHtml = (allTeamMatchesForPerspective, targetTeamId, targetTeamName) => {
        if (!allTeamMatchesForPerspective) return `<p class="text-xs mt-2">Ei otteluhistoriaa joukkueelle ${targetTeamName}.</p>`;
        const games = allTeamMatchesForPerspective
            .filter(m => m.referee_1_id === currentRefereeId && (m.team_A_id === targetTeamId || m.team_B_id === targetTeamId) && m.status === "Played" && m.match_id !== matchDetails.match_id)
            .sort((a, b) => new Date(`${b.date}T${b.time || '00:00:00'}`) - new Date(`${a.date}T${a.time || '00:00:00'}`))
            .slice(0, 5);
        if (games.length === 0) return `<p class="text-xs mt-2">Ei aiempia ${targetTeamName}-otteluita tällä erotuomarilla.</p>`;
        let listHtml = `<h5 class="text-md font-semibold mt-3 mb-1">Aiemmat ottelut joukkueelle ${targetTeamName} (max 5):</h5><ul class="list-disc pl-5 text-xs">`;
        games.forEach(pastGame => {
            let opponentName, ownTeamScore, opponentTeamScore, resultIndicatorClass;
            if (pastGame.team_A_id === targetTeamId) { opponentName = pastGame.team_B_name; ownTeamScore = pastGame.fs_A; opponentTeamScore = pastGame.fs_B; }
            else { opponentName = pastGame.team_A_name; ownTeamScore = pastGame.fs_B; opponentTeamScore = pastGame.fs_A; }
            const pScore = parseInt(ownTeamScore); const oScore = parseInt(opponentTeamScore);
            if (pastGame.winner_id && pastGame.winner_id !== '-' && pastGame.winner_id !== '0') {
                 if (pastGame.winner_id === targetTeamId) resultIndicatorClass = 'win';
                 else if (pastGame.winner_id === (pastGame.team_A_id === targetTeamId ? pastGame.team_B_id : pastGame.team_A_id)) resultIndicatorClass = 'loss';
                 else resultIndicatorClass = 'draw';
            } else { if (!isNaN(pScore) && !isNaN(oScore)) resultIndicatorClass = pScore > oScore ? 'win' : (pScore < oScore ? 'loss' : 'draw'); else resultIndicatorClass = 'draw';}
            listHtml += `<li><span class="result-indicator ${resultIndicatorClass}"></span> ${pastGame.date}: vs ${opponentName || 'N/A'} (${ownTeamScore !== undefined ? ownTeamScore : '-'}-${opponentTeamScore !== undefined ? opponentTeamScore : '-'})</li>`;
        });
        listHtml += `</ul>`;
        return listHtml;
    };
    htmlContent += getRefereeGamesForTeamHtml(lastFetchedTeamAMatches, matchDetails.team_A_id, matchDetails.team_A_name || 'Kotijoukkue');
    htmlContent += getRefereeGamesForTeamHtml(lastFetchedTeamBMatches, matchDetails.team_B_id, matchDetails.team_B_name || 'Vierasjoukkue');
    htmlContent += `</div>`;
    container.innerHTML = htmlContent;
}

function displayAdditionalStandingsStats(groupData, container) { /* ... unchanged ... */ } //
async function displayTeamFormGuides(matchDetails, teamAMatches, teamBMatches, container) { /* ... unchanged ... */ } //

async function loadMatchData() { //
    const matchId = matchIdInput.value.trim(); //
    if (!matchId) { displayError("Syötä ottelun ID."); return; } //

    clearPreviousData(); //
    showLoading(true); //
    displayError(""); //

    try {
        lastFetchedMatchDetails = await fetchMatchDetails(matchId); //
        if (!lastFetchedMatchDetails) return; //

        lastFetchedGroupData = await fetchGroupDetails(lastFetchedMatchDetails); //
        if (lastFetchedGroupData) { //
            displayGroupInfoAndStandings(lastFetchedGroupData, lastFetchedMatchDetails.team_A_id, lastFetchedMatchDetails.team_B_id, groupInfoContainer); //
        }
        // Team A/B matches are fetched on demand for advanced stats

        const [teamAData, teamBData] = await Promise.all([ //
            fetchTeamData(lastFetchedMatchDetails.team_A_id), //
            fetchTeamData(lastFetchedMatchDetails.team_B_id) //
        ]);

        const { lineupPlayerIds, teamAName, teamBName } = await processAndDisplayPlayerStats( //
            lastFetchedMatchDetails.lineups, //
            lastFetchedMatchDetails, //
            lastFetchedGroupData, //
            playerStatsContainer //
        );

        if (teamAData && teamAData.team) { //
            await displayPlayersNotInLineup(teamAData.team, lineupPlayerIds, teamAName, 'A', lastFetchedMatchDetails, playersNotInLineupContainer); //
        }
        if (teamBData && teamBData.team) { //
            await displayPlayersNotInLineup(teamBData.team, lineupPlayerIds, teamBName, 'B', lastFetchedMatchDetails, playersNotInLineupContainer); //
        }
        lastFetchedAllPlayerStats.sort((a, b) => (a.name || '').localeCompare(b.name || '')); //


        if (showAdvancedStatsButton) { //
            showAdvancedStatsButton.classList.remove('hidden'); //
        }

    } catch (error) { //
        console.error("Käsittelemätön virhe pääfunktiossa loadMatchData:", error); //
        displayError(`Odottamaton virhe: ${error.message}. Tarkista konsoli.`); //
    } finally {
        showLoading(false); //
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') { //
    if (fetchDataButton) { //
        fetchDataButton.addEventListener('click', loadMatchData); //
    }

    if (showAdvancedStatsButton) {
        showAdvancedStatsButton.addEventListener('click', async () => {
            if (!lastFetchedMatchDetails) {
                displayError("Lataa ensin ottelun perustiedot ennen lisätilastojen näyttämistä.");
                return;
            }

            const isHidden = advancedStatsContainer.classList.contains('hidden');
            if (isHidden) {
                showLoading(true);
                displayError("");
                showAdvancedStatsButton.textContent = 'Piilota Lisätilastot';

                try {
                    if (!lastFetchedTeamAMatches && lastFetchedMatchDetails.team_A_id) {
                        console.log("Fetching team A matches for advanced stats...");
                        lastFetchedTeamAMatches = await WorkspaceTeamMatches(lastFetchedMatchDetails.team_A_id);
                    }
                    if (!lastFetchedTeamBMatches && lastFetchedMatchDetails.team_B_id) {
                        console.log("Fetching team B matches for advanced stats...");
                        lastFetchedTeamBMatches = await WorkspaceTeamMatches(lastFetchedMatchDetails.team_B_id);
                    }
                    
                    await displayTeamFormGuides(lastFetchedMatchDetails, lastFetchedTeamAMatches, lastFetchedTeamBMatches, teamFormGuideContainer);
                    displayDetailedH2HStats(lastFetchedMatchDetails, lastFetchedTeamAMatches, lastFetchedTeamBMatches, detailedH2HStatsContainer);
                    displayExpandedRefereeStats(lastFetchedMatchDetails, lastFetchedTeamAMatches, lastFetchedTeamBMatches, expandedRefereeStatsContainer);
                    displayPlayerDerivedStats(lastFetchedAllPlayerStats, playerDerivedStatsContainer);
                    displayAdditionalStandingsStats(lastFetchedGroupData, additionalStandingsStatsContainer);

                    advancedStatsContainer.classList.remove('hidden');
                } catch (advError) {
                    console.error("Virhe lisätilastojen näyttämisessä:", advError);
                    displayError(`Virhe lisätilastojen näyttämisessä: ${advError.message}`);
                    showAdvancedStatsButton.textContent = 'Näytä Lisätilastot';
                } finally {
                    showLoading(false);
                }
            } else {
                advancedStatsContainer.classList.add('hidden');
                showAdvancedStatsButton.textContent = 'Näytä Lisätilastot';
            }
        });
    }
}

if (typeof module !== 'undefined' && module.exports) { //
    module.exports = { //
        processPlayerMatchHistory, //
        config, //
        WorkspaceTeamMatches,
        displayTeamGames,
        displayPlayerDerivedStats,
        displayDetailedH2HStats, 
        displayExpandedRefereeStats, 
        displayAdditionalStandingsStats,
        displayTeamFormGuides,
        fetchAPIData, 
        fetchMatchDetails,
        fetchGroupDetails,
        fetchTeamData,
        fetchAndProcessPlayerData
    };
}
