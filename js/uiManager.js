// js/uiManager.js

import { config } from './config.js';
import { createStatItemHtml } from './utils.js';
import { fetchAndProcessPlayerData } from './dataProcessor.js';


// Apufunktio päivämäärän formatoimiseksi (YYYY-MM-DD -> DD.MM.YYYY)
// Voidaan myöhemmin siirtää utils.js-tiedostoon, jos tarvitaan laajemmin.
function formatDateToFinnish(dateString) {
    if (!dateString || dateString === "0000-00-00" || dateString.length !== 10) return ''; // Perusvalidointi
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return ''; // Palauta tyhjä, jos formaatti on odottamaton
}

/**
 * Creates the HTML element for a player statistics card.
 * @param {Object} stats - The player's statistics object.
 * @returns {HTMLElement} - The card element.
 */
function createPlayerStatCardElement(stats) {
    const card = document.createElement('div');
    card.className = 'stat-card bg-white border border-gray-200 p-5 rounded-lg shadow-lg hover:shadow-xl';

    const playerImageHtml = (stats.img_url && stats.img_url !== config.NO_PLAYER_IMAGE_URL)
        ? `<img src="${stats.img_url}" alt="Pelaajan kuva" class="player-image" onerror="this.style.display='none';">`
        : '';

    const crestUrl = (stats.clubCrest && stats.clubCrest !== config.DEFAULT_CREST_URL)
        ? stats.clubCrest
        : config.PLACEHOLDER_CREST_URL;

    let goalsDisplayContent;
    const goalsBreakdownKeys = stats.goalsByTeamThisYear ? Object.keys(stats.goalsByTeamThisYear) : [];
    if (stats.goalsThisYear > 0 && goalsBreakdownKeys.length > 0) {
        goalsDisplayContent = Object.entries(stats.goalsByTeamThisYear)
            .map(([displayKey, data]) => { // data is { count: X, lastPlayedDate: "YYYY-MM-DD" }
                const finnishDate = formatDateToFinnish(data.lastPlayedDate);
                const dateText = finnishDate ? ` - Viim. pelattu ${finnishDate}` : '';
                return `${displayKey}${dateText}: ${data.count}`;
            })
            .join('<br>');
        if (goalsBreakdownKeys.length > 1) {
             goalsDisplayContent += `<br><b>Yhteensä: ${stats.goalsThisYear}</b>`;
        }
    } else {
        goalsDisplayContent = stats.goalsThisYear.toString();
    }

    let gamesPlayedDisplayContent;
    const gamesBreakdownKeys = stats.gamesByTeamThisYear ? Object.keys(stats.gamesByTeamThisYear) : [];
    if (stats.gamesPlayedThisYear > 0 && gamesBreakdownKeys.length > 0) {
        gamesPlayedDisplayContent = Object.entries(stats.gamesByTeamThisYear)
            .map(([displayKey, data]) => { // data is { count: X, lastPlayedDate: "YYYY-MM-DD" }
                const finnishDate = formatDateToFinnish(data.lastPlayedDate);
                const dateText = finnishDate ? ` - Viim. pelattu ${finnishDate}` : '';
                return `${displayKey}${dateText}: ${data.count}`;
            })
            .join('<br>');
        if (gamesBreakdownKeys.length > 1) {
             gamesPlayedDisplayContent += `<br><b>Yhteensä: ${stats.gamesPlayedThisYear}</b>`;
        }
    } else {
        gamesPlayedDisplayContent = stats.gamesPlayedThisYear.toString();
    }

    let additionalInfoHtmlSegments = [];
    const fieldsToShow = [
        { key: 'position_fi', label: 'Pelipaikka' }, { key: 'height', label: 'Pituus', suffix: ' cm' },
        { key: 'weight', label: 'Paino', suffix: ' kg' }, { key: 'finland_raised', label: 'Suomessa kasvanut', displayValue: 'Kyllä' },
        { key: 'added', label: 'Lisätty joukkueeseen' }, { key: 'removed', label: 'Poistettu joukkueesta' },
        { key: 'dual_representation', label: 'Kaksoisedustus' }, { key: 'dual_1_representation', label: 'Kaksoisedustus (1)' },
        { key: 'dual_2_representation', label: 'Kaksoisedustus (2)' }, { key: 'overage', label: 'Yli-ikäisyys' },
        { key: 'parallel_representation', label: 'Rinnakkaisedustus' }, { key: 'exception_representation', label: 'Poikkeuslupa' }
    ];
    if (stats.isCaptainInMatch) {
        fieldsToShow.splice(4, 0, { key: 'isCaptainInMatch', label: 'Kapteeni tässä ottelussa', displayValue: 'Kyllä' });
    }

    fieldsToShow.forEach(field => {
        let value = stats[field.key];
        let displayValue = value;
        if (field.displayValue) {
            if (value === true || String(value) === "1") displayValue = field.displayValue;
            else return;
        }
        if (field.suffix && String(value) !== '0' && value) {
             displayValue += field.suffix;
        }
        additionalInfoHtmlSegments.push(createStatItemHtml(field.label, displayValue));
    });
    const additionalInfoHtml = additionalInfoHtmlSegments.filter(s => s).join('');

    const suspensionsHtml = (stats.suspensionsThisYear > 0)
        ? createStatItemHtml(`Ulosajot (${config.CURRENT_YEAR})`, stats.suspensionsThisYear, "bg-gray-50 p-3 rounded-md sm:col-span-2") : '';

    const previousSeasonStatsHtml = (stats.gamesPlayedLastSeason > 0 || stats.goalsScoredLastSeason > 0)
        ? `${createStatItemHtml(`Ottelut (${config.PREVIOUS_YEAR})`, stats.gamesPlayedLastSeason)}
           ${createStatItemHtml(`Maalit (${config.PREVIOUS_YEAR})`, stats.goalsScoredLastSeason)}`
        : '';

    let pastMatchesDisplayHtml = '';
    if (stats.pastMatchesDetails && stats.pastMatchesDetails.length > 0) {
        const matchesHtml = stats.pastMatchesDetails.slice(0, 10).map(match => {
            let matchDisplay;
            if (match.status === "Fixture") {
                matchDisplay = `${match.date}: ${match.playerTeamNameInPastMatch} vs ${match.opponentName} (Tuleva)`;
            } else {
                const indicatorClass = match.resultIndicator || 'draw';
                matchDisplay = `<span class="result-indicator ${indicatorClass}"></span>
                                ${match.date}: ${match.playerTeamNameInPastMatch} vs ${match.opponentName} (${match.playerTeamScore}-${match.opponentScore})`;
            }
            return `<li class="past-match-item">${matchDisplay}</li>`;
        }).join('');
        pastMatchesDisplayHtml = `<div class="mt-4 pt-4 border-t border-gray-200 col-span-1 sm:col-span-2">
                                <h4 class="text-md font-semibold text-gray-700 mb-2">Pelatut ottelut tälle joukkueelle (${config.CURRENT_YEAR}):</h4>
                                <ul class="list-none pl-0 space-y-1">${matchesHtml}</ul></div>`;
    }

    card.innerHTML = `
        <div class="flex items-center mb-4">
            <img src="${crestUrl}" alt="Seuran logo" class="w-10 h-10 mr-3 rounded-full object-contain" onerror="this.src='${config.PLACEHOLDER_CREST_URL}'; this.onerror=null;">
            ${playerImageHtml}
            <div class="${playerImageHtml ? '' : 'ml-3'}">
                <h3 class="text-xl font-semibold text-blue-700">${stats.name} ${stats.shirtNumber !== 'N/A' ? `(#${stats.shirtNumber})` : ''}</h3>
                ${createStatItemHtml("Syntymävuosi", stats.birthYear, "text-sm text-gray-500 p-0")}
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            ${createStatItemHtml(`Joukkueet (${config.CURRENT_YEAR})`, stats.teamsThisYear)}
            ${createStatItemHtml(`Pelatut ottelut (${config.CURRENT_YEAR})`, gamesPlayedDisplayContent)}
            ${createStatItemHtml(`Maalit (${config.CURRENT_YEAR})`, goalsDisplayContent)}
            ${createStatItemHtml(`Varoitukset (${config.CURRENT_YEAR})`, stats.warningsThisYear)}
            ${suspensionsHtml}
            ${previousSeasonStatsHtml}
        </div>
        ${additionalInfoHtml ? `<div class="mt-4 pt-4 border-t border-gray-200"><h4 class="text-md font-semibold text-gray-700 mb-2">Lisätiedot:</h4><div class="additional-info-grid">${additionalInfoHtml}</div></div>` : ''}
        ${pastMatchesDisplayHtml}
    `;
    return card;
}

// ... (muu uiManager.js koodi, kuten displayMatchInfo, displayGroupInfoAndStandings, jne. pysyy ennallaan) ...
// Varmista, että kaikki tarvittavat funktiot exportataan oikein.

export {
    createPlayerStatCardElement,
    displayMatchInfo,
    displayGroupInfoAndStandings,
    processAndDisplayPlayerStats,
    displayPlayerStats,
    displayPlayersNotInLineup
};
