// Imports from new modules
import { config } from './js/config.js'; // Re-exported
import { clearPreviousData, showLoading, displayError } from './js/utils.js';
import { fetchMatchDetails, fetchGroupDetails, fetchTeamData } from './js/apiService.js';
import { processPlayerMatchHistory } from './js/dataProcessor.js'; // Re-exported
import { 
    displayGroupInfoAndStandings, 
    processAndDisplayPlayerStats, 
    displayPlayersNotInLineup,
    displayTeamSchedule // UUSI IMPORTTI
} from './js/uiManager.js';

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
}

// --- Main Application Logic ---

/**
 * Main function to orchestrate fetching and displaying all data for a MATCH.
 */
async function loadMatchData() {
    if (!matchIdInput) {
        console.error("matchIdInput is not initialized.");
        console.error("Syötä ottelun ID. (Application initialization error)"); 
        if (typeof displayError === 'function') displayError("Sovelluksen alustusvirhe. Tarkista konsoli.");
        return;
    }
    const matchId = matchIdInput.value.trim();
    if (!matchId) {
        if (typeof displayError === 'function') displayError("Syötä ottelun ID.");
        return;
    }

    if (typeof clearPreviousData !== 'function' || typeof showLoading !== 'function' || typeof displayError !== 'function') {
        console.error("Core utility functions are not loaded. Cannot proceed.");
        return;
    }

    clearPreviousData();
    showLoading(true);
    displayError("");

    try {
        const matchDetails = await fetchMatchDetails(matchId);
        if (!matchDetails) {
            showLoading(false); 
            return;
        }

        const groupDataForInfo = await fetchGroupDetails(matchDetails);
        if (groupDataForInfo && typeof displayGroupInfoAndStandings === 'function') {
            displayGroupInfoAndStandings(groupDataForInfo, matchDetails.team_A_id, matchDetails.team_B_id, groupInfoContainer);
        }

        const [teamAData, teamBData] = await Promise.all([
            fetchTeamData(matchDetails.team_A_id),
            fetchTeamData(matchDetails.team_B_id)
        ]);
        
        if (typeof processAndDisplayPlayerStats === 'function') {
            const { lineupPlayerIds, teamAName, teamBName } = await processAndDisplayPlayerStats(
                matchDetails.lineups, 
                matchDetails, 
                groupDataForInfo, 
                playerStatsContainer, 
                matchInfoContainer 
            );

            if (teamAData && teamAData.team && typeof displayPlayersNotInLineup === 'function') {
                await displayPlayersNotInLineup(teamAData.team, lineupPlayerIds, teamAName, matchDetails, playersNotInLineupContainer);
            }
            if (teamBData && teamBData.team && typeof displayPlayersNotInLineup === 'function') {
                await displayPlayersNotInLineup(teamBData.team, lineupPlayerIds, teamBName, matchDetails, playersNotInLineupContainer);
            }
        }

    } catch (error) {
        console.error("Käsittelemätön virhe pääfunktiossa loadMatchData:", error);
        if (typeof displayError === 'function') displayError(`Odottamaton virhe: ${error.message}. Tarkista konsoli.`);
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

/**
 * UUSI FUNKTIO
 * Main function to orchestrate fetching and displaying schedule data for a TEAM.
 * @param {string} teamId The ID of the team to fetch schedule for.
 */
async function loadTeamSchedule(teamId) {
    clearPreviousData();
    showLoading(true);
    displayError("");

    try {
        const teamData = await fetchTeamData(teamId);

        if (teamData && teamData.team && teamData.team.matches) {
            // Käytetään playersNotInLineupContainer-elementtiä joukkueen otteluohjelman näyttämiseen.
            displayTeamSchedule(teamData.team, playersNotInLineupContainer);
        } else {
            displayError(`Joukkueen (ID: ${teamId}) tietoja tai otteluita ei löytynyt.`);
        }

    } catch (error) {
        console.error(`Virhe haettaessa joukkueen ${teamId} tietoja:`, error);
        displayError(`Virhe haettaessa joukkueen ${teamId} tietoja: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// --- Event Listeners ---
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if(fetchDataButton) { 
        fetchDataButton.addEventListener('click', loadMatchData);
    } else {
        console.error("Fetch Data Button not found during event listener setup.");
    }

    document.addEventListener('DOMContentLoaded', () => {
        const queryParams = new URLSearchParams(window.location.search);
        const matchIdFromQuery = queryParams.get('matchid'); 
        const teamIdFromQuery = queryParams.get('teamid'); // LISÄTTY

        if (matchIdFromQuery) {
            if (matchIdInput) {
                matchIdInput.value = matchIdFromQuery;
                if (typeof loadMatchData === 'function') {
                    loadMatchData();
                } else {
                    console.error("loadMatchData function not available on DOMContentLoaded for query param.");
                }
            } else {
                 console.error("Match ID Input not found on DOMContentLoaded for query param.");
            }
        } else if (teamIdFromQuery) { // LISÄTTY EHTOLAUSE
            if (typeof loadTeamSchedule === 'function') {
                loadTeamSchedule(teamIdFromQuery);
            } else {
                console.error("loadTeamSchedule function not available on DOMContentLoaded for query param.");
            }
        }
    });
}

// Re-exporting for testing purposes or other consumers
export { processPlayerMatchHistory, config };
