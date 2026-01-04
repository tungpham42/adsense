import { Handler } from "@netlify/functions";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// Priority list of models to try
const AVAILABLE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-safeguard-20b",
];

/**
 * Recursive function to attempt chat completion.
 * Switches models on 429 (Rate Limit) or 500+ errors.
 */
async function attemptChatCompletion(
  messages: any[],
  modelIndex: number = 0
): Promise<string> {
  const currentModel = AVAILABLE_MODELS[modelIndex];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: currentModel,
      response_format: { type: "json_object" }, // Enforce JSON output
      temperature: 0.5,
    });

    return chatCompletion.choices[0].message.content || "{}";
  } catch (error: any) {
    const status = error.status || error.statusCode;
    const isRetryable = status === 429 || (status >= 500 && status < 600);
    const hasNextModel = modelIndex < AVAILABLE_MODELS.length - 1;

    if (isRetryable && hasNextModel) {
      console.warn(
        `[Groq] Model ${currentModel} failed. Switching to ${
          AVAILABLE_MODELS[modelIndex + 1]
        }...`
      );
      return attemptChatCompletion(messages, modelIndex + 1);
    }
    throw error;
  }
}

export const handler: Handler = async (event) => {
  try {
    const { adsenseData } = JSON.parse(event.body || "{}");

    // AdSense Specific Prompt
    const prompt = `
      You are a Monetization Expert. Analyze this Google AdSense data for the last 30 days.
      
      **DATA INPUT (Top Sites):**
      ${JSON.stringify(adsenseData)}

      **OBJECTIVES:**
      1. **Revenue Leakage:** Identify sites with high traffic (Page Views) but low RPM.
      2. **CTR Anomalies:** Flag sites with suspiciously high CTR (>10%) or very low CTR (<0.5%).
      3. **Actionable Advice:** Give 1 specific optimization tip.

      **OUTPUT REQUIREMENTS:**
      - Provide exactly 3 clear, professional insights.
      - Return strictly valid JSON with a single key "insights" containing an array of 3 strings.
    `;

    const result = await attemptChatCompletion([
      { role: "user", content: prompt },
    ]);

    return {
      statusCode: 200,
      body: result,
    };
  } catch (error: any) {
    console.error("Groq Analysis Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
