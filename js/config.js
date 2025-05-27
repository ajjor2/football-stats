// js/config.js
const config = {
    API_BASE_URL: 'https://spl.torneopal.net/taso/rest/',
    CURRENT_YEAR: "2025", // This will be used to set the start_date
    PREVIOUS_YEAR: (parseInt("2025") - 1).toString(),
    API_HEADERS: {
        'Accept': 'json/df8e84j9xtdz269euy3h'
        // Note: If the API requires other headers like 'User-Agent' or an API key, add them here.
    },
    NO_PLAYER_IMAGE_URL: "https://www.palloliitto.fi/sites/all/themes/palloliitto/images/no-player-image.png",
    DEFAULT_CREST_URL: "https://cdn.torneopal.net/logo/palloliitto/x.png", // Generic placeholder
    PLACEHOLDER_CREST_URL: 'https://placehold.co/40x40/e2e8f0/64748b?text=LOGO', // Fallback placeholder
    // Rate limiting configuration
    RATE_LIMIT: {
        MAX_CALLS_PER_MINUTE: 60,  // Maximum API calls per minute globally
        MAX_CALLS_PER_ENDPOINT: {   // Endpoint-specific limits (calls per minute)
            'getMatch': 5,
            'getGroup': 3,
            'getTeam': 5,
            'getPlayer': 50,
            'getMatches': 10 // Added for the new endpoint, allowing a bit more for team schedule views
        },
        THROTTLE_DELAY: 1000        // Minimum delay between API calls in milliseconds (1 second)
    }
};

export { config };
