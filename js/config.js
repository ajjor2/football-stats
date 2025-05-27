// Configuration
const config = {
    API_BASE_URL: 'https://spl.torneopal.net/taso/rest/',
    CURRENT_YEAR: "2025",
    PREVIOUS_YEAR: (parseInt("2025") - 1).toString(),
    API_HEADERS: {
        'Accept': 'json/df8e84j9xtdz269euy3h'
    },
    NO_PLAYER_IMAGE_URL: "https://www.palloliitto.fi/sites/all/themes/palloliitto/images/no-player-image.png",
    DEFAULT_CREST_URL: "https://cdn.torneopal.net/logo/palloliitto/x.png",
    PLACEHOLDER_CREST_URL: 'https://placehold.co/40x40/e2e8f0/64748b?text=LOGO',
    // Rate limiting configuration
    RATE_LIMIT: {
        MAX_CALLS_PER_MINUTE: 60,  // Maximum API calls per minute
        MAX_CALLS_PER_ENDPOINT: {   // Endpoint-specific limits
            'getMatch': 5,
            'getGroup': 3,
            'getTeam': 5,
            'getPlayer': 50
        },
        THROTTLE_DELAY: 1000        // Minimum delay between API calls in milliseconds
    }
};

export { config };
