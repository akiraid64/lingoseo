import { LingoDotDevEngine } from "lingo.dev/sdk";

let engineInstance: LingoDotDevEngine | null = null;

export function getLingoEngine(apiKey: string): LingoDotDevEngine {
  if (!engineInstance || (engineInstance as any).config.apiKey !== apiKey) {
    engineInstance = new LingoDotDevEngine({ apiKey });
  }
  return engineInstance;
}

/**
 * Translate a single text string using lingo.dev SDK
 */
export async function translateText(
  apiKey: string,
  text: string,
  sourceLocale: string,
  targetLocale: string
): Promise<string> {
  const engine = getLingoEngine(apiKey);
  return engine.localizeText(text, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  });
}

/**
 * Translate a text to multiple locales at once using lingo.dev SDK
 */
export async function batchTranslateText(
  apiKey: string,
  text: string,
  sourceLocale: string,
  targetLocales: string[]
): Promise<Record<string, string>> {
  const engine = getLingoEngine(apiKey);
  const results: Record<string, string> = {};

  const translations = await Promise.all(
    targetLocales.map(async (locale) => {
      const translated = await engine.localizeText(text, {
        sourceLocale: sourceLocale as any,
        targetLocale: locale as any,
      });
      return { locale, translated };
    })
  );

  for (const { locale, translated } of translations) {
    results[locale] = translated;
  }

  return results;
}

/**
 * Translate an object (preserving structure) using lingo.dev SDK
 * Perfect for translating SEO metadata objects like:
 * { title: "...", description: "...", heading: "..." }
 */
export async function translateObject(
  apiKey: string,
  obj: Record<string, string>,
  sourceLocale: string,
  targetLocale: string
): Promise<Record<string, string>> {
  const engine = getLingoEngine(apiKey);
  return engine.localizeObject(obj, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  }) as Promise<Record<string, string>>;
}

/**
 * Translate HTML content while preserving markup using lingo.dev SDK
 */
export async function translateHtml(
  apiKey: string,
  html: string,
  sourceLocale: string,
  targetLocale: string
): Promise<string> {
  const engine = getLingoEngine(apiKey);
  return engine.localizeHtml(html, {
    sourceLocale: sourceLocale as any,
    targetLocale: targetLocale as any,
  });
}
