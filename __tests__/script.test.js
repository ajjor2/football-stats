const { processPlayerMatchHistory, config } = require('../script'); 

// Mock global browser-specific functions used in script.js
global.fetch = jest.fn();
global.URLSearchParams = jest.fn(() => ({
    toString: jest.fn(() => '') // Simple mock for toString
}));

// Mock document and its methods if other parts of script.js were to be tested
// For processPlayerMatchHistory, direct DOM interaction isn't expected,
// but if script.js itself tries to access DOM at module level, this might be needed.
// However, the environment-aware checks in script.js should prevent this.

describe('processPlayerMatchHistory', () => {
    // Use the actual config values for year constants to ensure test consistency with the script
    const currentSeasonId = config.CURRENT_YEAR; 
    const previousSeasonId = config.PREVIOUS_YEAR;
    const teamNameForContext = "Team Alpha";

    const baseStats = {
        gamesPlayedThisYear: 0, goalsThisYear: 0, warningsThisYear: 0, suspensionsThisYear: 0,
        goalsByTeamThisYear: {}, gamesByTeamThisYear: {},
        goalsForThisSpecificTeamInSeason: 0, pastMatchesDetails: [],
        gamesPlayedLastSeason: 0, goalsScoredLastSeason: 0
    };

    test('should return base stats for empty matches array', () => {
        const matches = [];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result).toEqual(baseStats);
    });

    test('should correctly calculate stats for current year only', () => {
        const matches = [
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "2", player_warnings: "1", player_suspensions: "0", date: "2025-01-01", team_A_id: "1", team_B_id: "2", team_id: "1", fs_A: "3", fs_B: "0", winner_id: "1", team_B_name:"Opponent1", status: "Played" },
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "1", player_warnings: "0", player_suspensions: "1", date: "2025-01-08", team_A_id: "1", team_B_id: "3", team_id: "1", fs_A: "1", fs_B: "1", winner_id: "-", team_B_name:"Opponent2", status: "Played" },
            { season_id: currentSeasonId, team_name: "Other Team", player_goals: "5", player_warnings: "0", player_suspensions: "0", date: "2025-01-15", status: "Played" }, // Should not count towards goalsForThisSpecificTeamInSeason
        ];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result.gamesPlayedThisYear).toBe(3);
        expect(result.goalsThisYear).toBe(2 + 1 + 5);
        expect(result.warningsThisYear).toBe(1);
        expect(result.suspensionsThisYear).toBe(1);
        expect(result.goalsForThisSpecificTeamInSeason).toBe(3);
        expect(result.goalsByTeamThisYear[teamNameForContext]).toBe(3);
        expect(result.goalsByTeamThisYear["Other Team"]).toBe(5);
        expect(result.gamesByTeamThisYear[teamNameForContext]).toBe(2);
        expect(result.gamesByTeamThisYear["Other Team"]).toBe(1);
        expect(result.pastMatchesDetails.length).toBe(2);
        expect(result.pastMatchesDetails[0].opponentName).toBe("Opponent1");
        expect(result.pastMatchesDetails[1].opponentName).toBe("Opponent2");
        expect(result.gamesPlayedLastSeason).toBe(0);
        expect(result.goalsScoredLastSeason).toBe(0);
    });

    test('should correctly calculate stats for previous year only', () => {
        const matches = [
            { season_id: previousSeasonId, player_goals: "3", player_warnings: "0", player_suspensions: "0", status: "Played" },
            { season_id: previousSeasonId, player_goals: "1", player_warnings: "0", player_suspensions: "0", status: "Played" },
        ];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result.gamesPlayedThisYear).toBe(0);
        expect(result.goalsThisYear).toBe(0);
        expect(result.gamesPlayedLastSeason).toBe(2);
        expect(result.goalsScoredLastSeason).toBe(4);
        expect(result.pastMatchesDetails.length).toBe(0);
    });

    test('should correctly calculate stats for mixed years', () => {
        const matches = [
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "2", date: "2025-02-01", team_A_id: "1", team_B_id: "2", team_id: "1", fs_A: "2", fs_B: "2", winner_id: "0", team_B_name:"OpponentDraw", status: "Played"},
            { season_id: previousSeasonId, player_goals: "4", status: "Played" },
            { season_id: currentSeasonId, team_name: "Another Team", player_goals: "1", status: "Played"},
            { season_id: previousSeasonId, player_goals: "1", status: "Played" },
        ];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result.gamesPlayedThisYear).toBe(2);
        expect(result.goalsThisYear).toBe(3); // 2 + 1
        expect(result.goalsForThisSpecificTeamInSeason).toBe(2);
        expect(result.pastMatchesDetails.length).toBe(1);
        expect(result.pastMatchesDetails[0].opponentName).toBe("OpponentDraw");
        expect(result.pastMatchesDetails[0].resultIndicator).toBe("draw");
        expect(result.gamesPlayedLastSeason).toBe(2);
        expect(result.goalsScoredLastSeason).toBe(5); // 4 + 1
    });

    test('should return zero for stats if no relevant matches', () => {
        const matches = [
            { season_id: "2023", player_goals: "10" }, // Year not current or previous
            { season_id: "2022", player_goals: "5" },
        ];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result).toEqual(baseStats);
    });

    test('should correctly filter pastMatchesDetails for teamNameForContext', () => {
        const matches = [
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "1", date: "2025-03-01", team_A_id: "1", team_B_id: "4", team_id: "1", fs_A:"1", fs_B:"0", winner_id:"1", team_B_name:"ContextOpponent", status: "Played"},
            { season_id: currentSeasonId, team_name: "Wrong Team", player_goals: "2", date: "2025-03-08", status: "Played"},
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "0", date: "2025-03-15", team_A_id: "5", team_B_id: "1", team_id: "1", fs_A:"0", fs_B:"3", winner_id:"5", team_A_name:"ContextOpponent2", status: "Played"},
        ];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result.pastMatchesDetails.length).toBe(2);
        expect(result.pastMatchesDetails.find(m => m.opponentName === "ContextOpponent")).toBeTruthy();
        expect(result.pastMatchesDetails.find(m => m.opponentName === "ContextOpponent2")).toBeTruthy();
        expect(result.goalsForThisSpecificTeamInSeason).toBe(1);
    });
    
    test('should handle matches with missing player_goals, player_warnings, player_suspensions by treating them as 0', () => {
        const matches = [
            { season_id: currentSeasonId, team_name: teamNameForContext, date: "2025-04-01", status: "Played" }, // Missing all player stats
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "1", date: "2025-04-08", status: "Played" },
        ];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result.gamesPlayedThisYear).toBe(2);
        expect(result.goalsThisYear).toBe(1);
        expect(result.warningsThisYear).toBe(0);
        expect(result.suspensionsThisYear).toBe(0);
        expect(result.goalsForThisSpecificTeamInSeason).toBe(1);
    });

    test('pastMatchesDetails should correctly indicate win/loss/draw', () => {
        const matches = [
            // Win
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "1", date: "2025-05-01", team_A_id: "T1", team_B_id: "T2", team_id: "T1", fs_A:"2", fs_B:"1", winner_id:"T1", team_B_name:"Loser", status: "Played"},
            // Loss
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "0", date: "2025-05-08", team_A_id: "T2", team_B_id: "T1", team_id: "T1", fs_A:"3", fs_B:"0", winner_id:"T2", team_A_name:"Winner", status: "Played"},
            // Draw by score, winner_id is "0" or "-" or missing
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "1", date: "2025-05-15", team_A_id: "T1", team_B_id: "T2", team_id: "T1", fs_A:"2", fs_B:"2", winner_id:"0", team_B_name:"Drawer0", status: "Played"},
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "1", date: "2025-05-16", team_A_id: "T1", team_B_id: "T2", team_id: "T1", fs_A:"1", fs_B:"1", winner_id:"-", team_B_name:"DrawerDash", status: "Played"},
            { season_id: currentSeasonId, team_name: teamNameForContext, player_goals: "1", date: "2025-05-17", team_A_id: "T1", team_B_id: "T2", team_id: "T1", fs_A:"3", fs_B:"3", team_B_name:"DrawerNoWinner", status: "Played"},
            // Fixture
            { season_id: currentSeasonId, team_name: teamNameForContext, date: "2025-05-22", team_A_id: "T1", team_B_id: "T2", team_id: "T1", team_B_name:"FutureOpponent", status: "Fixture"},
        ];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result.pastMatchesDetails.length).toBe(6);
        expect(result.pastMatchesDetails.find(m => m.opponentName === "Loser").resultIndicator).toBe("win");
        expect(result.pastMatchesDetails.find(m => m.opponentName === "Winner").resultIndicator).toBe("loss");
        expect(result.pastMatchesDetails.find(m => m.opponentName === "Drawer0").resultIndicator).toBe("draw");
        expect(result.pastMatchesDetails.find(m => m.opponentName === "DrawerDash").resultIndicator).toBe("draw");
        expect(result.pastMatchesDetails.find(m => m.opponentName === "DrawerNoWinner").resultIndicator).toBe("draw");
        expect(result.pastMatchesDetails.find(m => m.opponentName === "FutureOpponent").resultIndicator).toBe("fixture");
    });
    
    test('should handle team_id being team_B_id for pastMatchesDetails', () => {
        const matches = [
            { 
                season_id: currentSeasonId, 
                team_name: teamNameForContext, // Player's team
                player_goals: "1", 
                date: "2025-06-01", 
                team_A_id: "OpponentTeam", // Opponent is team A
                team_B_id: "PlayerTeamCtx", // Player's team is team B
                team_id: "PlayerTeamCtx", // Player's team_id in this match
                fs_A:"7",  // Changed from "0" to "7" for debugging
                fs_B:"1", 
                winner_id:"PlayerTeamCtx", 
                team_A_name:"Opponent A",
                team_B_name: teamNameForContext, 
                status: "Played"
            },
        ];
        const result = processPlayerMatchHistory(matches, currentSeasonId, previousSeasonId, teamNameForContext);
        expect(result.pastMatchesDetails.length).toBe(1);
        expect(result.pastMatchesDetails[0].opponentName).toBe("Opponent A");
        expect(result.pastMatchesDetails[0].resultIndicator).toBe("win");
        expect(result.pastMatchesDetails[0].playerTeamScore).toBe("1");
        expect(result.pastMatchesDetails[0].opponentScore).toBe("7"); // Changed from opponentTeamScore to opponentScore to match implementation
    });
});
