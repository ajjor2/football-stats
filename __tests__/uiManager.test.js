import { displayGamesList } from '../js/uiManager';

// Mock the global function that would be defined in script.js
global.loadMatchDataWithId = jest.fn();

// Mock console.error and console.warn to avoid polluting test output and to assert calls
global.console.error = jest.fn();
global.console.warn = jest.fn();


describe('UI Manager Functions', () => {
    const containerId = 'testGamesContainer';

    beforeEach(() => {
        // Set up a basic DOM structure for each test
        document.body.innerHTML = `<div id="${containerId}"></div>`;
        // Clear mocks
        global.loadMatchDataWithId.mockClear();
        global.console.error.mockClear();
        global.console.warn.mockClear();
    });

    describe('displayGamesList', () => {
        test('should display title and "No games found" message when games array is null', () => {
            const title = 'Past Games';
            displayGamesList(null, containerId, title);

            const container = document.getElementById(containerId);
            expect(container.querySelector('h3').textContent).toBe(title);
            expect(container.querySelector('p').textContent).toBe('No games found.');
            expect(container.querySelector('ul')).toBeNull();
        });

        test('should display title and "No games found" message when games array is empty', () => {
            const title = 'Upcoming Games';
            displayGamesList([], containerId, title);

            const container = document.getElementById(containerId);
            expect(container.querySelector('h3').textContent).toBe(title);
            expect(container.querySelector('p').textContent).toBe('No games found.');
            expect(container.querySelector('ul')).toBeNull();
        });

        test('should display games list correctly for played games', () => {
            const title = 'Played Matches';
            const games = [
                { match_id: '101', date: '2023-10-26', team_A_name: 'Team Alpha', team_B_name: 'Team Beta', fs_A: '2', fs_B: '1', status: 'Played' },
                { match_id: '102', date: '2023-10-27', team_A_name: 'Team Charlie', team_B_name: 'Team Delta', fs_A: '0', fs_B: '0', status: 'played' } // lowercase status
            ];
            displayGamesList(games, containerId, title);

            const container = document.getElementById(containerId);
            expect(container.querySelector('h3').textContent).toBe(title);
            const listItems = container.querySelectorAll('ul li');
            expect(listItems.length).toBe(2);

            const firstLink = listItems[0].querySelector('a');
            expect(firstLink.textContent).toBe('2023-10-26: Team Alpha vs Team Beta - 2-1');
            expect(firstLink.getAttribute('href')).toBe('#');

            const secondLink = listItems[1].querySelector('a');
            expect(secondLink.textContent).toBe('2023-10-27: Team Charlie vs Team Delta - 0-0');

            // Test click event on the first link
            firstLink.click();
            expect(global.loadMatchDataWithId).toHaveBeenCalledTimes(1);
            expect(global.loadMatchDataWithId).toHaveBeenCalledWith('101');
        });

        test('should display games list correctly for fixture games (no score)', () => {
            const title = 'Fixture Matches';
            const games = [
                { match_id: '201', date: '2023-11-01', team_A_name: 'Team Echo', team_B_name: 'Team Foxtrot', status: 'Fixture' },
                { match_id: '202', date: '2023-11-02', team_A_name: 'Team Gamma', team_B_name: 'Team Hotel', status: 'fixture' } // lowercase status
            ];
            displayGamesList(games, containerId, title);

            const container = document.getElementById(containerId);
            expect(container.querySelector('h3').textContent).toBe(title);
            const listItems = container.querySelectorAll('ul li');
            expect(listItems.length).toBe(2);

            const firstLink = listItems[0].querySelector('a');
            expect(firstLink.textContent).toBe('2023-11-01: Team Echo vs Team Foxtrot');
            expect(firstLink.getAttribute('href')).toBe('#');

            const secondLink = listItems[1].querySelector('a');
            expect(secondLink.textContent).toBe('2023-11-02: Team Gamma vs Team Hotel');


            // Test click event on the second link
            secondLink.click();
            expect(global.loadMatchDataWithId).toHaveBeenCalledTimes(1);
            expect(global.loadMatchDataWithId).toHaveBeenCalledWith('202');
        });

        test('should display games list correctly for games with undefined scores (treated as fixtures for display)', () => {
            const title = 'Games with Undefined Scores';
            const games = [
                { match_id: '301', date: '2023-12-01', team_A_name: 'Team India', team_B_name: 'Team Juliett', status: 'Played' /* fs_A and fs_B undefined */ },
            ];
            displayGamesList(games, containerId, title);

            const container = document.getElementById(containerId);
            const link = container.querySelector('ul li a');
            // Scores are undefined, so should show as '-'
            expect(link.textContent).toBe('2023-12-01: Team India vs Team Juliett - -');
        });


        test('should log an error if containerId is not found', () => {
            displayGamesList([], 'nonExistentContainer', 'Error Test');
            expect(global.console.error).toHaveBeenCalledWith('Container with ID "nonExistentContainer" not found.');
        });

        test('should warn if loadMatchDataWithId is not defined globally when a link is clicked', () => {
            const title = 'Warning Test';
            const games = [{ match_id: '401', date: '2023-01-01', team_A_name: 'Team A', team_B_name: 'Team B', fs_A: '1', fs_B: '0', status: 'Played' }];

            // Temporarily undefine the global mock
            const originalLoadMatchDataWithId = global.loadMatchDataWithId;
            global.loadMatchDataWithId = undefined;

            displayGamesList(games, containerId, title);

            const container = document.getElementById(containerId);
            const link = container.querySelector('ul li a');
            link.click();

            expect(global.console.warn).toHaveBeenCalledWith('loadMatchDataWithId function is not defined globally.');

            // Restore the mock
            global.loadMatchDataWithId = originalLoadMatchDataWithId;
        });
    });
});
