import { LingoDotDevEngine } from "lingo.dev/sdk";
import { log } from "@/lib/logger";

// ── Our engine: lingo.dev SDK pointed at OUR server ──────────────────────
//
// Architecture:
//   lingo.dev SDK (apiUrl → our server)
//     ↓ calls POST /api/process/localize
//   Our route receives { sourceLocale, targetLocale, data }
//     ↓ sends to Gemini with cultural/SEO/ARIA context
//   Gemini translates intelligently
//     ↓ returns translated data
//   SDK gets translations, applies them (HTML parsing, batching, etc.)
//
// The SDK does the plumbing. Gemini does the thinking.
// No lingo.dev dashboard config needed. Any locale, any time.

let engineInstance: LingoDotDevEngine | null = null;

function getEngine(): LingoDotDevEngine {
  if (!engineInstance) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    engineInstance = new LingoDotDevEngine({
      apiKey: "lingoseo-engine", // SDK requires a key — we auth via server env
      apiUrl: `${baseUrl}/api`,  // SDK calls {apiUrl}/process/localize
    });
    log.info(`Engine connected → ${baseUrl}/api/process/localize`);
  }
  return engineInstance;
}

/**
 * Translate a single text string.
 * lingo.dev SDK → our /api/process/localize → Gemini
 */
export async function translateText(
  text: string,
  sourceLocale: string,
  targetLocale: string
): Promise<string> {
  const engine = getEngine();
  return engine.localizeText(text, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  });
}

/**
 * Translate one string to multiple locales at once.
 */
export async function batchTranslateText(
  text: string,
  sourceLocale: string,
  targetLocales: string[]
): Promise<Record<string, string>> {
  const engine = getEngine();
  return engine.batchLocalizeText(text, {
    sourceLocale: sourceLocale as any,
    targetLocales: targetLocales as any[],
  }) as unknown as Promise<Record<string, string>>;
}

/**
 * Translate an object of strings — SEO metadata, ARIA labels, etc.
 * lingo.dev SDK handles batching + chunking.
 * Our engine auto-detects context (SEO/ARIA/general) from the data.
 */
export async function translateObject(
  obj: Record<string, string>,
  sourceLocale: string,
  targetLocale: string
): Promise<Record<string, string>> {
  const engine = getEngine();
  return engine.localizeObject(obj, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  }) as Promise<Record<string, string>>;
}

/**
 * Translate full HTML while preserving all markup.
 * lingo.dev SDK parses the DOM, extracts text nodes, calls our engine
 * for translation, then reassembles the HTML. Best of both worlds.
 */
export async function translateHtml(
  html: string,
  sourceLocale: string,
  targetLocale: string
): Promise<string> {
  const engine = getEngine();
  return engine.localizeHtml(html, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  });
}
