// js/dataProcessor.js

import { config } from './config.js'; //
import { fetchAPIData } from './apiService.js'; //

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
        gamesPlayedThisYear: 0, goalsThisYear: 0, warningsThisYear: 0, suspensionsThisYear: 0, //
        goalsByTeamThisYear: {}, gamesByTeamThisYear: {}, //
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [], //
        gamesPlayedLastSeason: 0, goalsScoredLastSeason: 0, //
        currentContextTeamDisplayKey: null // Lisätty uusi ominaisuus
    };

    if (!Array.isArray(matches)) return stats; //

    matches.forEach(pastMatch => { //
        const isCurrentSeason = pastMatch.season_id === currentSeasonId; //
        const isPreviousSeason = pastMatch.season_id === previousSeasonId; //

        if (isCurrentSeason) { //
            stats.gamesPlayedThisYear++; //
            const teamNameForGame = pastMatch.team_name || 'Tuntematon joukkue'; //
            
            let leagueName; //
            // Käytä ensisijaisesti player.teams -> primary_category.category_name kartasta
            if (pastMatch.team_id && teamIdToPrimaryCategoryNameMap[pastMatch.team_id]) { //
                leagueName = teamIdToPrimaryCategoryNameMap[pastMatch.team_id]; //
            } else {
                // Fallback: käytä ottelun omaa competition_name tai category_name
                leagueName = pastMatch.competition_name || pastMatch.category_name || 'Sarja tuntematon'; //
            }
            
            const displayKey = `${teamNameForGame} (${leagueName})`; //

            stats.gamesByTeamThisYear[displayKey] = (stats.gamesByTeamThisYear[displayKey] || 0) + 1; //

            const playerGoals = parseInt(pastMatch.player_goals) || 0; //
            stats.goalsThisYear += playerGoals; //
            if (playerGoals > 0) { //
                stats.goalsByTeamThisYear[displayKey] = (stats.goalsByTeamThisYear[displayKey] || 0) + playerGoals; //
                if (teamNameForGame && teamNameForContext && teamNameForGame === teamNameForContext) { //
                    stats.goalsForThisSpecificTeamInSeason += playerGoals; //
                }
            }
            stats.warningsThisYear += parseInt(pastMatch.player_warnings) || 0; //
            stats.suspensionsThisYear += parseInt(pastMatch.player_suspensions) || 0; //

            if (teamNameForGame && teamNameForContext && teamNameForGame === teamNameForContext) { //
                if (!stats.currentContextTeamDisplayKey) { // Aseta vain kerran
                    stats.currentContextTeamDisplayKey = displayKey;
                }
                // ... (logiikka pastMatchesDetails-listalle pysyy samana)
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
                    const tempOpponentScore = pastMatch.fs_A;  //
                    opponentScore = tempOpponentScore;        //
                    opponentTeamId = pastMatch.team_A_id; //
                }

                if (pastMatch.status === "Fixture") resultIndicator = 'fixture'; //
                else if (pastMatch.winner_id && pastMatch.winner_id !== '-' && pastMatch.winner_id !== '0') { //
                    if (pastMatch.winner_id === playerTeamId) resultIndicator = 'win'; //
                    else if (opponentTeamId && pastMatch.winner_id === opponentTeamId) resultIndicator = 'loss'; //
                    else resultIndicator = 'draw'; //
                } else { 
                    const pScore = parseInt(playerTeamScore); const oScore = parseInt(opponentScore); //
                    if (!isNaN(pScore) && !isNaN(oScore)) resultIndicator = pScore > oScore ? 'win' : (pScore < oScore ? 'loss' : 'draw'); //
                    else resultIndicator = 'draw'; //
                }
                stats.pastMatchesDetails.push({ //
                    date: pastMatch.date, opponentName: opponentName || 'N/A', playerTeamScore, opponentScore, //
                    resultIndicator, playerTeamNameInPastMatch: pastMatch.team_name || 'N/A', status: pastMatch.status //
                });
            }
        } else if (isPreviousSeason) { //
            stats.gamesPlayedLastSeason++; //
            stats.goalsScoredLastSeason += parseInt(pastMatch.player_goals) || 0; //
        }
    });
    return stats; //
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
    const defaultPlayerInfo = {  //
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
        return null;  //
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
        const teamNameForThisContext = (teamIdInMatch === fullMatchData.team_A_id)  //
                                    ? fullMatchData.team_A_name  //
                                    : (teamIdInMatch === fullMatchData.team_B_id ? fullMatchData.team_B_name :  //
                                       (playerLineupInfoFromMatch && playerLineupInfoFromMatch.team_name_from_getTeam ? playerLineupInfoFromMatch.team_name_from_getTeam : null)); //

        // UUSI: Luo teamId -> primary_category.category_name mappaus
        const teamIdToPrimaryCategoryNameMap = {}; //
        if (playerDataFromAPI.teams && Array.isArray(playerDataFromAPI.teams)) { //
            playerDataFromAPI.teams.forEach(teamEntry => { //
                const isCurrentYearTeam = teamEntry.primary_category && //
                    ((teamEntry.primary_category.competition_id && teamEntry.primary_category.competition_id.toLowerCase().includes(config.CURRENT_YEAR.substring(2))) || //
                     (teamEntry.primary_category.competition_name && teamEntry.primary_category.competition_name.includes(config.CURRENT_YEAR))); //
        
                if (isCurrentYearTeam && teamEntry.team_id && teamEntry.primary_category.category_name) { //
                    teamIdToPrimaryCategoryNameMap[teamEntry.team_id] = teamEntry.primary_category.category_name; //
                }
            });
        }
        
        // Välitä uusi kartta processPlayerMatchHistory-funktiolle
        const seasonStats = processPlayerMatchHistory( //
            playerDataFromAPI.matches,  //
            config.CURRENT_YEAR,  //
            config.PREVIOUS_YEAR,  //
            teamNameForThisContext, //
            teamIdToPrimaryCategoryNameMap // Uusi parametri //
        );
        
        let teamsThisYear = []; // Tämä logiikka pysyy samana "Joukkueet (2025)"-osiolle //
        if (playerDataFromAPI.teams && Array.isArray(playerDataFromAPI.teams)) { //
             playerDataFromAPI.teams.forEach(teamEntry => { //
                if (teamEntry.primary_category &&  //
                    ( (teamEntry.primary_category.competition_id && teamEntry.primary_category.competition_id.toLowerCase().includes(config.CURRENT_YEAR.substring(2))) ||  //
                      (teamEntry.primary_category.competition_name && teamEntry.primary_category.competition_name.includes(config.CURRENT_YEAR)) )) { //
                    // Käytetään category_name tähän listaukseen, kuten aiemmin
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

        return {  //
            ...defaultPlayerInfo, //
            name: playerName, shirtNumber: shirtNumber, birthYear: playerDataFromAPI.birthyear || 'N/A', //
            ...seasonStats, // Sisältää nyt päivitetyn goalsByTeamThisYear ja gamesByTeamThisYear //
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

export { processPlayerMatchHistory, fetchAndProcessPlayerData }; //
