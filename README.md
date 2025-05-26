# Football Player Statistics Viewer

## Project Description
The Football Player Statistics Viewer is a web application designed to display detailed statistics for football players participating in a specific match, along with match details and group standings. Users can input a Match ID to fetch and view this information. The application primarily focuses on data from the Finnish Football Association (Suomen Palloliitto) for the year 2025 (and the preceding year for some historical stats).

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

## Features
*   **Match Details**: View teams, score, date, and competition/category name.
*   **Group Standings**: Displays the current standings table for the match's group, including points, wins, losses, ties, and goal differences.
*   **Player Statistics (Current Season - 2025)**:
    *   Games played and goals scored (total and per team if multiple).
    *   Warnings and suspensions.
    *   Personal details (birth year, position, nationality, height, weight, etc., where available).
    *   Recent match history for the player within their current team context.
*   **Player Statistics (Previous Season - 2024)**: Games played and goals scored.
*   **Lineup Information**: Indicates if a player was a captain in the match.
*   **Non-Lineup Players**: Lists other registered players for the involved teams who were not part of the specified match's lineup, along with their seasonal stats.
*   **Responsive Design**: Basic responsive styling using Tailwind CSS.
*   **Error Handling**: Provides feedback for network errors, API issues, or if data is not found.

## Technologies Used
*   **HTML**: Structure of the web page.
*   **CSS**: Custom styling for elements like player cards, scrollbars, and tables (in `style.css`).
*   **JavaScript (Vanilla JS)**: Handles API interactions, data processing, and dynamic HTML content generation.
*   **Tailwind CSS**: Utility-first CSS framework for rapid UI development.
*   **Suomen Palloliiton API**: External API used as the data source.

## Data Source
All data is fetched from the **Suomen Palloliiton (Finnish Football Association) tulospalvelu API** (`https://spl.torneopal.net/taso/rest/`). The application is dependent on the availability and structure of this API.

## Potential Future Improvements
*   **Player Comparison**: Allow users to select and compare stats of two or more players side-by-side.
*   **Advanced Statistical Visualizations**: Implement charts or graphs for player and team statistics.
*   **API Response Caching**: Utilize browser caching (e.g., `localStorage` or `sessionStorage`) to store API responses temporarily, reducing redundant API calls and improving performance for recently viewed matches.
*   **Direct Links**: Provide direct links to player profiles or match reports on the official Palloliitto website if possible.
*   **User-Selectable Season**: Allow users to select the season for which they want to view statistics.
*   **Localization**: Support for multiple languages, although currently in Finnish.
*   **Enhanced Styling**: Further improvements to the visual design and user experience.
