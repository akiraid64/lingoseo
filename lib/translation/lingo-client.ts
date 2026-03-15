import { LingoDotDevEngine } from "lingo.dev/sdk";

let engineInstance: LingoDotDevEngine | null = null;

export function getLingoEngine(apiKey: string): LingoDotDevEngine {
  if (!engineInstance || (engineInstance as any).config.apiKey !== apiKey) {
    engineInstance = new LingoDotDevEngine({ apiKey });
  }
  return engineInstance;
}

/**
 * Call our custom Gemini-powered translation engine at /api/translate.
 * This gives us SEO-aware, ARIA-aware, culturally accurate translations
 * without needing to configure each locale manually in lingo.dev dashboard.
 *
 * Falls back to lingo.dev SDK if geminiApiKey is not provided.
 */
async function callOwnEngine(params: {
  lingoApiKey: string;
  geminiApiKey: string;
  obj: Record<string, string>;
  sourceLocale: string;
  targetLocale: string;
  context: "seo" | "aria" | "general";
  modelName?: string;
}): Promise<Record<string, string>> {
  const { geminiApiKey, obj, sourceLocale, targetLocale, context, modelName } = params;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gemini-api-key": geminiApiKey,
    },
    body: JSON.stringify({
      sourceLocale,
      targetLocale,
      data: obj,
      context,
      modelName: modelName || process.env.GEMINI_MODEL || "gemini-2.0-flash",
    }),
  });

  if (!res.ok) {
    throw new Error(`Engine returned ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  return json.data || obj;
}

/**
 * Translate a single text string.
 * Uses our Gemini engine if geminiApiKey provided, else lingo.dev SDK.
 */
export async function translateText(
  lingoApiKey: string,
  text: string,
  sourceLocale: string,
  targetLocale: string,
  geminiApiKey?: string,
  modelName?: string
): Promise<string> {
  if (geminiApiKey) {
    const result = await callOwnEngine({
      lingoApiKey,
      geminiApiKey,
      obj: { value: text },
      sourceLocale,
      targetLocale,
      context: "general",
      modelName,
    });
    return result.value || text;
  }

  const engine = getLingoEngine(lingoApiKey);
  return engine.localizeText(text, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  });
}

/**
 * Translate one string to multiple locales at once.
 */
export async function batchTranslateText(
  lingoApiKey: string,
  text: string,
  sourceLocale: string,
  targetLocales: string[],
  geminiApiKey?: string,
  modelName?: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  await Promise.all(
    targetLocales.map(async (locale) => {
      results[locale] = await translateText(
        lingoApiKey,
        text,
        sourceLocale,
        locale,
        geminiApiKey,
        modelName
      );
    })
  );

  return results;
}

/**
 * Translate an object of strings — SEO metadata, ARIA labels, etc.
 * Uses our Gemini engine (SEO/ARIA aware + culturally intelligent).
 * Falls back to lingo.dev SDK if no Gemini key.
 */
export async function translateObject(
  lingoApiKey: string,
  obj: Record<string, string>,
  sourceLocale: string,
  targetLocale: string,
  geminiApiKey?: string,
  context: "seo" | "aria" | "general" = "general",
  modelName?: string
): Promise<Record<string, string>> {
  if (geminiApiKey) {
    return callOwnEngine({
      lingoApiKey,
      geminiApiKey,
      obj,
      sourceLocale,
      targetLocale,
      context,
      modelName,
    });
  }

  const engine = getLingoEngine(lingoApiKey);
  return engine.localizeObject(obj, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  }) as Promise<Record<string, string>>;
}

/**
 * Translate full HTML while preserving all markup.
 * Always uses lingo.dev SDK — localizeHtml is its strongest feature.
 */
export async function translateHtml(
  lingoApiKey: string,
  html: string,
  sourceLocale: string,
  targetLocale: string
): Promise<string> {
  const engine = getLingoEngine(lingoApiKey);
  return engine.localizeHtml(html, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  });
}
