// script.js
import { config } from './js/config.js';
import { clearPreviousData, showLoading, displayError } from './js/utils.js';
import { fetchMatchDetails, fetchGroupDetails, fetchTeamData, fetchTeamMatches } from './js/apiService.js';
import { processPlayerMatchHistory } from './js/dataProcessor.js';
import { // Varmistetaan, että kaikki importit ovat tässä
    createPlayerStatCardElement, // Ei välttämättä käytetä suoraan script.js:ssä, mutta hyvä olla jos tarvitaan
    displayMatchInfo,
    displayGroupInfoAndStandings,
    processAndDisplayPlayerStats,
    displayPlayerStats, // Ei välttämättä käytetä suoraan script.js:ssä
    displayPlayersNotInLineup,
    displayTeamRecentAndUpcomingMatches,
    displayHeadToHeadMatchesCurrentYear,
    displayRefereeInfoAndPastGames // Uusi import
} from './js/uiManager.js';

// DOM Element Constants
let matchIdInput, fetchDataButton, playerStatsContainer, matchInfoContainer,
    groupInfoContainer, playersNotInLineupContainer, loadingIndicator, errorMessageContainer,
    showMoreInfoButton, moreMatchInfoContainer;

let currentMatchDetails = null;
let currentGroupDataForInfo = null; // Tallenna groupData tänne
let moreInfoFetched = false;

function initializeDOMElements() {
    matchIdInput = document.getElementById('matchIdInput');
    fetchDataButton = document.getElementById('fetchDataButton');
    playerStatsContainer = document.getElementById('playerStatsContainer');
    matchInfoContainer = document.getElementById('matchInfo');
    groupInfoContainer = document.getElementById('groupInfoContainer');
    playersNotInLineupContainer = document.getElementById('playersNotInLineupContainer');
    loadingIndicator = document.getElementById('loadingIndicator');
    errorMessageContainer = document.getElementById('errorMessage');
    showMoreInfoButton = document.getElementById('showMoreInfoButton');
    moreMatchInfoContainer = document.getElementById('moreMatchInfoContainer');
}

function clearAllUIData() {
    if (typeof clearPreviousData === 'function') {
        clearPreviousData();
    }
    if (showMoreInfoButton) {
        showMoreInfoButton.classList.add('hidden');
        showMoreInfoButton.textContent = 'Lisätietoja Joukkueista';
        showMoreInfoButton.disabled = false;
    }
    if (moreMatchInfoContainer) {
        moreMatchInfoContainer.innerHTML = '';
        moreMatchInfoContainer.classList.add('hidden');
    }
    currentMatchDetails = null;
    currentGroupDataForInfo = null; // Nollaa myös groupData
    moreInfoFetched = false;
}

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

    clearAllUIData();
    showLoading(true);

    try {
        const matchDetailsResponse = await fetchMatchDetails(matchId);
        if (!matchDetailsResponse) {
            showLoading(false);
            return;
        }
        currentMatchDetails = matchDetailsResponse;

        // Haetaan groupData ja tallennetaan se
        currentGroupDataForInfo = await fetchGroupDetails(currentMatchDetails);

        if (typeof displayMatchInfo === 'function' && matchInfoContainer) {
             displayMatchInfo(currentMatchDetails, currentGroupDataForInfo, 0, 0, matchInfoContainer);
        }

        if (typeof displayGroupInfoAndStandings === 'function' && currentGroupDataForInfo && groupInfoContainer) { // Tarkistettu displayGroupInfoAndStandings
            displayGroupInfoAndStandings(currentGroupDataForInfo, currentMatchDetails.team_A_id, currentMatchDetails.team_B_id, groupInfoContainer);
        }

        if (typeof processAndDisplayPlayerStats === 'function' && playerStatsContainer && matchInfoContainer) {
            const { lineupPlayerIds, teamAName, teamBName } = await processAndDisplayPlayerStats(
                currentMatchDetails.lineups,
                currentMatchDetails,
                currentGroupDataForInfo, // Käytä tallennettua groupDataa
                playerStatsContainer,
                matchInfoContainer
            );

            const [teamAData, teamBData] = await Promise.all([
                fetchTeamData(currentMatchDetails.team_A_id),
                fetchTeamData(currentMatchDetails.team_B_id)
            ]);

            if (typeof displayPlayersNotInLineup === 'function' && teamAData && teamAData.team && playersNotInLineupContainer) {
                await displayPlayersNotInLineup(teamAData.team, lineupPlayerIds, teamAName, currentMatchDetails, playersNotInLineupContainer);
            }
            if (typeof displayPlayersNotInLineup === 'function' && teamBData && teamBData.team && playersNotInLineupContainer) {
                await displayPlayersNotInLineup(teamBData.team, lineupPlayerIds, teamBName, currentMatchDetails, playersNotInLineupContainer);
            }
        }

        if (showMoreInfoButton) {
            showMoreInfoButton.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Käsittelemätön virhe pääfunktiossa loadMatchData:", error);
        if (typeof displayError === 'function') displayError(`Odottamaton virhe: ${error.message}. Tarkista konsoli.`);
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function loadMoreTeamInfo() {
    if (!currentMatchDetails) {
        if (typeof displayError === 'function') displayError("Pääottelun tiedot puuttuvat. Lataa ottelu ensin.");
        return;
    }
    if (!moreMatchInfoContainer || !showMoreInfoButton) return;

    if (!moreMatchInfoContainer.classList.contains('hidden') && moreInfoFetched) {
        moreMatchInfoContainer.classList.add('hidden');
        showMoreInfoButton.textContent = 'Lisätietoja Joukkueista';
        return;
    }
    if (moreMatchInfoContainer.classList.contains('hidden') && moreInfoFetched) {
        moreMatchInfoContainer.classList.remove('hidden');
        showMoreInfoButton.textContent = 'Piilota Lisätiedot';
        return;
    }

    showMoreInfoButton.textContent = 'Ladataan...';
    showMoreInfoButton.disabled = true;
    moreMatchInfoContainer.innerHTML = '<div class="loader my-4"></div>';
    moreMatchInfoContainer.classList.remove('hidden');

    try {
        const teamAId = currentMatchDetails.team_A_id;
        const teamBId = currentMatchDetails.team_B_id;
        const teamAName = currentMatchDetails.team_A_name || `Joukkue ${teamAId}`;
        const teamBName = currentMatchDetails.team_B_name || `Joukkue ${teamBId}`;
        const matchDate = currentMatchDetails.date;
        const currentYear = config.CURRENT_YEAR;
        const startDate = `${currentYear}-01-01`;
        const refereeId = currentMatchDetails.referee_1_id;
        const refereeName = currentMatchDetails.referee_1_name;


        const [matchesTeamA, matchesTeamB] = await Promise.all([
            fetchTeamMatches(teamAId, startDate),
            fetchTeamMatches(teamBId, startDate)
        ]);

        moreMatchInfoContainer.innerHTML = '';

        if (typeof displayHeadToHeadMatchesCurrentYear === 'function') {
            displayHeadToHeadMatchesCurrentYear(matchesTeamA, teamAId, teamBId, teamAName, teamBName, currentMatchDetails.match_id, moreMatchInfoContainer);
        }
        
        // Näytä tuomarin tiedot ja aiemmat pelit
        if (typeof displayRefereeInfoAndPastGames === 'function' && refereeId && refereeName && currentGroupDataForInfo && currentGroupDataForInfo.matches) {
            displayRefereeInfoAndPastGames(refereeId, refereeName, currentGroupDataForInfo.matches, currentMatchDetails.match_id, moreMatchInfoContainer);
        }


        if (typeof displayTeamRecentAndUpcomingMatches === 'function') {
            displayTeamRecentAndUpcomingMatches(teamAId, teamAName, matchesTeamA, matchDate, currentMatchDetails.match_id, moreMatchInfoContainer);
            displayTeamRecentAndUpcomingMatches(teamBId, teamBName, matchesTeamB, matchDate, currentMatchDetails.match_id, moreMatchInfoContainer);
        }
        
        moreInfoFetched = true;
        showMoreInfoButton.textContent = 'Piilota Lisätiedot';

    } catch (error) {
        console.error("Error fetching more team info:", error);
        moreMatchInfoContainer.innerHTML = `<p class="text-red-500 text-center">Virhe haettaessa lisätietoja: ${error.message}</p>`;
        showMoreInfoButton.textContent = 'Yritä Uudelleen';
        moreInfoFetched = false;
    } finally {
        showMoreInfoButton.disabled = false;
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeDOMElements();

        if (fetchDataButton) {
            fetchDataButton.addEventListener('click', loadMatchData);
        } else {
            console.error("Fetch Data Button not found during event listener setup.");
        }

        if (showMoreInfoButton) {
            showMoreInfoButton.addEventListener('click', loadMoreTeamInfo);
        } else {
            console.error("Show More Info Button not found during event listener setup.");
        }

        const queryParams = new URLSearchParams(window.location.search);
        const matchIdFromQuery = queryParams.get('matchid');

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
        }
    });
}

export { processPlayerMatchHistory, config };
