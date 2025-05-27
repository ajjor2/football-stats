// script.js
import { config } from './js/config.js';
import { clearPreviousData, showLoading, displayError } from './js/utils.js';
import { fetchMatchDetails, fetchGroupDetails, fetchTeamData, fetchTeamMatches } from './js/apiService.js';
import { processPlayerMatchHistory } from './js/dataProcessor.js'; // Used by fetchAndProcessPlayerData
import {
    displayGroupInfoAndStandings,
    processAndDisplayPlayerStats,
    displayPlayersNotInLineup,
    displayMatchInfo, // Used to initially display match info before player stats are fully processed
    displayTeamRecentAndUpcomingMatches,
    displayHeadToHeadMatchesCurrentYear // New import
} from './js/uiManager.js';

// DOM Element Constants
let matchIdInput, fetchDataButton, playerStatsContainer, matchInfoContainer,
    groupInfoContainer, playersNotInLineupContainer, loadingIndicator, errorMessageContainer,
    showMoreInfoButton, moreMatchInfoContainer; // New elements

// Store current match details for the "More Info" button
let currentMatchDetails = null;
let moreInfoFetched = false; // To track if more info has been fetched to avoid re-fetch on simple toggle

// Initialize DOM elements once the DOM is ready
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


/**
 * Clears all previously displayed data from the UI, including the "More Info" section.
 */
function clearAllUIData() {
    if (typeof clearPreviousData === 'function') { // Ensure imported util is available
        clearPreviousData(); // This should handle basic containers
    }
    // Explicitly handle new elements
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
    moreInfoFetched = false;
}


/**
 * Main function to orchestrate fetching and displaying all data for a match.
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

    clearAllUIData(); // Use the comprehensive clear function
    showLoading(true);
    // displayError(""); // clearAllUIData should handle this

    try {
        const matchDetailsResponse = await fetchMatchDetails(matchId);
        if (!matchDetailsResponse) {
            showLoading(false); // Ensure loading is hidden if match details fetch fails
            return;
        }
        currentMatchDetails = matchDetailsResponse;

        // Initial display of match info (without lineup goals yet)
        if (typeof displayMatchInfo === 'function' && matchInfoContainer) {
             displayMatchInfo(currentMatchDetails, null, 0, 0, matchInfoContainer);
        }

        const groupDataForInfo = await fetchGroupDetails(currentMatchDetails);
        if (groupDataForInfo && typeof displayGroupInfoAndStandings === 'function' && groupInfoContainer) {
            displayGroupInfoAndStandings(groupDataForInfo, currentMatchDetails.team_A_id, currentMatchDetails.team_B_id, groupInfoContainer);
        }

        if (typeof processAndDisplayPlayerStats === 'function' && playerStatsContainer && matchInfoContainer) {
            const { lineupPlayerIds, teamAName, teamBName } = await processAndDisplayPlayerStats(
                currentMatchDetails.lineups,
                currentMatchDetails,
                groupDataForInfo, // Pass groupData here for H2H and referee context in displayMatchInfo
                playerStatsContainer,
                matchInfoContainer // This will re-render matchInfo with lineup goals
            );

            const [teamAData, teamBData] = await Promise.all([
                fetchTeamData(currentMatchDetails.team_A_id),
                fetchTeamData(currentMatchDetails.team_B_id)
            ]);

            if (teamAData && teamAData.team && typeof displayPlayersNotInLineup === 'function' && playersNotInLineupContainer) {
                await displayPlayersNotInLineup(teamAData.team, lineupPlayerIds, teamAName, currentMatchDetails, playersNotInLineupContainer);
            }
            if (teamBData && teamBData.team && typeof displayPlayersNotInLineup === 'function' && playersNotInLineupContainer) {
                await displayPlayersNotInLineup(teamBData.team, lineupPlayerIds, teamBName, currentMatchDetails, playersNotInLineupContainer);
            }
        }

        // Show the "Lisätietoja" button now that main data is loaded
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

/**
 * Fetches and displays more detailed match info (past/future games for teams and H2H).
 */
async function loadMoreTeamInfo() {
    if (!currentMatchDetails) {
        if (typeof displayError === 'function') displayError("Pääottelun tiedot puuttuvat. Lataa ottelu ensin.");
        return;
    }
    if (!moreMatchInfoContainer || !showMoreInfoButton) return;

    // If already fetched and visible, just hide it
    if (!moreMatchInfoContainer.classList.contains('hidden') && moreInfoFetched) {
        moreMatchInfoContainer.classList.add('hidden');
        showMoreInfoButton.textContent = 'Lisätietoja Joukkueista';
        return;
    }
    // If hidden but already fetched, just show it
    if (moreMatchInfoContainer.classList.contains('hidden') && moreInfoFetched) {
        moreMatchInfoContainer.classList.remove('hidden');
        showMoreInfoButton.textContent = 'Piilota Lisätiedot';
        return;
    }

    // If not fetched yet
    showMoreInfoButton.textContent = 'Ladataan...';
    showMoreInfoButton.disabled = true;
    moreMatchInfoContainer.innerHTML = '<div class="loader my-4"></div>'; // Centered loader
    moreMatchInfoContainer.classList.remove('hidden');

    try {
        const teamAId = currentMatchDetails.team_A_id;
        const teamBId = currentMatchDetails.team_B_id;
        const teamAName = currentMatchDetails.team_A_name || `Joukkue ${teamAId}`;
        const teamBName = currentMatchDetails.team_B_name || `Joukkue ${teamBId}`;
        const matchDate = currentMatchDetails.date; // Date of the current match
        const currentYear = config.CURRENT_YEAR;
        const startDate = `${currentYear}-01-01`; // Fetch all matches from the beginning of the current year

        // Fetch all matches for both teams for the current year
        const [matchesTeamA, matchesTeamB] = await Promise.all([
            fetchTeamMatches(teamAId, startDate),
            fetchTeamMatches(teamBId, startDate)
        ]);

        moreMatchInfoContainer.innerHTML = ''; // Clear loader before adding new content

        // Display Head-to-Head matches first
        if (typeof displayHeadToHeadMatchesCurrentYear === 'function') {
            // Pass matchesTeamA (or B, either should contain H2H if they exist)
            // and IDs/names for both teams.
            displayHeadToHeadMatchesCurrentYear(matchesTeamA, teamAId, teamBId, teamAName, teamBName, currentMatchDetails.match_id, moreMatchInfoContainer);
        }

        // Display recent and upcoming for Team A
        if (typeof displayTeamRecentAndUpcomingMatches === 'function') {
            displayTeamRecentAndUpcomingMatches(teamAId, teamAName, matchesTeamA, matchDate, currentMatchDetails.match_id, moreMatchInfoContainer);
        }
        // Display recent and upcoming for Team B
        if (typeof displayTeamRecentAndUpcomingMatches === 'function') {
            displayTeamRecentAndUpcomingMatches(teamBId, teamBName, matchesTeamB, matchDate, currentMatchDetails.match_id, moreMatchInfoContainer);
        }
        
        moreInfoFetched = true;
        showMoreInfoButton.textContent = 'Piilota Lisätiedot';

    } catch (error) {
        console.error("Error fetching more team info:", error);
        moreMatchInfoContainer.innerHTML = `<p class="text-red-500 text-center">Virhe haettaessa lisätietoja: ${error.message}</p>`;
        showMoreInfoButton.textContent = 'Yritä Uudelleen';
        moreInfoFetched = false; // Reset as fetch failed
    } finally {
        showMoreInfoButton.disabled = false;
    }
}


// --- Event Listeners ---
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeDOMElements(); // Initialize DOM elements after DOM is loaded

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
                    loadMatchData(); // Automatically load data if matchid is in URL
                } else {
                    console.error("loadMatchData function not available on DOMContentLoaded for query param.");
                }
            } else {
                 console.error("Match ID Input not found on DOMContentLoaded for query param.");
            }
        }
    });
}

// Re-exporting for testing purposes or other consumers (if any)
export { processPlayerMatchHistory, config };
