# Changelog

## [Unreleased] - 2025-05-27

### Added
- Client-side rate limiting to prevent API abuse
  - Global rate limiting across all endpoints
  - Endpoint-specific rate limits
  - Configurable throttling delay between requests
- Test environment detection to bypass rate limiting during automated testing

### Changed
- Updated dependencies to latest stable versions
- Improved test reliability with better mocking and async handling

### Fixed
- Test failures related to asynchronous DOM updates
- Unit test assertions to match implementation
