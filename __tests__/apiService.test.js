import { jest } from "@jest/globals";

// Use top-level await and ESM-safe mocking
const actualUtils = await import("../js/utils.js");
await jest.unstable_mockModule("../js/utils.js", () => ({
  ...actualUtils,
  displayError: jest.fn(),
  globalRateLimiter: jest.fn(() => true),
  endpointRateLimiters: {
    getMatch: jest.fn(() => true),
    getGroup: jest.fn(() => true),
    getTeam: jest.fn(() => true),
    getPlayer: jest.fn(() => true),
  },
}));

// Now import the module under test (after mocking)
const { fetchMatchDetails } = await import("../js/apiService.js");
const utils = await import("../js/utils.js");

// Mock fetch globally
global.fetch = jest.fn();

describe("API Service Functions", () => {
  beforeEach(() => {
    fetch.mockClear();
    // Clear mock usage for displayError if needed, or other mocked utils
    if (
      utils.displayError &&
      typeof utils.displayError.mockClear === "function"
    )
      utils.displayError.mockClear();
  });

  describe("fetchMatchDetails", () => {
    test("should call fetch with correct params and return match data on success", async () => {
      const mockMatch = { id: "123", name: "Test Match" };
      // Mock the successful response for the 'getMatch' call specifically
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ call: { status: "ok" }, match: mockMatch }),
      });

      const matchId = "123";
      const data = await fetchMatchDetails(matchId);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toContain("getMatch?match_id=123");
      expect(data).toEqual(mockMatch);
      expect(utils.displayError).not.toHaveBeenCalled();
    });

    test("should return null and call displayError on fetch failure (response not ok)", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "Not Found" } }), // Mock error response
      });

      const matchId = "404";
      const data = await fetchMatchDetails(matchId);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(data).toBeNull();
      expect(utils.displayError).toHaveBeenCalledWith(
        expect.stringContaining(`Ottelun ${matchId} tietojen haku epäonnistui`)
      );
    });

    test("should return null and call displayError on API error (call.status not ok)", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ call: { status: "API Error" } }),
      });

      const matchId = "api-error-test";
      const data = await fetchMatchDetails(matchId);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(data).toBeNull();
      expect(utils.displayError).toHaveBeenCalledWith(
        expect.stringContaining(`Ottelun ${matchId} tietojen haku epäonnistui`)
      );
    });

    test("should return null and call displayError if match data is invalid (missing match property)", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ call: { status: "ok" } }), // Response missing 'match'
      });

      const matchId = "invalid-data-test";
      const data = await fetchMatchDetails(matchId);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(data).toBeNull();
      expect(utils.displayError).toHaveBeenCalledWith(
        expect.stringContaining(`Match data is invalid for match ID ${matchId}`)
      );
    });
  });
});
