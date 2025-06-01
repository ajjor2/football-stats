import { fetchMatchDetails } from '../js/apiService.js';
// import { config } from '../js/config.js'; // Not strictly needed for this specific test, but good for consistency
import { fetchMatchDetails, fetchPastGames, fetchUpcomingGames } from '../js/apiService.js';
// import { config } from '../js/config.js'; // Assuming config.API_BASE_URL is used.
// For these tests, we'll focus on the query params, not the base URL itself.

// Mocking utils that might be called, like displayError and rate limiters
jest.mock('../js/utils.js', () => ({
    ...jest.requireActual('../js/utils.js'),
    displayError: jest.fn(),
    globalRateLimiter: jest.fn(() => true),
    endpointRateLimiters: {
        getMatch: jest.fn(() => true),
        getGroup: jest.fn(() => true),
        getTeam: jest.fn(() => true),
        getPlayer: jest.fn(() => true),
        getGames: jest.fn(() => true), // Add for getGames endpoint
    }
}));

// Mock config to control API_BASE_URL if it's complex or to simplify fetch call assertions
jest.mock('../js/config.js', () => ({
    config: {
        API_BASE_URL: 'https://mockapi.test/',
        API_HEADERS: { 'X-Custom-Header': 'TestValue' },
        // other config values if needed by the functions under test
        RATE_LIMIT: { THROTTLE_DELAY: 0 } // No delay for tests
    }
}));


// Mock fetch globally
global.fetch = jest.fn();

describe('API Service Functions', () => {
    const { displayError } = require('../js/utils.js');

    beforeEach(() => {
        fetch.mockClear();
        displayError.mockClear();
    });

    describe('fetchMatchDetails', () => {
        test('should call fetch with correct params and return match data on success', async () => {
            const mockMatch = { id: '123', name: 'Test Match' };
            // Mock the successful response for the 'getMatch' call specifically
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "ok" }, match: mockMatch }),
            });

            const matchId = '123';
            const data = await fetchMatchDetails(matchId);
            
            expect(fetch).toHaveBeenCalledTimes(1);
            // Check if the URL contains the correct endpoint and match_id parameter
            // The actual URL construction might involve config.API_BASE_URL which is not mocked here,
            // so we check for the essential parts.
            expect(fetch.mock.calls[0][0]).toContain('getMatch?match_id=123');
            expect(data).toEqual(mockMatch);
            expect(require('../js/utils.js').displayError).not.toHaveBeenCalled();
        });

        test('should return null and call displayError on fetch failure (response not ok)', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: { message: "Not Found" }}) // Mock error response
            });

            const matchId = '404';
            const data = await fetchMatchDetails(matchId);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(data).toBeNull();
            expect(require('../js/utils.js').displayError).toHaveBeenCalledWith(expect.stringContaining(`Ottelun ${matchId} tietojen haku epäonnistui`));
        });

        test('should return null and call displayError on API error (call.status not ok)', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "API Error" } }),
            });

            const matchId = 'api-error-test';
            const data = await fetchMatchDetails(matchId);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(data).toBeNull();
            expect(require('../js/utils.js').displayError).toHaveBeenCalledWith(expect.stringContaining(`Ottelun ${matchId} tietojen haku epäonnistui`));
        });
        
        test('should return null and call displayError if match data is invalid (missing match property)', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "ok" } }), // Response missing 'match'
            });

            const matchId = 'invalid-data-test';
            const data = await fetchMatchDetails(matchId);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(data).toBeNull();
            expect(displayError).toHaveBeenCalledWith(expect.stringContaining(`Match data is invalid for match ID ${matchId}`));
        });
    });

    describe('fetchPastGames', () => {
        const teamId = 'team123';
        const count = 3;
        const expectedGames = [{ match_id: '1', name: 'Past Game 1' }];

        test('should call fetch with correct params and return games on success', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "ok" }, games: expectedGames }),
            });

            const data = await fetchPastGames(teamId, count);

            expect(fetch).toHaveBeenCalledTimes(1);
            const fetchCall = fetch.mock.calls[0];
            expect(fetchCall[0]).toBe(`https://mockapi.test/getGames?team_id=${teamId}&status=played&sort_order=desc&limit=${count}`);
            expect(fetchCall[1]).toEqual({ headers: { 'X-Custom-Header': 'TestValue' } });
            expect(data).toEqual(expectedGames);
            expect(displayError).not.toHaveBeenCalled();
        });

        test('should return null and call displayError on fetch failure', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: { message: "Server Error" }})
            });

            const data = await fetchPastGames(teamId, count);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(data).toBeNull();
            expect(displayError).toHaveBeenCalledWith(expect.stringContaining(`Aiemmin pelattujen otteluiden haku joukkueelle ${teamId} epäonnistui`));
        });

        test('should return null and call displayError on API error (call.status not ok)', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "API Error" } }),
            });
            const data = await fetchPastGames(teamId, count);
            expect(data).toBeNull();
            expect(displayError).toHaveBeenCalledWith(expect.stringContaining(`Aiemmin pelattujen otteluiden haku joukkueelle ${teamId} epäonnistui`));
        });

        test('should return null and call displayError if games data is invalid', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "ok" } }), // Response missing 'games'
            });
            const data = await fetchPastGames(teamId, count);
            expect(data).toBeNull();
            expect(displayError).toHaveBeenCalledWith(expect.stringContaining(`Past games data is invalid for team ID ${teamId}`));
        });
    });

    describe('fetchUpcomingGames', () => {
        const teamId = 'team456';
        const count = 2;
        const expectedGames = [{ match_id: '2', name: 'Upcoming Game 1' }];

        test('should call fetch with correct params and return games on success', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "ok" }, games: expectedGames }),
            });

            const data = await fetchUpcomingGames(teamId, count);

            expect(fetch).toHaveBeenCalledTimes(1);
            const fetchCall = fetch.mock.calls[0];
            expect(fetchCall[0]).toBe(`https://mockapi.test/getGames?team_id=${teamId}&status=fixture&sort_order=asc&limit=${count}`);
            expect(fetchCall[1]).toEqual({ headers: { 'X-Custom-Header': 'TestValue' } });
            expect(data).toEqual(expectedGames);
            expect(displayError).not.toHaveBeenCalled();
        });

        test('should return null and call displayError on fetch failure', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ error: { message: "Forbidden" }})
            });

            const data = await fetchUpcomingGames(teamId, count);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(data).toBeNull();
            expect(displayError).toHaveBeenCalledWith(expect.stringContaining(`Tulevien otteluiden haku joukkueelle ${teamId} epäonnistui`));
        });

        test('should return null and call displayError on API error (call.status not ok)', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "Error from API" } }),
            });
            const data = await fetchUpcomingGames(teamId, count);
            expect(data).toBeNull();
            expect(displayError).toHaveBeenCalledWith(expect.stringContaining(`Tulevien otteluiden haku joukkueelle ${teamId} epäonnistui`));
        });

        test('should return null and call displayError if games data is invalid', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ call: { status: "ok" } }), // Response missing 'games'
            });
            const data = await fetchUpcomingGames(teamId, count);
            expect(data).toBeNull();
            expect(displayError).toHaveBeenCalledWith(expect.stringContaining(`Upcoming games data is invalid for team ID ${teamId}`));
        });
    });
});
