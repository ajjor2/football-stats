// js/dataProcessor.js
// Data processing functions

import { config } from './config.js';
import { fetchAPIData } from './apiService.js';

/**
 * Processes a player's match history to extract season statistics.
 * @param {Array<Object>} matches - Array of match objects from player data.
 * @param {string} currentSeasonId - Identifier for the current season (usually config.CURRENT_YEAR).
 * @param {string} previousSeasonId - Identifier for the previous season (usually config.PREVIOUS_YEAR).
 * @param {string|null} teamNameForContext - Name of the team for context-specific stats (the team in the main match).
 * @returns {Object} Contains stats like gamesPlayedThisYear, goalsThisYear, etc.
 */
function processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext) {
    const stats = {
        gamesPlayedThisYear: 0, goalsThisYear: 0, warningsThisYear: 0, suspensionsThisYear: 0,
        goalsByTeamThisYear: {}, gamesByTeamThisYear: {},
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [], // Matches for teamNameForContext
        gamesForOtherTeamsThisYear: [], // New: Matches for other teams this year
        gamesPlayedLastSeason: 0, goalsScoredLastSeason: 0
    };

    if (!Array.isArray(matches)) return stats;

    matches.forEach(pastMatch => {
        const isCurrentSeason = pastMatch.season_id === currentSeasonId;
        const isPreviousSeason = pastMatch.season_id === previousSeasonId;

        if (isCurrentSeason) {
            stats.gamesPlayedThisYear++;
            const teamNameForGame = pastMatch.team_name || 'Tuntematon joukkue'; // Team player played for in this pastMatch
            stats.gamesByTeamThisYear[teamNameForGame] = (stats.gamesByTeamThisYear[teamNameForGame] || 0) + 1;

            const playerGoals = parseInt(pastMatch.player_goals) || 0;
            stats.goalsThisYear += playerGoals;
            if (playerGoals > 0) {
                stats.goalsByTeamThisYear[teamNameForGame] = (stats.goalsByTeamThisYear[teamNameForGame] || 0) + playerGoals;
            }
            stats.warningsThisYear += parseInt(pastMatch.player_warnings) || 0;
            stats.suspensionsThisYear += parseInt(pastMatch.player_suspensions) || 0;

            // Determine opponent and scores for display
            let opponentName = '', playerTeamScore = '', opponentScore = '', resultIndicator = '';
            const playerTeamIdInPastMatch = pastMatch.team_id; // ID of the team the player played for in this pastMatch
            let opponentTeamIdInPastMatch = null;

            if (playerTeamIdInPastMatch === pastMatch.team_A_id) {
                opponentName = pastMatch.team_B_name;
                playerTeamScore = pastMatch.fs_A;
                opponentScore = pastMatch.fs_B;
                opponentTeamIdInPastMatch = pastMatch.team_B_id;
            } else if (playerTeamIdInPastMatch === pastMatch.team_B_id) {
                opponentName = pastMatch.team_A_name;
                playerTeamScore = pastMatch.fs_B;
                opponentScore = pastMatch.fs_A;
                opponentTeamIdInPastMatch = pastMatch.team_A_id;
            }

            if (pastMatch.status === "Fixture") {
                 resultIndicator = 'fixture';
            } else if (pastMatch.winner_id && pastMatch.winner_id !== '-' && pastMatch.winner_id !== '0' && pastMatch.winner_id !== '') {
                if (pastMatch.winner_id === playerTeamIdInPastMatch) resultIndicator = 'win';
                else if (opponentTeamIdInPastMatch && pastMatch.winner_id === opponentTeamIdInPastMatch) resultIndicator = 'loss';
                else resultIndicator = 'draw';
            } else {
                const pScore = parseInt(playerTeamScore); const oScore = parseInt(opponentScore);
                if (!isNaN(pScore) && !isNaN(oScore)) resultIndicator = pScore > oScore ? 'win' : (pScore < oScore ? 'loss' : 'draw');
                else resultIndicator = 'draw';
            }

            const matchDetailObject = {
                date: pastMatch.date,
                time: pastMatch.time || '',
                playerTeamNameInPastMatch: teamNameForGame,
                opponentName: opponentName || 'N/A',
                playerTeamScore,
                opponentScore,
                resultIndicator,
                status: pastMatch.status,
                competition_name: pastMatch.competition_name || '',
                category_name: pastMatch.category_name || '',
                group_name: pastMatch.group_name || ''
            };

            if (teamNameForGame && teamNameForContext && teamNameForGame === teamNameForContext) {
                // This game was for the team in the main match context
                stats.goalsForThisSpecificTeamInSeason += playerGoals;
                stats.pastMatchesDetails.push(matchDetailObject);
            } else {
                // This game was for a different team during the current season
                stats.gamesForOtherTeamsThisYear.push(matchDetailObject);
            }

        } else if (isPreviousSeason) {
            stats.gamesPlayedLastSeason++;
            stats.goalsScoredLastSeason += parseInt(pastMatch.player_goals) || 0;
        }
    });
    // Sort past matches for the context team by date descending
    stats.pastMatchesDetails.sort((a, b) => new Date(`${b.date}T${b.time || '00:00:00'}`) - new Date(`${a.date}T${a.time || '00:00:00'}`));
    // Sort games for other teams by date descending
    stats.gamesForOtherTeamsThisYear.sort((a, b) => new Date(`${b.date}T${b.time || '00:00:00'}`) - new Date(`${a.date}T${a.time || '00:00:00'}`));

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
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [], gamesForOtherTeamsThisYear: [],
        gamesPlayedLastSeason: 0, goalsScoredLastSeason: 0, warningsThisYear: 0, suspensionsThisYear: 0,
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
                    // Avoid duplicating the teamNameForThisContext if it's already listed
                    if (teamEntry.team_name !== teamNameForThisContext) {
                        teamsThisYear.push(`${teamEntry.team_name} (${teamEntry.primary_category.category_name || 'Sarja tuntematon'})`);
                    }
                }
             });
        }
        // Add the context team if it's not already effectively listed via seasonStats.gamesByTeamThisYear
        if (teamNameForThisContext && !Object.keys(seasonStats.gamesByTeamThisYear).includes(teamNameForThisContext)) {
             // This case might be rare if player played for context team, but good for completeness
        } else if (teamNameForThisContext) {
            // If player played for context team, ensure it's mentioned if teamsThisYear is empty
            if (teamsThisYear.length === 0 && Object.keys(seasonStats.gamesByTeamThisYear).includes(teamNameForThisContext)) {
                 teamsThisYear.push(`${teamNameForThisContext} (Nykyinen ottelu)`);
            }
        }


        if (teamsThisYear.length === 0 && playerDataFromAPI.club_name && playerDataFromAPI.club_name !== teamNameForThisContext) {
            teamsThisYear.push(`${playerDataFromAPI.club_name} (Joukkueen tarkka sarja ${config.CURRENT_YEAR} ei tiedossa)`);
        }
        if (teamsThisYear.length === 0 && !teamNameForThisContext) { // If no context team and no other teams found
            teamsThisYear.push("Ei muita joukkueita tiedossa tälle vuodelle.");
        }


        return {
            ...defaultPlayerInfo,
            name: playerName, shirtNumber: shirtNumber, birthYear: playerDataFromAPI.birthyear || 'N/A',
            ...seasonStats,
            teamsThisYear: teamsThisYear.length > 0 ? teamsThisYear.join('<br>') : (teamNameForThisContext ? `${teamNameForThisContext} (Nykyinen ottelu)` : 'Ei muita joukkueita tiedossa.'),
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

export { processPlayerMatchHistory, fetchAndProcessPlayerData };
