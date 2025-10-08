/**
 * Jest configuration (CommonJS) — used to run tests in a project that uses ESM (package.json "type": "module").
 * This file is CommonJS so Node/Jest can require it even when the project is ESM.
 */
module.exports = {
  // Run tests in Node environment by default; UI tests use their own config file.
  testEnvironment: 'node',
  // Increase default timeout to reduce flakiness for tests that may need more time
  testTimeout: 30000,
  // Roots can be used to narrow test discovery; keep default behavior
  roots: ['<rootDir>'],
};
