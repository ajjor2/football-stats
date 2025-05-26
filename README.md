# Football Player Statistics Viewer

## Project Description
The Football Player Statistics Viewer is a web application designed to display detailed statistics for football players participating in a specific match, along with match details and group standings. Users can input a Match ID to fetch and view this information. The application primarily focuses on data from the Finnish Football Association (Suomen Palloliitto) for the year 2025 (and the preceding year for some historical stats).

Recent development has focused on refactoring the codebase for better modularity by separating HTML, CSS, and JavaScript, improving code readability, and implementing both unit tests (Jest) and UI tests (Puppeteer) with automated CI/CD workflows to ensure higher code quality and maintainability. These tests verify both individual functions and the overall application behavior from a user's perspective.

## How to Use
1.  Open the `footballstats.html` file in a web browser.
2.  Find a valid **Match ID** from the Suomen Palloliiton tulospalvelu (Finnish Football Association's results service). An example ID might be `3760372`.
3.  Enter the Match ID into the input field labeled "Syötä Match ID".
4.  Click the "Hae Tiedot" (Fetch Data) button.
5.  The application will then display:
    *   Basic match information (teams, score, date, competition).
    *   Group standings if available.
    *   Detailed statistics for each player in the match lineup.
    *   A list of other players in the involved teams who were not in the specific match's lineup.

## Project Structure
The project is organized as follows:
*   `footballstats.html`: The main HTML file for the application.
*   `style.css`: Contains all CSS styles for the application.
*   `script.js`: Includes all JavaScript logic for fetching data, processing it, and dynamically updating the HTML.
*   `package.json`: Lists project metadata, dependencies (like Jest and Puppeteer for testing), and defines scripts (e.g., for running tests).
*   `package-lock.json`: Records the exact versions of dependencies.
*   `.gitignore`: Specifies intentionally untracked files that Git should ignore (e.g., `node_modules/`, log files).
*   `__tests__/`: This directory contains all unit test files.
    *   `script.test.js`: Unit tests for functions within `script.js`, particularly data processing logic.
*   `ui_tests/`: This directory contains UI test files.
    *   `main.ui.test.js`: UI tests for the main application flow, using Puppeteer.
*   `jest.config.js` (implicitly used by `npm test`): Jest configuration for unit tests.
*   `jest.ui.config.js`: Jest configuration specifically for UI tests.
*   `.github/workflows/`: This directory contains GitHub Actions workflow configurations.
    *   `ci.yml`: Defines the Continuous Integration workflow, which automatically runs both unit and UI tests on pushes and pull requests to the `main` branch.

## Running Tests
To run tests locally, you need Node.js and npm installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ajjor2/football-stats.git
    cd football-stats
    ```
2.  **Install dependencies:**
    This command will install Jest, Puppeteer, and any other development dependencies listed in `package.json`.
    ```bash
    npm install
    ```
3.  **Run Unit Tests:**
    This command executes the Jest unit tests for the JavaScript logic.
    ```bash
    npm test
    ```
    Unit test results will be displayed in the console.

4.  **Run UI Tests:**
    This command executes the Puppeteer UI tests. These tests launch a headless browser (by default) to simulate user interactions and verify the application's behavior.
    ```bash
    npm run test:ui
    ```
    UI test results will be displayed in the console. Note that UI tests typically take longer to run than unit tests. Puppeteer will download a compatible browser version if it's not already present.

Automated tests (both unit and UI) are also run via GitHub Actions whenever code is pushed to the `main` branch or a pull request is made to `main`.

## Features
*   **Match Details**: View teams, score, date, and competition/category name.
*   **Group Standings**: Displays the current standings table for the match's group.
*   **Player Statistics (Current Season - 2025 & Previous Season - 2024)**: Detailed seasonal performance, past matches, and personal details.
*   **Lineup Information**: Indicates player roles (e.g., captain).
*   **Non-Lineup Players**: Lists other registered players for the involved teams.
*   **Responsive Design**: Basic responsive styling.
*   **Error Handling**: Feedback for API issues or if data is not found.
*   **Automated Testing**: Includes unit tests for logic and UI tests for user interaction flows.

## Technologies Used
*   **HTML**: Structure of the web page.
*   **CSS**: Custom styling (in `style.css`).
*   **JavaScript (Vanilla JS)**: Handles API interactions, data processing, and dynamic HTML content generation.
*   **Tailwind CSS**: Utility-first CSS framework (CDN version used for initial styling).
*   **Node.js**: JavaScript runtime environment (used for testing environment with npm).
*   **Jest**: JavaScript testing framework used for unit and UI tests.
*   **Puppeteer**: Node library for controlling headless Chrome/Chromium, used for UI testing.
*   **GitHub Actions**: For Continuous Integration (CI) and automated testing.
*   **Suomen Palloliiton API**: External API used as the data source.

## Data Source
All data is fetched from the **Suomen Palloliiton (Finnish Football Association) tulospalvelu API** (`https://spl.torneopal.net/taso/rest/`). The application is dependent on the availability and structure of this API.

## Potential Future Improvements
*   **Player Comparison**: Allow users to select and compare stats of two or more players side-by-side.
*   **Advanced Statistical Visualizations**: Implement charts or graphs for player and team statistics.
*   **API Response Caching**: Utilize browser caching.
*   **Direct Links**: Provide direct links to player profiles or match reports on the official Palloliitto website.
*   **User-Selectable Season**: Allow users to select the season for which they want to view statistics.
*   **Localization**: Support for multiple languages.
*   **Enhanced Styling**: Further improvements to the visual design and user experience.
*   **Test Coverage**: Increase unit and UI test coverage, especially for complex UI interactions and edge cases.
*   **Accessibility (a11y) Testing**: Implement automated accessibility checks.
