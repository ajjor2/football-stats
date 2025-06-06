import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { fetchMatchDetails } from "../js/apiService.js"; // Adjusted path for ES Modules

async function main() {
  const matchId = process.argv[2];
  if (!matchId) {
    console.error("Usage: node scripts/generate-summary-with-sdk.js <match_id>");
    process.exit(1);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error("Error: GITHUB_TOKEN environment variable is not set.");
    process.exit(1);
  }

  const endpoint = "https://models.github.ai/inference";
  const credential = new AzureKeyCredential(githubToken); // Use token directly as key
  const client = ModelClient(endpoint, credential);

  try {
    console.log(`Fetching details for match ID: ${matchId}...`);
    // Assuming fetchMatchDetails returns an object with match data
    // { competition: 'Competition Name', homeTeam: 'Home Team', awayTeam: 'Away Team', score: '2 - 1', date: '2024-01-15', ... }
    const matchData = await fetchMatchDetails(matchId);

    if (!matchData || Object.keys(matchData).length === 0) {
      console.error("Error: No data returned from fetchMatchDetails for match ID:", matchId);
      process.exit(1);
    }

    // Check for at least some key properties to ensure data is somewhat valid
    if (!matchData.home_team_name || !matchData.away_team_name) {
        console.warn("Warning: Match data might be incomplete. Essential fields like team names are missing.");
        // Decide if you want to proceed or exit. For now, let's proceed but log the raw data for debugging.
        console.log("Raw match data:", JSON.stringify(matchData, null, 2));
    }

    console.log("Match data fetched successfully.");

    // Construct a more dynamic prompt
    const prompt = `Provide a brief summary for the football match:
Match ID: ${matchId}
Competition: ${matchData.competition || 'N/A'}
Date: ${matchData.date ? new Date(matchData.date).toLocaleDateString() : 'N/A'}
Home Team: ${matchData.home_team_name || 'N/A'}
Away Team: ${matchData.away_team_name || 'N/A'}
Score: ${matchData.status === 'Played' ? (matchData.home_score + ' - ' + matchData.away_score) : 'Not played or score unavailable'}
Status: ${matchData.status || 'N/A'}

Highlight key events or interesting facts if available in the data, otherwise provide a general summary.
`;

    console.log("\n--- Sending prompt to AI model ---");
    console.log(prompt);
    console.log("--- End of prompt ---\n");

    const modelName = "openai/gpt-4o"; // Placeholder model

    const response = await client.path("/chat/completions").post({
      body: {
        messages: [{ role: "user", content: prompt }],
        model: modelName,
        max_tokens: 200, // Adjust as needed
        temperature: 0.7, // Adjust as needed
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === "200") {
      const completion = response.body;
      if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
        console.log("--- AI Generated Summary ---");
        console.log(completion.choices[0].message.content);
      } else {
        console.error("Error: AI response did not contain the expected choices structure.");
        console.log("Full AI response:", JSON.stringify(completion, null, 2));
      }
    } else {
      console.error(`Error: AI request failed with status ${response.status}`);
      console.log("Full AI response:", JSON.stringify(response.body, null, 2));
    }

  } catch (error) {
    console.error("An error occurred:", error.message);
    if (error.stack) {
        console.error("Stacktrace:", error.stack);
    }
    // If the error is from the AI client, it might have more details
    if (error.response && error.response.body) {
        console.error("Error details from AI service:", JSON.stringify(error.response.body, null, 2));
    }
    process.exit(1);
  }
}

main();
