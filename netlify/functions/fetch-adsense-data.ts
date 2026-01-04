import { Handler } from "@netlify/functions";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "postmessage"
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      code,
      tokens: providedTokens,
      accountId,
    } = JSON.parse(event.body || "{}");

    // Initialize AdSense API v2
    const adsense = google.adsense({
      version: "v2",
      auth: oauth2Client,
    });

    // SCENARIO 1: First-time connection (Exchange Code for Tokens)
    if (code) {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // List available AdSense accounts (e.g., "accounts/pub-xxxxxxxx")
      const accountsRes = await adsense.accounts.list();

      return {
        statusCode: 200,
        body: JSON.stringify({
          tokens, // Return tokens to frontend to store in state/localstorage
          accounts: accountsRes.data.accounts || [],
        }),
      };
    }

    // SCENARIO 2: Fetching Report (Using stored Tokens)
    if (providedTokens && accountId) {
      oauth2Client.setCredentials(providedTokens);

      // Generate Report: Grouped by SITE (Domain Name)
      const report = await adsense.accounts.reports.generate({
        account: accountId,
        dateRange: "LAST_30_DAYS",
        metrics: [
          "ESTIMATED_EARNINGS",
          "PAGE_VIEWS",
          "IMPRESSIONS",
          "CLICKS",
          "IMPRESSION_RPM",
          "ACTIVE_VIEW_VIEWABILITY",
        ],
        dimensions: ["DOMAIN_NAME"],
        orderBy: ["+ESTIMATED_EARNINGS"], // Sort by earnings descending
      });

      // Format data for the frontend
      const rawRows = report.data.rows || [];
      const formattedData = rawRows.map((row: any) => ({
        site: row.cells[0].value,
        earnings: parseFloat(row.cells[1].value),
        pageViews: parseInt(row.cells[2].value),
        impressions: parseInt(row.cells[3].value),
        clicks: parseInt(row.cells[4].value),
        rpm: parseFloat(row.cells[5].value),
        // Calculate CTR manually (Clicks / Impressions)
        ctr:
          parseInt(row.cells[3].value) > 0
            ? parseInt(row.cells[4].value) / parseInt(row.cells[3].value)
            : 0,
      }));

      return {
        statusCode: 200,
        body: JSON.stringify({ data: formattedData }),
      };
    }

    return { statusCode: 400, body: "Missing parameters" };
  } catch (error: any) {
    console.error("AdSense API Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
