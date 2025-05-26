module.exports = {
    // Indicates that the test environment is a node environment
    testEnvironment: 'node',
    // The directory where Jest should look for test files
    roots: ['<rootDir>/ui_tests'],
    // Test match pattern for UI tests
    testMatch: ['**/*.ui.test.js'],
    // Optional: Set a longer timeout for UI tests (e.g., 30 seconds)
    testTimeout: 30000,
    // Verbose output
    verbose: true,
};
