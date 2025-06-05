// js/uiManager.js

import { config } from './config.js'; //
import { createStatItemHtml } from './utils.js'; //
// fetchAndProcessPlayerData ei ole suoraan käytössä createPlayerStatCardElement-funktiossa,
// mutta se on exportattu dataProcessorista ja mahdollisesti muiden uiManagerin funktioiden käytössä (kuten processAndDisplayPlayerStats).
import { fetchAndProcessPlayerData } from './dataProcessor.js'; //


// Note on DOM Element Constants:
// The functions moved into this module (e.g., displayMatchInfo, displayGroupInfoAndStandings,
// processAndDisplayPlayerStats) currently rely on global DOM element variables
// defined in script.js (e.g., matchInfoContainer, groupInfoContainer, playerStatsContainer,
// playersNotInLineupContainer). These dependencies will be addressed in a subsequent refactoring step.


/**
 * Creates the HTML element for a player statistics card.
 * @param {Object} stats - The player's statistics object.
 * @returns {HTMLElement} - The card element.
 */
function createPlayerStatCardElement(stats) {
    const card = document.createElement('div');
    card.className = 'stat-card bg-white border border-gray-200 p-5 rounded-lg shadow-lg hover:shadow-xl'; //

    const playerImageHtml = (stats.img_url && stats.img_url !== config.NO_PLAYER_IMAGE_URL) //
        ? `<img src="${stats.img_url}" alt="Pelaajan kuva" class="player-image" onerror="this.style.display='none';">` //
        : '';

    const crestUrl = (stats.clubCrest && stats.clubCrest !== config.DEFAULT_CREST_URL) //
        ? stats.clubCrest
        : config.PLACEHOLDER_CREST_URL; //

    // UUSI: Logiikka goalsDisplayContentille ja gamesPlayedDisplayContentille
    let goalsDisplayContent;
    const goalsBreakdownKeys = stats.goalsByTeamThisYear ? Object.keys(stats.goalsByTeamThisYear) : []; //
    if (stats.goalsThisYear > 0 && goalsBreakdownKeys.length > 0) { //
        goalsDisplayContent = Object.entries(stats.goalsByTeamThisYear) //
            .map(([displayKey, teamGoals]) => `${displayKey}: ${teamGoals}`) //
            .join('<br>'); //
        if (goalsBreakdownKeys.length > 1) { // Lisää "Yhteensä" vain jos useampi rivi erittelyssä //
             goalsDisplayContent += `<br><b>Yhteensä: ${stats.goalsThisYear}</b>`; //
        }
    } else {
        goalsDisplayContent = stats.goalsThisYear.toString(); // Oletusarvo, jos ei maaleja tai erittelyä //
    }

    let gamesPlayedDisplayContent;
    const gamesBreakdownKeys = stats.gamesByTeamThisYear ? Object.keys(stats.gamesByTeamThisYear) : []; //
    if (stats.gamesPlayedThisYear > 0 && gamesBreakdownKeys.length > 0) { //
        gamesPlayedDisplayContent = Object.entries(stats.gamesByTeamThisYear) //
            .map(([displayKey, teamGames]) => `${displayKey}: ${teamGames}`) //
            .join('<br>'); //
        if (gamesBreakdownKeys.length > 1) { // Lisää "Yhteensä" vain jos useampi rivi erittelyssä //
             gamesPlayedDisplayContent += `<br><b>Yhteensä: ${stats.gamesPlayedThisYear}</b>`; //
        }
    } else {
        gamesPlayedDisplayContent = stats.gamesPlayedThisYear.toString(); // Oletusarvo, jos ei pelejä tai erittelyä //
    }

    let additionalInfoHtmlSegments = [];
    const fieldsToShow = [ //
        { key: 'position_fi', label: 'Pelipaikka' }, { key: 'height', label: 'Pituus', suffix: ' cm' }, //
        { key: 'weight', label: 'Paino', suffix: ' kg' }, { key: 'finland_raised', label: 'Suomessa kasvanut', displayValue: 'Kyllä' }, //
        { key: 'added', label: 'Lisätty joukkueeseen' }, { key: 'removed', label: 'Poistettu joukkueesta' }, //
        { key: 'dual_representation', label: 'Kaksoisedustus' }, { key: 'dual_1_representation', label: 'Kaksoisedustus (1)' }, //
        { key: 'dual_2_representation', label: 'Kaksoisedustus (2)' }, { key: 'overage', label: 'Yli-ikäisyys' }, //
        { key: 'parallel_representation', label: 'Rinnakkaisedustus' }, { key: 'exception_representation', label: 'Poikkeuslupa' } //
    ];
    if (stats.isCaptainInMatch) { //
        fieldsToShow.splice(4, 0, { key: 'isCaptainInMatch', label: 'Kapteeni tässä ottelussa', displayValue: 'Kyllä' }); //
    }

    fieldsToShow.forEach(field => { //
        let value = stats[field.key]; //
        let displayValue = value; //
        if (field.displayValue) { //
            if (value === true || String(value) === "1") displayValue = field.displayValue; //
            else return; //
        }
        if (field.suffix && String(value) !== '0' && value) { //
             displayValue += field.suffix; //
        }
        additionalInfoHtmlSegments.push(createStatItemHtml(field.label, displayValue)); //
    });
    const additionalInfoHtml = additionalInfoHtmlSegments.filter(s => s).join(''); //

    const suspensionsHtml = (stats.suspensionsThisYear > 0) //
        ? createStatItemHtml(`Ulosajot (${config.CURRENT_YEAR})`, stats.suspensionsThisYear, "bg-gray-50 p-3 rounded-md sm:col-span-2") : ''; //

    const previousSeasonStatsHtml = (stats.gamesPlayedLastSeason > 0 || stats.goalsScoredLastSeason > 0) //
        ? `${createStatItemHtml(`Ottelut (${config.PREVIOUS_YEAR})`, stats.gamesPlayedLastSeason)}
           ${createStatItemHtml(`Maalit (${config.PREVIOUS_YEAR})`, stats.goalsScoredLastSeason)}` //
        : '';

    let pastMatchesDisplayHtml = ''; //
    if (stats.pastMatchesDetails && stats.pastMatchesDetails.length > 0) { //
        const matchesHtml = stats.pastMatchesDetails.slice(0, 10).map(match => { //
            let matchDisplay; //
            if (match.status === "Fixture") { //
                matchDisplay = `${match.date}: ${match.playerTeamNameInPastMatch} vs ${match.opponentName} (Tuleva)`; //
            } else {
                const indicatorClass = match.resultIndicator || 'draw'; //
                matchDisplay = `<span class="result-indicator ${indicatorClass}"></span>
                                ${match.date}: ${match.playerTeamNameInPastMatch} vs ${match.opponentName} (${match.playerTeamScore}-${match.opponentScore})`; //
            }
            return `<li class="past-match-item">${matchDisplay}</li>`; //
        }).join(''); //
        pastMatchesDisplayHtml = `<div class="mt-4 pt-4 border-t border-gray-200 col-span-1 sm:col-span-2">
                                <h4 class="text-md font-semibold text-gray-700 mb-2">Pelatut ottelut tälle joukkueelle (${config.CURRENT_YEAR}):</h4>
                                <ul class="list-none pl-0 space-y-1">${matchesHtml}</ul></div>`; //
    }

    // UUSI OSIO: Muiden joukkueiden ottelut
    let otherTeamsGamesHtml = '';
    const otherTeamsEntries = [];
    if (stats.gamesByTeamThisYear) {
        for (const [displayKey, games] of Object.entries(stats.gamesByTeamThisYear)) {
            // Näytä vain, jos displayKey ei ole sama kuin nykyisen kontekstijoukkueen displayKey
            // JA jos currentContextTeamDisplayKey on asetettu (eli pelaajalla oli pelejä kontekstijoukkueessa)
            // TAI jos currentContextTeamDisplayKey EI ole asetettu (pelaajalla ei pelejä kontekstijoukkueessa, kaikki listataan "muina")
            if (displayKey !== stats.currentContextTeamDisplayKey) {
                const goals = stats.goalsByTeamThisYear && stats.goalsByTeamThisYear[displayKey] ? stats.goalsByTeamThisYear[displayKey] : 0;
                otherTeamsEntries.push({ displayKey, games, goals });
            }
        }
    }

    if (otherTeamsEntries.length > 0) {
        const matchesHtml = otherTeamsEntries.map(entry => {
            return `<li class="past-match-item">${entry.displayKey}: ${entry.games} ottelua, ${entry.goals} maalia</li>`;
        }).join('');
        otherTeamsGamesHtml = `
            <div class="mt-4 pt-4 border-t border-gray-200 col-span-1 sm:col-span-2">
                <h4 class="text-md font-semibold text-gray-700 mb-2">Ottelut muissa joukkueissa (${config.CURRENT_YEAR}):</h4>
                <ul class="list-none pl-0 space-y-1">${matchesHtml}</ul>
            </div>`;
    }
    // LOPPU UUSI OSIO

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
        ${otherTeamsGamesHtml} {/* Lisätty uusi osio tänne */}
    `; //
    return card;
}

/**
 * Displays general match information.
 * @param {Object} match - The match details object.
 * @param {Object|null} groupDataForMatchInfo - Group data for H2H and referee comparison.
 * @param {number} [lineupGoalsA=0] - Total goals from team A's lineup this season.
 * @param {number} [lineupGoalsB=0] - Total goals from team B's lineup this season.
 * @param {HTMLElement} container - The HTML element to display the info in (assumed to be matchInfoContainer).
 */
function displayMatchInfo(match, groupDataForMatchInfo, lineupGoalsA = 0, lineupGoalsB = 0, container) {
    const teamAName = match.team_A_name || 'Kotijoukkue'; //
    const teamBName = match.team_B_name || 'Vierasjoukkue'; //
    const scoreA = match.fs_A !== undefined ? match.fs_A : '-'; //
    const scoreB = match.fs_B !== undefined ? match.fs_B : '-'; //

    let teamAStatsInGroup = null; //
    let teamBStatsInGroup = null; //

    if (groupDataForMatchInfo && groupDataForMatchInfo.teams) { //
        teamAStatsInGroup = groupDataForMatchInfo.teams.find(t => t.team_id === match.team_A_id); //
        teamBStatsInGroup = groupDataForMatchInfo.teams.find(t => t.team_id === match.team_B_id); //
    }

    let goalComparisonHtml = ''; //
    if (teamAStatsInGroup || teamBStatsInGroup || lineupGoalsA > 0 || lineupGoalsB > 0 || (match.lineups && match.lineups.length > 0)) { //
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
        </div>`; //
    }

    let headToHeadHtml = ''; //
    if (groupDataForMatchInfo && groupDataForMatchInfo.matches) { //
        const teamAId = match.team_A_id; //
        const teamBId = match.team_B_id; //
        const currentMatchId = match.match_id; //

        const previousEncounters = groupDataForMatchInfo.matches.filter(m => //
            m.match_id !== currentMatchId && //
            ((m.team_A_id === teamAId && m.team_B_id === teamBId) || (m.team_A_id === teamBId && m.team_B_id === teamAId)) && //
            m.status === "Played" //
        ).sort((a, b) => new Date(`${b.date}T${b.time || '00:00:00'}`) - new Date(`${a.date}T${a.time || '00:00:00'}`)) //
         .slice(0, 3); //

        if (previousEncounters.length > 0) { //
            headToHeadHtml = `<div class="mt-4 pt-3 border-t border-gray-200">
                                <h4 class="text-sm font-semibold text-gray-700 mb-1 text-center">Viimeiset keskinäiset kohtaamiset:</h4>
                                <ul class="head-to-head-list text-center">`; //
            previousEncounters.forEach(enc => { //
                headToHeadHtml += `<li>${enc.date}: ${enc.team_A_name} ${enc.fs_A !== undefined ? enc.fs_A : '-'} - ${enc.fs_B !== undefined ? enc.fs_B : '-'} ${enc.team_B_name}</li>`; //
            });
            headToHeadHtml += `</ul></div>`; //
        }
    }

    let refereeInfoHtml = ''; //
    if (match.referee_1_name) { //
        refereeInfoHtml += `<p class="text-sm text-gray-600 text-center mt-3">Erotuomari: ${match.referee_1_name}</p>`; //
    }

    let refereePastGamesHtml = ''; //
    if (match.referee_1_id && groupDataForMatchInfo && groupDataForMatchInfo.matches) { //
        const currentRefereeId = match.referee_1_id; //
        const teamAId = match.team_A_id; //
        const teamBId = match.team_B_id; //

        const getRefereeGamesList = (targetTeamId, targetTeamName) => { //
            const games = groupDataForMatchInfo.matches //
                .filter(m => //
                    m.referee_1_id === currentRefereeId && //
                    (m.team_A_id === targetTeamId || m.team_B_id === targetTeamId) && //
                    m.status === "Played" && //
                    m.match_id !== match.match_id //
                )
                .sort((a, b) => new Date(`${b.date}T${b.time || '00:00:00'}`) - new Date(`${a.date}T${a.time || '00:00:00'}`)) //
                .slice(0, 3); //

            if (games.length > 0) { //
                let listHtml = `<div class="mt-2"><h5 class="text-xs font-semibold text-gray-600">Erotuomarin aiemmat ottelut joukkueelle ${targetTeamName}:</h5><ul class="list-none pl-0 text-xs text-gray-500">`; //
                games.forEach(pastGame => { //
                    let opponentName, teamScore, opponentScore, resultIndicatorClass; //
                    if (pastGame.team_A_id === targetTeamId) { //
                        opponentName = pastGame.team_B_name; teamScore = pastGame.fs_A; opponentScore = pastGame.fs_B; //
                        if (pastGame.winner_id === targetTeamId) resultIndicatorClass = 'win'; //
                        else if (pastGame.winner_id === pastGame.team_B_id) resultIndicatorClass = 'loss'; //
                        else resultIndicatorClass = 'draw'; //
                    } else {
                        opponentName = pastGame.team_A_name; teamScore = pastGame.fs_B; opponentScore = pastGame.fs_A; //
                        if (pastGame.winner_id === targetTeamId) resultIndicatorClass = 'win'; //
                        else if (pastGame.winner_id === pastGame.team_A_id) resultIndicatorClass = 'loss'; //
                        else resultIndicatorClass = 'draw'; //
                    }
                    if (!pastGame.winner_id || pastGame.winner_id === '-' || pastGame.winner_id === '0') { //
                        resultIndicatorClass = 'draw'; //
                    }
                    listHtml += `<li class="referee-past-game-item"><span class="result-indicator ${resultIndicatorClass}"></span> ${pastGame.date}: vs ${opponentName} (${teamScore !== undefined ? teamScore : '-'}-${opponentScore !== undefined ? opponentScore : '-'})</li>`; //
                });
                listHtml += `</ul></div>`; //
                return listHtml; //
            }
            return ''; //
        };
        refereePastGamesHtml += `<div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 text-center">${getRefereeGamesList(teamAId, teamAName)}${getRefereeGamesList(teamBId, teamBName)}</div>`; //
    }

    // container is expected to be matchInfoContainer from global scope
    if (container) { //
        container.innerHTML = `
            <h2 class="text-2xl font-semibold text-gray-700 mb-2 text-center">${teamAName} vs ${teamBName}</h2>
            <p class="text-xl text-gray-600 text-center mb-2">Tulos: ${scoreA} - ${scoreB}</p>
            ${goalComparisonHtml}
            ${headToHeadHtml}
            ${refereeInfoHtml}
            ${refereePastGamesHtml}
            <p class="text-sm text-gray-500 text-center mt-3">Päivämäärä: ${match.date || 'N/A'}</p>
            <p class="text-sm text-gray-500 text-center">Sarja: ${match.category_name || 'N/A'} (${match.competition_name || 'N/A'})</p>
        `; //
    }
}

/**
 * Displays group information and standings table.
 * @param {Object} group - The group details object.
 * @param {string} currentMatchTeamAId - ID of team A in the current match.
 * @param {string} currentMatchTeamBId - ID of team B in the current match.
 * @param {HTMLElement} container - The HTML element to display the info in (assumed to be groupInfoContainer).
 */
function displayGroupInfoAndStandings(group, currentMatchTeamAId, currentMatchTeamBId, container) {
    if (!container) return; // Guard clause //

    if (!group || !group.teams || group.teams.length === 0) { //
        container.innerHTML = '<p class="text-gray-700 text-center">Sarjataulukkoa ei löytynyt tälle lohkolle.</p>'; //
        container.classList.remove('hidden'); //
        return; //
    }

    const groupName = group.group_name || 'Lohko'; //
    const categoryName = group.category_name || 'Sarja'; //
    const competitionName = group.competition_name || ''; //

    let tableHtml = `
        <h3 class="text-xl font-semibold text-gray-700 mb-1 text-center">${categoryName} - ${groupName}</h3>
        <p class="text-sm text-gray-500 text-center mb-4">(${competitionName})</p>
        <div class="overflow-x-auto">
            <table class="standings-table min-w-full">
                <thead><tr>
                    <th class="rank">#</th><th class="team-name">Joukkue</th>
                    <th class="number-col">O</th><th class="number-col">V</th><th class="number-col">T</th><th class="number-col">H</th>
                    <th class="number-col">TM</th><th class="number-col">PM</th><th class="number-col">ME</th><th class="number-col">P</th>
                </tr></thead><tbody>`; //

    const sortedTeams = [...group.teams].sort((a, b) => (parseInt(a.current_standing) || 999) - (parseInt(b.current_standing) || 999)); //

    sortedTeams.forEach(team => { //
        const isCurrentTeam = team.team_id === currentMatchTeamAId || team.team_id === currentMatchTeamBId; //
        tableHtml += `
            <tr>
                <td class="rank">${team.current_standing || '-'}</td>
                <td class="team-name">${isCurrentTeam ? `<strong>${team.team_name || 'N/A'}</strong>` : (team.team_name || 'N/A')}</td>
                <td class="number-col">${team.matches_played || 0}</td><td class="number-col">${team.matches_won || 0}</td>
                <td class="number-col">${team.matches_tied || 0}</td><td class="number-col">${team.matches_lost || 0}</td>
                <td class="number-col">${team.goals_for || 0}</td><td class="number-col">${team.goals_against || 0}</td>
                <td class="number-col">${team.goals_diff || 0}</td><td class="number-col"><strong>${team.points || 0}</strong></td>
            </tr>`; //
    });

    tableHtml += `</tbody></table></div>`; //
    container.innerHTML = tableHtml; //
    container.classList.remove('hidden'); //
}

/**
 * Processes and displays player statistics for players in the match lineup.
 * @param {Array<Object>} playersInMatch - Array of player lineup info from match details.
 * @param {Object} matchDetails - The full details of the current match.
 * @param {Object|null} groupDataForInfo - Group data for context.
 * @param {HTMLElement} playerStatsContainerGlobal - The HTML element to append player cards to (assumed to be playerStatsContainer).
 * @param {HTMLElement} matchInfoContainerGlobal - The HTML element for match info (assumed to be matchInfoContainer).
 * @returns {Promise<{lineupPlayerIds: string[], teamAName: string, teamBName: string}>} Player IDs and team names.
 */
async function processAndDisplayPlayerStats(playersInMatch, matchDetails, groupDataForInfo, playerStatsContainerGlobal, matchInfoContainerGlobal) {
    const teamAName = matchDetails.team_A_name || 'Kotijoukkue'; //
    const teamBName = matchDetails.team_B_name || 'Vierasjoukkue'; //

    if (!playerStatsContainerGlobal) return { lineupPlayerIds: [], teamAName, teamBName }; // Guard clause //

    if (!playersInMatch || playersInMatch.length === 0) { //
        playerStatsContainerGlobal.innerHTML = '<p class="text-gray-700 text-center">Ottelulle ei löytynyt pelaajatietoja kokoonpanosta.</p>'; //
        // displayMatchInfo is defined in this file.
        displayMatchInfo(matchDetails, groupDataForInfo, 0, 0, matchInfoContainerGlobal); //
        return { lineupPlayerIds: [], teamAName, teamBName }; //
    }

    // fetchAndProcessPlayerData is imported from dataProcessor.js
    const playerPromises = playersInMatch.map(playerLineupInfo => //
        fetchAndProcessPlayerData(playerLineupInfo.player_id, playerLineupInfo.team_id, matchDetails, playerLineupInfo) //
    );

    const allPlayerStats = (await Promise.all(playerPromises)).filter(stats => stats !== null); //

    let totalLineupGoalsTeamA = 0; //
    let totalLineupGoalsTeamB = 0; //

    allPlayerStats.forEach(player => { //
        if (player.teamIdInMatch === matchDetails.team_A_id) { //
            totalLineupGoalsTeamA += (player.goalsForThisSpecificTeamInSeason || 0); //
        } else if (player.teamIdInMatch === matchDetails.team_B_id) { //
            totalLineupGoalsTeamB += (player.goalsForThisSpecificTeamInSeason || 0); //
        }
    });

    displayMatchInfo(matchDetails, groupDataForInfo, totalLineupGoalsTeamA, totalLineupGoalsTeamB, matchInfoContainerGlobal); //

    allPlayerStats.sort((a, b) => { //
        const getTeamSortOrder = (teamId) => (teamId === matchDetails.team_A_id ? 1 : (teamId === matchDetails.team_B_id ? 2 : 3)); //
        const teamOrderA = getTeamSortOrder(a.teamIdInMatch); //
        const teamOrderB = getTeamSortOrder(b.teamIdInMatch); //
        if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB; //
        const numA = parseInt(a.shirtNumber); //
        const numB = parseInt(b.shirtNumber); //
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB; //
        if (!isNaN(numA)) return -1; //
        if (!isNaN(numB)) return 1; //
        return a.name.localeCompare(b.name); //
    });

    if (allPlayerStats.length === 0) { //
        playerStatsContainerGlobal.innerHTML = '<p class="text-gray-700 text-center">Pelaajien tilastojen haku epäonnistui kaikille kokoonpanon pelaajille.</p>'; //
    } else {
        playerStatsContainerGlobal.innerHTML = ''; //
        let currentTeamIdDisplayed = null; //
        allPlayerStats.forEach(playerFullStats => { //
            if (playerFullStats.teamIdInMatch !== currentTeamIdDisplayed) { //
                currentTeamIdDisplayed = playerFullStats.teamIdInMatch; //
                const teamHeader = document.createElement('h2'); //
                teamHeader.className = 'text-2xl font-semibold text-gray-700 mt-8 mb-4 pt-4 border-t border-gray-200'; //
                teamHeader.textContent = currentTeamIdDisplayed === matchDetails.team_A_id ? teamAName : (currentTeamIdDisplayed === matchDetails.team_B_id ? teamBName : `Joukkue ID: ${currentTeamIdDisplayed}`); //
                playerStatsContainerGlobal.appendChild(teamHeader); //
            }
            // displayPlayerStats is defined in this file.
            displayPlayerStats(playerFullStats, playerStatsContainerGlobal); //
        });
    }
    return { lineupPlayerIds: playersInMatch.map(p => p.player_id.toString()), teamAName, teamBName }; //
}

/**
 * Displays a single player's statistics card in the UI.
 * @param {Object} stats - The player's statistics object.
 * @param {HTMLElement} container - The HTML element to append the card to.
 */
function displayPlayerStats(stats, container) {
    if (!container) return; // Guard clause //
    // createPlayerStatCardElement is defined in this file.
    const cardElement = createPlayerStatCardElement(stats); //
    container.appendChild(cardElement); //
}

/**
 * Displays players who are in the team roster but not in the current match lineup.
 * @param {Object} teamDetails - Full team details from getTeam API.
 * @param {Array<string>} matchLineupPlayerIds - Array of player IDs who are in the match lineup.
 * @param {string} teamDisplayName - The display name of the team.
 * @param {Object} originalMatchDetails - The original match details for context.
 * @param {HTMLElement} container - The HTML element to append player cards to (assumed to be playersNotInLineupContainer).
 */
async function displayPlayersNotInLineup(teamDetails, matchLineupPlayerIds, teamDisplayName, originalMatchDetails, container) {
    if (!container) return; // Guard clause //

    if (!teamDetails || !teamDetails.players || teamDetails.players.length === 0) { //
        return; //
    }

    const playersNotInMatch = teamDetails.players.filter(player => //
        player.player_id && !matchLineupPlayerIds.includes(player.player_id.toString()) && player.inactive !== "1" //
    );

    if (playersNotInMatch.length > 0) { //
        const sectionDiv = document.createElement('div'); //
        sectionDiv.className = 'mt-8 p-6 bg-gray-100 rounded-lg shadow-inner'; //

        const header = document.createElement('h3'); //
        header.className = 'text-xl font-semibold text-gray-800 mb-4 border-b pb-2'; //
        header.textContent = `Muut joukkueen pelaajat (${teamDisplayName})`; //
        sectionDiv.appendChild(header); //

        const cardsContainer = document.createElement('div'); //
        cardsContainer.className = 'space-y-6'; //

        playersNotInMatch.sort((a,b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || '')); //

        // fetchAndProcessPlayerData is imported from dataProcessor.js
        const playerStatPromises = playersNotInMatch.map(async (playerFromTeam) => { //
            const playerLineupInfo = { //
                player_id: playerFromTeam.player_id, //
                player_name: `${playerFromTeam.first_name || ''} ${playerFromTeam.last_name || ''}`.trim() || `Pelaaja ID: ${playerFromTeam.player_id}`, //
                shirt_number: playerFromTeam.shirt_number || 'N/A', //
                team_id: teamDetails.team_id, //
                team_name_from_getTeam: teamDetails.team_name, //
                captain: '' //
            };
            return fetchAndProcessPlayerData(playerFromTeam.player_id, teamDetails.team_id, originalMatchDetails, playerLineupInfo); //
        });

        const resolvedPlayerStatsArray = (await Promise.all(playerStatPromises)).filter(stats => stats !== null); //

        if (resolvedPlayerStatsArray.length > 0) { //
            resolvedPlayerStatsArray.forEach(stats => { //
                // displayPlayerStats is defined in this file.
                displayPlayerStats(stats, cardsContainer); //
            });
            sectionDiv.appendChild(cardsContainer); //
        } else if (playersNotInMatch.length > 0) { //
            const noPlayersMsg = document.createElement('p'); //
            noPlayersMsg.className = 'text-gray-600'; //
            noPlayersMsg.textContent = 'Ei muita pelaajia näytettäväksi tälle joukkueelle (tilastojen haku saattoi epäonnistua).'; //
            sectionDiv.appendChild(noPlayersMsg); //
        }
        container.appendChild(sectionDiv); //
    }
}

export {
    createPlayerStatCardElement,
    displayMatchInfo,
    displayGroupInfoAndStandings,
    processAndDisplayPlayerStats,
    displayPlayerStats,
    displayPlayersNotInLineup
};
