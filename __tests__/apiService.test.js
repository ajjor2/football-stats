import { fetchMatchDetails } from '../js/apiService.js';
// import { config } from '../js/config.js'; // Not strictly needed for this specific test, but good for consistency
// Mocking utils that might be called, like displayError
jest.mock('../js/utils.js', () => ({
    ...jest.requireActual('../js/utils.js'), // Import and retain default behavior for other utils
    displayError: jest.fn(), // Mock displayError
    globalRateLimiter: jest.fn(() => true), // Mock globalRateLimiter to always allow calls
    endpointRateLimiters: { // Mock endpointRateLimiters to always allow calls
        getMatch: jest.fn(() => true),
        getGroup: jest.fn(() => true),
        getTeam: jest.fn(() => true),
        getPlayer: jest.fn(() => true),
    }
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('API Service Functions', () => {
    beforeEach(() => {
        fetch.mockClear();
        // Clear mock usage for displayError if needed, or other mocked utils
        require('../js/utils.js').displayError.mockClear();
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
            expect(require('../js/utils.js').displayError).toHaveBeenCalledWith(expect.stringContaining(`Match data is invalid for match ID ${matchId}`));
        });
    });
});
