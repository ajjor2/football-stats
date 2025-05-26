const puppeteer = require('puppeteer');
const path = require('path');

// Optional: Increase Jest's default timeout if UI tests are slow
// jest.setTimeout(30000); // 30 seconds, default is 5 seconds. Puppeteer tests can be slower.

describe('Football Stats UI Tests', () => {
    let browser;
    let page;
    const APP_URL = `file://${path.join(process.cwd(), 'footballstats.html')}`;
    // Using a known valid Match ID that usually returns data. 
    // The specific data might change, but the structure should be consistent.
    const VALID_MATCH_ID = '3760372'; 
    const INVALID_MATCH_ID = '000000'; // An ID that is unlikely to exist or is invalid.

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: true, 
            args: [
                '--no-sandbox', // Recommended for CI environments
                '--disable-setuid-sandbox', // Recommended for CI environments
                '--disable-dev-shm-usage' // Recommended for CI environments, overcomes limited resource problems
            ]
            // slowMo: 50, // Optional: slows down Puppeteer operations to see what's happening
        });
        page = await browser.newPage();
        
        // Increase the default navigation timeout if pages load slowly
        // page.setDefaultNavigationTimeout(60000); // 60 seconds
    });

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    test('Initial page load - elements present', async () => {
        await page.goto(APP_URL, { waitUntil: 'networkidle0' }); // Wait until network is idle
        
        const matchIdInput = await page.$('#matchIdInput');
        expect(matchIdInput).not.toBeNull();
        
        const fetchDataButton = await page.$('#fetchDataButton');
        expect(fetchDataButton).not.toBeNull();
        
        const title = await page.title();
        expect(title).toBe('Pelaajatilastot Ottelusta (Erotuomari & Ed. Kausi)');
    });

    test('Successful data fetch and display for a valid Match ID', async () => {
        await page.goto(APP_URL, { waitUntil: 'networkidle0' });
        await page.type('#matchIdInput', VALID_MATCH_ID);
        await page.click('#fetchDataButton');

        try {
            // Wait for a specific element that indicates data loading is complete.
            // #matchInfo should be populated, and specifically its h2 child.
            await page.waitForSelector('#matchInfo > h2', { timeout: 25000 }); // Increased timeout for API response

            const matchInfoContent = await page.$eval('#matchInfo', el => el.textContent);
            expect(matchInfoContent.trim()).not.toBe('');
            // Example check: Match title usually contains "vs"
            expect(matchInfoContent).toMatch(/vs/i);


            // Check if player stats container has content (cards are rendered)
            // Wait for at least one player card to appear
             await page.waitForSelector('#playerStatsContainer > .stat-card', { timeout: 25000 });
            const playerStatsCards = await page.$$('#playerStatsContainer > .stat-card');
            expect(playerStatsCards.length).toBeGreaterThan(0);

            // Check that no error message is shown (it should be hidden)
            const errorMessageIsHidden = await page.$eval('#errorMessage', el => el.classList.contains('hidden'));
            expect(errorMessageIsHidden).toBe(true);

        } catch (e) {
            // If timeouts occur, provide a more specific error message
            console.error("Timeout or error during valid Match ID test:", e.message);
            // Optionally, capture a screenshot for debugging in CI if possible
            // await page.screenshot({ path: 'error_valid_match_id.png' });
            throw e; // Re-throw the error to fail the test
        }
    }, 30000); // Test-specific timeout

    test('Handling invalid Match ID - shows error message', async () => {
        await page.goto(APP_URL, { waitUntil: 'networkidle0' });
        await page.type('#matchIdInput', INVALID_MATCH_ID);
        await page.click('#fetchDataButton');

        try {
            // Wait for error message to be visible (i.e., not having the 'hidden' class)
            await page.waitForSelector('#errorMessage:not(.hidden)', { timeout: 15000 }); // API might take time to return an error

            const errorMessageIsVisible = await page.$eval('#errorMessage', el => !el.classList.contains('hidden'));
            expect(errorMessageIsVisible).toBe(true);

            const errorMessageText = await page.$eval('#errorMessage', el => el.textContent);
            expect(errorMessageText.trim()).not.toBe('');
            // Check for a plausible error message part
            expect(errorMessageText).toMatch(/epäonnistui|ei löytynyt|virheellistä/i);


        } catch (e) {
            console.error("Timeout or error during invalid Match ID test:", e.message);
            // await page.screenshot({ path: 'error_invalid_match_id.png' });
            throw e;
        }
    }, 20000); // Test-specific timeout
});
