// Imports from new modules
import { config } from './js/config.js';
import { clearPreviousData, showLoading, displayError } from './js/utils.js';
import { fetchMatchDetails, fetchGroupDetails, fetchTeamData } from './js/apiService.js';
import { processPlayerMatchHistory } from './js/dataProcessor.js';
import { 
    displayGroupInfoAndStandings, 
    processAndDisplayPlayerStats, 
    displayPlayersNotInLineup,
    displayTeamSchedule
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
        if (typeof displayError === 'function') displayError("Sovelluksen alustusvirhe. Tarkista konsoli.");
        return;
    }
    const matchId = matchIdInput.value.trim();
    if (!matchId) {
        if (typeof displayError === 'function') displayError("Syötä ottelun ID.");
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
                matchDetails.lineups, matchDetails, groupDataForInfo, playerStatsContainer, matchInfoContainer 
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
 * KORJATTU FUNKTIO
 * Main function to orchestrate fetching and displaying schedule data for a TEAM.
 * @param {string} teamId The ID of the team to fetch schedule for.
 */
async function loadTeamSchedule(teamId) {
    clearPreviousData();
    showLoading(true);
    displayError("");

    try {
        // Vaihe 1: Hae joukkueen tiedot
        const teamApiResponse = await fetchTeamData(teamId);
        // Turvallinen tarkistus, ettei yritetä lukea null-arvoa
        if (!teamApiResponse || !teamApiResponse.team) {
            throw new Error("Joukkueen tietoja ei voitu hakea tai vastaus oli virheellinen.");
        }
        const teamDetails = teamApiResponse.team;

        if (!teamDetails.groups || teamDetails.groups.length === 0) {
            throw new Error("Joukkueelle ei löytynyt sarjoja tai lohkoja.");
        }

        // Vaihe 2: Etsi kuluvan kauden aktiivinen lohko
        const currentYear = config.CURRENT_YEAR;
        const currentGroupInfo = teamDetails.groups.find(g => g.competition_season === currentYear && g.group_current === "1");

        if (!currentGroupInfo) {
            throw new Error(`Joukkueelle ei löytynyt aktiivista ryhmää kaudelle ${currentYear}.`);
        }
        
        // Vaihe 3: Hae lohkon tiedot, jotka sisältävät ottelut
        const groupData = await fetchGroupDetails({
            competition_id: currentGroupInfo.competition_id,
            category_id: currentGroupInfo.category_id,
            group_id: currentGroupInfo.group_id
        });

        // Turvallinen tarkistus, fetchGroupDetails palauttaa null epäonnistuessaan
        if (!groupData) {
             throw new Error("Lohkon tietoja ei voitu hakea.");
        }
        
        // Varoitetaan, jos lohko löytyy, mutta otteluita ei ole, mutta ei heitetä virhettä
        if (!groupData.matches) {
            console.warn("Lohko löytyi, mutta se ei sisällä otteluita.");
        }

        // Vaihe 4: Näytä otteluohjelma
        displayTeamSchedule({
            team_name: teamDetails.team_name,
            matches: groupData.matches || [] // Varmistetaan, että välitetään aina taulukko
        }, playersNotInLineupContainer);

    } catch (error) {
        console.error(`Virhe haettaessa joukkueen ${teamId} otteluohjelmaa:`, error);
        displayError(`Virhe haettaessa joukkueen ${teamId} otteluohjelmaa: ${error.message}`);
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
        const teamIdFromQuery = queryParams.get('teamid');

        if (matchIdFromQuery) {
            if (matchIdInput) {
                matchIdInput.value = matchIdFromQuery;
                if (typeof loadMatchData === 'function') {
                    loadMatchData();
                }
            }
        } else if (teamIdFromQuery) {
            if (typeof loadTeamSchedule === 'function') {
                loadTeamSchedule(teamIdFromQuery);
            }
        }
    });
}

// Re-exporting for testing purposes or other consumers
export { processPlayerMatchHistory, config };
