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

      const accountsRes = await adsense.accounts.list();

      return {
        statusCode: 200,
        body: JSON.stringify({
          tokens,
          accounts: accountsRes.data.accounts || [],
        }),
      };
    }

    // SCENARIO 2: Fetching Report
    if (providedTokens && accountId) {
      oauth2Client.setCredentials(providedTokens);

      // Generate Report
      // FIX: We only request the RAW metrics that are 100% supported.
      const report = await adsense.accounts.reports.generate({
        account: accountId,
        dateRange: "LAST_30_DAYS",
        metrics: ["ESTIMATED_EARNINGS", "PAGE_VIEWS", "IMPRESSIONS", "CLICKS"],
        dimensions: ["DOMAIN_NAME"],
        orderBy: ["+ESTIMATED_EARNINGS"],
      });

      const rawRows = report.data.rows || [];

      const formattedData = rawRows.map((row: any) => {
        // Cells order matches the 'metrics' array order above + dimensions first
        // Dimension [0] = DOMAIN_NAME
        // Metric [1] = ESTIMATED_EARNINGS
        // Metric [2] = PAGE_VIEWS
        // Metric [3] = IMPRESSIONS
        // Metric [4] = CLICKS

        const earnings = parseFloat(row.cells[1].value);
        const pageViews = parseInt(row.cells[2].value);
        const impressions = parseInt(row.cells[3].value);
        const clicks = parseInt(row.cells[4].value);

        return {
          site: row.cells[0].value,
          earnings: earnings,
          pageViews: pageViews,
          impressions: impressions,
          clicks: clicks,

          // MANUAL CALCULATION (The Fix)
          // RPM = (Earnings / Page Views) * 1000
          rpm: pageViews > 0 ? (earnings / pageViews) * 1000 : 0,

          // CTR = Clicks / Impressions
          ctr: impressions > 0 ? clicks / impressions : 0,
        };
      });

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
