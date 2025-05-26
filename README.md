# Football Player Statistics Viewer

## Project Description
The Football Player Statistics Viewer is a web application designed to display detailed statistics for football players participating in a specific match, along with match details and group standings. Users can input a Match ID to fetch and view this information. The application primarily focuses on data from the Finnish Football Association (Suomen Palloliitto) for the year 2025 (and the preceding year for some historical stats).

Recent development has focused on refactoring the codebase for better modularity by separating HTML, CSS, and JavaScript, improving code readability, and implementing unit tests with automated CI/CD workflows to ensure higher code quality and maintainability.

## How to Use
1.  Open the `footballstats.html` file in a web browser.
2.  Find a valid **Match ID** from the Suomen Palloliiton tulospalvelu (Finnish Football Association's results service). An example ID might be `3760372`.
3.  Enter the Match ID into the input field labeled "Syötä Match ID".
4.  Click the "Hae Tiedot" (Fetch Data) button.
5.  The application will then display:
    *   Basic match information (teams, score, date, competition).
    *   Group standings if available.
    *   Detailed statistics for each player in the match lineup, including seasonal performance, past matches for their current team, and personal details.
    *   A list of other players in the involved teams who were not in the specific match's lineup.

## Project Structure
The project is organized as follows:
*   `footballstats.html`: The main HTML file for the application.
*   `style.css`: Contains all CSS styles for the application.
*   `script.js`: Includes all JavaScript logic for fetching data, processing it, and dynamically updating the HTML.
*   `package.json`: Lists project metadata, dependencies (like Jest for testing), and defines scripts (e.g., for running tests).
*   `package-lock.json`: Records the exact versions of dependencies.
*   `.gitignore`: Specifies intentionally untracked files that Git should ignore (e.g., `node_modules/`, log files).
*   `__tests__/`: This directory contains all unit test files.
    *   `script.test.js`: Unit tests for functions within `script.js`, particularly data processing logic.
*   `.github/workflows/`: This directory contains GitHub Actions workflow configurations.
    *   `ci.yml`: Defines the Continuous Integration workflow, which automatically runs tests on pushes and pull requests to the `main` branch.

## Running Tests
To run the unit tests locally, you need Node.js and npm installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ajjor2/football-stats.git
    cd football-stats
    ```
2.  **Install dependencies:**
    This command will install Jest and any other development dependencies listed in `package.json`.
    ```bash
    npm install
    ```
3.  **Run tests:**
    This command will execute the Jest test runner.
    ```bash
    npm test
    ```
    Test results will be displayed in the console.

Automated tests are also run via GitHub Actions whenever code is pushed to the `main` branch or a pull request is made to `main`.

## Features
*   **Match Details**: View teams, score, date, and competition/category name.
*   **Group Standings**: Displays the current standings table for the match's group.
*   **Player Statistics (Current Season - 2025 & Previous Season - 2024)**: Detailed seasonal performance, past matches, and personal details.
*   **Lineup Information**: Indicates player roles (e.g., captain).
*   **Non-Lineup Players**: Lists other registered players for the involved teams.
*   **Responsive Design**: Basic responsive styling.
*   **Error Handling**: Feedback for API issues or if data is not found.

## Technologies Used
*   **HTML**: Structure of the web page.
*   **CSS**: Custom styling (in `style.css`).
*   **JavaScript (Vanilla JS)**: Handles API interactions, data processing, and dynamic HTML content generation.
*   **Tailwind CSS**: Utility-first CSS framework (CDN version used for initial styling).
*   **Node.js**: JavaScript runtime environment (used for the testing environment with npm).
*   **Jest**: JavaScript testing framework used for unit tests.
*   **GitHub Actions**: For Continuous Integration (CI) and automated testing.
*   **Suomen Palloliiton API**: External API used as the data source.

## Data Source
All data is fetched from the **Suomen Palloliiton (Finnish Football Association) tulospalvelu API** (`https://spl.torneopal.net/taso/rest/`). The application is dependent on the availability and structure of this API.

## Potential Future Improvements
*   **Player Comparison**: Allow users to select and compare stats of two or more players side-by-side.
*   **Advanced Statistical Visualizations**: Implement charts or graphs for player and team statistics.
*   **API Response Caching**: Utilize browser caching (e.g., `localStorage` or `sessionStorage`) to store API responses temporarily.
*   **Direct Links**: Provide direct links to player profiles or match reports on the official Palloliitto website.
*   **User-Selectable Season**: Allow users to select the season for which they want to view statistics.
*   **Localization**: Support for multiple languages.
*   **Enhanced Styling**: Further improvements to the visual design and user experience.
*   **Test Coverage**: Increase unit test coverage for display and UI interaction functions.
