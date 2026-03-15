import { GoogleGenAI } from "@google/genai";
import { log } from "@/lib/logger";

export const maxDuration = 60;

// This route implements the lingo.dev SDK's /process/localize contract.
// When we set apiUrl to our own server, the SDK calls this endpoint
// for ALL translations — localizeObject, localizeText, localizeHtml.
// The SDK handles batching, chunking, HTML parsing.
// We handle the brain: Gemini translates with cultural + SEO + ARIA awareness.

export async function POST(req: Request) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return Response.json({ error: "Missing GEMINI_API_KEY in server env" }, { status: 500 });
  }

  let body: {
    sourceLocale: string;
    targetLocale: string;
    data: Record<string, string>;
    params?: { fast?: boolean };
    reference?: Record<string, Record<string, string>>;
    hints?: Record<string, string>;
    sessionId?: string;
    engineId?: string;
    triggerType?: string;
    metadata?: { filePath?: string };
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourceLocale, targetLocale, data } = body;

  if (!targetLocale || !data || typeof data !== "object") {
    return Response.json({ error: "Missing targetLocale or data" }, { status: 400 });
  }

  const stringCount = Object.keys(data).length;
  if (stringCount === 0) {
    return Response.json({ data: {} });
  }

  // Detect context from content patterns
  const context = detectContext(data);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  log.info(`Engine: ${sourceLocale} → ${targetLocale} | context: ${context} | ${stringCount} strings | model: ${modelName}`);

  try {
    const translated = await translateWithGemini({
      geminiApiKey,
      modelName,
      sourceLocale: sourceLocale || "en",
      targetLocale,
      data,
      context,
    });

    log.ok(`Engine translated ${Object.keys(translated).length} strings → ${targetLocale}`);
    return Response.json({ data: translated });
  } catch (err) {
    log.err(`Engine translation failed (${sourceLocale}→${targetLocale})`, err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Translation failed" },
      { status: 500 }
    );
  }
}

// Also need /users/me for SDK's identity tracking (it calls this on init)
// We handle that in a separate route: app/api/users/me/route.ts

/**
 * Auto-detect what kind of content we're translating based on keys/values.
 * The SDK doesn't tell us — we infer from the data itself.
 */
function detectContext(data: Record<string, string>): "seo" | "aria" | "general" {
  const keys = Object.keys(data).join(" ").toLowerCase();
  const values = Object.values(data).join(" ").toLowerCase();

  // ARIA patterns: aria-label values, sr-only text
  if (keys.includes("aria") || keys.includes("sr_") || keys.includes("screen")) {
    return "aria";
  }

  // SEO patterns: title, description, og:, meta, canonical, hreflang
  if (
    keys.includes("title") || keys.includes("description") ||
    keys.includes("og:") || keys.includes("meta") ||
    keys.includes("canonical") || keys.includes("hreflang") ||
    keys.includes("alt")
  ) {
    return "seo";
  }

  // Check values for SEO-like content lengths
  const avgLen = values.length / Object.keys(data).length;
  if (avgLen < 200) return "seo"; // short strings = likely metadata

  return "general";
}

async function translateWithGemini(params: {
  geminiApiKey: string;
  modelName: string;
  sourceLocale: string;
  targetLocale: string;
  data: Record<string, string>;
  context: "seo" | "aria" | "general";
}): Promise<Record<string, string>> {
  const { geminiApiKey, modelName, sourceLocale, targetLocale, data, context } = params;

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const contextInstructions = {
    seo: `These are SEO metadata strings (page titles, meta descriptions, headings, alt text, Open Graph tags).`,
    aria: `These are ARIA accessibility labels and screen reader text. They will be read aloud by screen readers to blind and visually impaired users.`,
    general: `These are website content strings that may include SEO metadata and accessibility labels.`,
  }[context];

  const prompt = `You are a world-class localization specialist with deep expertise in SEO, web accessibility, and cultural adaptation.

SOURCE LOCALE: ${sourceLocale}
TARGET LOCALE: ${targetLocale}

WHAT YOU ARE TRANSLATING:
${contextInstructions}

YOUR EXPERTISE FOR THIS LOCALE:
You already know everything about ${targetLocale}:
- What people in this market actually type into Google (not literal translations)
- The cultural tone, formality level, and communication style
- Regional dialect preferences and local idioms
- How screen readers pronounce text in this language
- Accessibility expectations for blind users in this locale
- Which words feel trustworthy vs salesy in this culture
- Script direction, punctuation rules, compound word conventions

TRANSLATION RULES:
1. SEO strings: translate to what people ACTUALLY SEARCH for in ${targetLocale} — high search volume terms, not dictionary translations
2. ARIA/accessibility strings: write as natural spoken language a blind user would expect to hear — native-sounding, not translated
3. Titles: 50-60 characters
4. Meta descriptions: 150-160 characters
5. Never translate HTML attribute names — only values
6. Preserve any URLs, numbers, brand names, and code references exactly
7. If a string is already in the target language or is untranslatable (URL, number, code), return it unchanged
8. Use your cultural knowledge — you decide the right tone, formality, and vocabulary for ${targetLocale}

INPUT STRINGS (JSON):
${JSON.stringify(data, null, 2)}

Return ONLY a valid JSON object with the same keys and translated values. No explanation, no markdown, no code fences. Just the JSON.

TRANSLATED JSON:`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      temperature: 0.2,
    },
  });

  const raw = response.text?.trim() || "";

  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    // Validate: same keys as input
    const result: Record<string, string> = {};
    for (const key of Object.keys(data)) {
      result[key] = typeof parsed[key] === "string" ? parsed[key] : data[key];
    }
    return result;
  } catch {
    console.error("[engine] Failed to parse Gemini JSON:", cleaned);
    return data;
  }
}
