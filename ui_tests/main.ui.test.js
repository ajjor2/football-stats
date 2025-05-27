const puppeteer = require('puppeteer'); //
const path = require('path'); //

describe('Football Stats UI Tests', () => { //
    let browser;
    let page;
    const APP_URL = `file://${path.join(process.cwd(), 'footballstats.html')}`; //
    const VALID_MATCH_ID = '3760372'; //
    const INVALID_MATCH_ID = '000000'; //

    beforeAll(async () => { //
        browser = await puppeteer.launch({ //
            headless: true, 
            args: [ //
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage' 
            ]
        });
        page = await browser.newPage(); //
    });

    afterAll(async () => { //
        if (browser) { //
            await browser.close(); //
        }
    });

    test('Initial page load - elements present', async () => { //
        await page.goto(APP_URL, { waitUntil: 'networkidle0' }); //
        
        const matchIdInput = await page.$('#matchIdInput'); //
        expect(matchIdInput).not.toBeNull(); //
        
        const fetchDataButton = await page.$('#fetchDataButton'); //
        expect(fetchDataButton).not.toBeNull(); //
        
        const title = await page.title(); //
        expect(title).toBe('Pelaajatilastot Ottelusta (Erotuomari & Ed. Kausi)'); //
    });

    test('Successful data fetch and display for a valid Match ID', async () => { //
        await page.goto(APP_URL, { waitUntil: 'networkidle0' }); //
        await page.type('#matchIdInput', VALID_MATCH_ID); //
        
        await page.evaluate(() => { //
            if (typeof process === 'undefined') { //
                window.process = { env: { NODE_ENV: 'test' } }; //
            } else {
                process.env.NODE_ENV = 'test'; //
            }
        });
        
        console.log('Starting test with Match ID:', VALID_MATCH_ID); //
        
        await page.evaluate(() => { //
            const mockMatchResponse = { //
                match: { //
                    match_id: "3760372", //
                    team_A_id: "12345", //
                    team_B_id: "67890", //
                    team_A_name: "Team A", //
                    team_B_name: "Team B", //
                    fs_A: "2", //
                    fs_B: "1", //
                    date: "2025-05-27", //
                    category_name: "Test Category", //
                    competition_name: "Test Competition", //
                    referee_1_name: "Test Referee", //
                    lineup_A: [ { player_id: "111", player_name: "Player One", shirt_number: "1" } ], //
                    lineup_B: [ { player_id: "222", player_name: "Player Two", shirt_number: "2" } ], //
                    lineups: [ // Ensure lineups array is also present for processAndDisplayPlayerStats
                        { player_id: "111", team_id: "12345", player_name: "Player One", shirt_number: "1" },
                        { player_id: "222", team_id: "67890", player_name: "Player Two", shirt_number: "2" }
                    ]
                }
            };
            const mockPlayerData = { player: { first_name: "Test", last_name: "Player", birthyear: "2000", matches: [], teams: [] } }; //
            
            window.originalFetchAPIData = window.fetchAPIData; //
            window.fetchAPIData = async (endpoint, params) => { //
                console.log('Mock API call to:', endpoint, params); //
                if (endpoint === 'getMatch') return mockMatchResponse; //
                if (endpoint === 'getPlayer') return mockPlayerData; //
                if (endpoint === 'getGroup') return { group: { group_name: 'Test Group', teams: [], matches: [] }}; //
                // For getMatches, return empty array so lastFetchedTeamXMatches is not null but empty
                if (endpoint === 'getMatches') return { matches: [] }; 
                if (endpoint === 'getTeam') return { team: { team_id: params?.team_id, team_name: `Team ${params?.team_id}`, players: [] }};
                return { group: {}, teams: [], matches: [] }; //
            };
        });
        
        await page.click('#fetchDataButton'); //

        try {
            console.log('Waiting for data to load...'); //
            
            // MODIFIED: Wait for specific elements to be populated
            await page.waitForFunction( //
                () => {
                    const teamADisplay = document.querySelector('#matchInfo #teamANameDisplay');
                    const teamBDisplay = document.querySelector('#matchInfo #teamBNameDisplay');
                    const scoreDisplay = document.querySelector('#matchInfo #matchCenterDetails p.text-3xl'); // More specific selector for score

                    const teamAContent = teamADisplay ? teamADisplay.textContent : 'null';
                    const teamBContent = teamBDisplay ? teamBDisplay.textContent : 'null';
                    const scoreContent = scoreDisplay ? scoreDisplay.textContent : 'null';
                    // console.log(`waitForFunction check: TeamA: "${teamAContent}", TeamB: "${teamBContent}", Score: "${scoreContent}"`);
                    
                    return teamADisplay && teamADisplay.textContent.includes('Team A') &&
                           teamBDisplay && teamBDisplay.textContent.includes('Team B') &&
                           scoreDisplay && scoreDisplay.textContent.includes('2 - 1');
                },
                { timeout: 15000 } // Increased timeout slightly, just in case of slower CI
            );

            // MODIFIED: Assertions based on the new structure
            const teamAName = await page.$eval('#matchInfo #teamANameDisplay', el => el.textContent);
            expect(teamAName).toContain('Team A');

            const teamBName = await page.$eval('#matchInfo #teamBNameDisplay', el => el.textContent);
            expect(teamBName).toContain('Team B');
            
            const score = await page.$eval('#matchInfo #matchCenterDetails p.text-3xl', el => el.textContent);
            expect(score).toContain('2 - 1');

            console.log('Match info (names and score) verified.'); //
            
            // Check for player stats cards
            await page.waitForSelector('#playerStatsContainer > .stat-card', { timeout: 5000 }); //
            const playerStatsCards = await page.$$('#playerStatsContainer > .stat-card'); //
            expect(playerStatsCards.length).toBeGreaterThan(0); //

            const errorMessageIsHidden = await page.$eval('#errorMessage', el => el.classList.contains('hidden')); //
            expect(errorMessageIsHidden).toBe(true); //

        } catch (e) {
            console.error("Timeout or error during valid Match ID test:", e.message); //
            const matchInfoHTML = await page.evaluate(() => document.querySelector('#matchInfo')?.innerHTML);
            console.error("Current #matchInfo HTML during error:", matchInfoHTML?.substring(0, 500) + "...");
            throw e; //
        }
    }, 30000); //

    test('Handling invalid Match ID - shows error message', async () => { //
        await page.goto(APP_URL, { waitUntil: 'networkidle0' }); //
        await page.type('#matchIdInput', INVALID_MATCH_ID); //
        
        await page.evaluate(() => { //
            if (typeof process === 'undefined') { //
                window.process = { env: { NODE_ENV: 'test' } }; //
            } else {
                process.env.NODE_ENV = 'test'; //
            }
        });
        
        await page.evaluate(() => { //
            window.originalFetchAPIData = window.fetchAPIData; //
            window.fetchAPIData = async (endpoint) => { //
                if (endpoint === 'getMatch') { //
                    throw new Error('Ottelun tietojen haku epäonnistui'); //
                }
                throw new Error('API call failed'); //
            };
        });
        
        await page.click('#fetchDataButton'); //

        try {
            await page.waitForSelector('#errorMessage:not(.hidden)', { timeout: 15000 }); //

            const errorMessageIsVisible = await page.$eval('#errorMessage', el => !el.classList.contains('hidden')); //
            expect(errorMessageIsVisible).toBe(true); //

            const errorMessageText = await page.$eval('#errorMessage', el => el.textContent); //
            expect(errorMessageText.trim()).not.toBe(''); //
            expect(errorMessageText).toMatch(/epäonnistui|ei löytynyt|virheellistä/i); //

        } catch (e) {
            console.error("Timeout or error during invalid Match ID test:", e.message); //
            throw e; //
        }
    }, 20000); //
});
