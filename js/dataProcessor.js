// js/dataProcessor.js

import { config } from './config.js';
import { fetchAPIData } from './apiService.js';

/**
 * Processes a player's match history to extract season statistics.
 * @param {Array<Object>} matches - Array of match objects from player data.
 * @param {string} currentSeasonId - Identifier for the current season (usually config.CURRENT_YEAR).
 * @param {string} previousSeasonId - Identifier for the previous season (usually config.PREVIOUS_YEAR).
 * @param {string|null} teamNameForContext - Name of the team for context-specific stats.
 * @param {Object} [teamIdToPrimaryCategoryNameMap={}] - A map from team_id to its primary category name for the current season.
 * @returns {Object} Contains stats like gamesPlayedThisYear, goalsThisYear, etc., and currentContextTeamDisplayKey.
 */
function processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext, teamIdToPrimaryCategoryNameMap = {}) {
    const stats = {
        gamesPlayedThisYear: 0, goalsThisYear: 0, warningsThisYear: 0, suspensionsThisYear: 0,
        goalsByTeamThisYear: {}, gamesByTeamThisYear: {},
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [],
        gamesPlayedLastSeason: 0, goalsScoredLastSeason: 0,
        currentContextTeamDisplayKey: null // Lisätty uusi ominaisuus
    };

    if (!Array.isArray(matches)) return stats;

    matches.forEach(pastMatch => {
        const isCurrentSeason = pastMatch.season_id === currentSeasonId;
        const isPreviousSeason = pastMatch.season_id === previousSeasonId;

        if (isCurrentSeason) {
            stats.gamesPlayedThisYear++;
            const teamNameForGame = pastMatch.team_name || 'Tuntematon joukkue';
            
            let leagueName;
            if (pastMatch.team_id && teamIdToPrimaryCategoryNameMap[pastMatch.team_id]) {
                leagueName = teamIdToPrimaryCategoryNameMap[pastMatch.team_id];
            } else {
                leagueName = pastMatch.competition_name || pastMatch.category_name || 'Sarja tuntematon';
            }
            
            const displayKey = `${teamNameForGame} (${leagueName})`;

            stats.gamesByTeamThisYear[displayKey] = (stats.gamesByTeamThisYear[displayKey] || 0) + 1;

            const playerGoals = parseInt(pastMatch.player_goals) || 0;
            stats.goalsThisYear += playerGoals;
            if (playerGoals > 0) {
                stats.goalsByTeamThisYear[displayKey] = (stats.goalsByTeamThisYear[displayKey] || 0) + playerGoals;
                if (teamNameForGame && teamNameForContext && teamNameForGame === teamNameForContext) {
                    stats.goalsForThisSpecificTeamInSeason += playerGoals;
                }
            }
            stats.warningsThisYear += parseInt(pastMatch.player_warnings) || 0;
            stats.suspensionsThisYear += parseInt(pastMatch.player_suspensions) || 0;

            if (teamNameForGame && teamNameForContext && teamNameForGame === teamNameForContext) {
                if (!stats.currentContextTeamDisplayKey) { // Aseta vain kerran
                    stats.currentContextTeamDisplayKey = displayKey;
                }
                // ... (logiikka pastMatchesDetails-listalle pysyy samana)
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
                    const tempOpponentScore = pastMatch.fs_A; 
                    opponentScore = tempOpponentScore;       
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

// ... (fetchAndProcessPlayerData pysyy ennallaan, mutta hyötyy nyt currentContextTeamDisplayKey-arvosta stats-objektissa)

export { processPlayerMatchHistory, fetchAndProcessPlayerData };
