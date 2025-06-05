// js/uiManager.js

import { config } from './config.js';
import { createStatItemHtml } from './utils.js';
import { fetchAndProcessPlayerData } from './dataProcessor.js';

// Olemassa olevat funktiot (createPlayerStatCardElement, displayMatchInfo, jne.)
// ... (kaikki aiemmat funktiot ovat tässä muuttumattomina) ...

/**
 * UUSI FUNKTIO
 * Displays a team's upcoming and past matches as clickable links.
 * @param {Object} teamDetails - The team object from the API, including team_name and matches array.
 * @param {HTMLElement} container - The DOM element to render the schedule into.
 */
function displayTeamSchedule(teamDetails, container) {
    const matches = teamDetails.matches || [];

    // Suodatetaan ja lajitellaan ottelut
    const upcomingMatches = matches
        .filter(m => m.status === 'Fixture')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const pastMatches = matches
        .filter(m => m.status === 'Played')
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Aputoiminto linkin luomiseen
    const createMatchLinkHTML = (match) => {
        let textContent = `${match.date}: ${match.team_A_name} vs ${match.team_B_name}`;
        if (match.status === 'Played' && match.fs_A !== undefined && match.fs_B !== undefined) {
            textContent += ` (${match.fs_A}-${match.fs_B})`;
        }
        // Linkki ohjaa sivulle uudelleen matchid-parametrilla, hyödyntäen olemassa olevaa logiikkaa
        return `<a href="?matchid=${match.match_id}" class="block p-3 bg-gray-50 hover:bg-blue-100 rounded-lg shadow-sm border border-gray-200 transition-colors duration-150 ease-in-out">
                    ${textContent}
                </a>`;
    };

    // Luodaan lopullinen HTML
    const scheduleHTML = `
        <div class="p-4 sm:p-6 bg-white rounded-lg shadow-md">
            <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 text-center">${teamDetails.team_name} - Otteluohjelma</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 class="text-xl font-semibold text-gray-700 mb-3 pb-2 border-b">Tulevat Ottelut</h3>
                    <div class="space-y-3">
                        ${upcomingMatches.length > 0
                            ? upcomingMatches.map(createMatchLinkHTML).join('')
                            : '<p class="text-gray-500">Ei tulevia otteluita.</p>'
                        }
                    </div>
                </div>
                <div>
                    <h3 class="text-xl font-semibold text-gray-700 mb-3 pb-2 border-b">Menneet Ottelut</h3>
                    <div class="space-y-3">
                        ${pastMatches.length > 0
                            ? pastMatches.map(createMatchLinkHTML).join('')
                            : '<p class="text-gray-500">Ei pelattuja otteluita.</p>'
                        }
                    </div>
                </div>
            </div>
        </div>
    `;

    if (container) {
        // Tyhjennetään muut näkymät, joita ei tarvita tässä
        document.getElementById('matchInfo').innerHTML = '';
        document.getElementById('groupInfoContainer').innerHTML = '';
        document.getElementById('playerStatsContainer').innerHTML = '';

        // Näytetään otteluohjelma
        container.innerHTML = scheduleHTML;
        container.classList.remove('hidden');
    }
}


export {
    createPlayerStatCardElement,
    displayMatchInfo,
    displayGroupInfoAndStandings,
    processAndDisplayPlayerStats,
    displayPlayerStats,
    displayPlayersNotInLineup,
    displayTeamSchedule // LISÄTTY EXPORTTI
};
