import { GoogleGenAI } from "@google/genai";

export async function optimizeSeoContent(params: {
  geminiApiKey: string;
  modelName: string;
  content: string;
  locale: string;
  contentType: string;
  context: string;
}): Promise<string> {
  const { geminiApiKey, modelName, content, locale, contentType, context } =
    params;

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const prompt = `You are an SEO localization expert. Your job is to optimize translated content for search engine ranking in the target locale.

TASK: Optimize this ${contentType} for the locale "${locale}".

ORIGINAL CONTENT:
"${content}"

CONTEXT: ${context}

RULES:
1. The output must be in the language of locale "${locale}"
2. Use keywords that people ACTUALLY SEARCH FOR in "${locale}" — not just literal translations
3. For <title> tags: keep under 60 characters
4. For meta descriptions: aim for 120-160 characters
5. For headings: use natural, keyword-rich phrasing
6. For alt text: describe the image while including relevant keywords
7. Preserve the original meaning and intent
8. Output ONLY the optimized text, nothing else — no quotes, no explanation

OPTIMIZED TEXT:`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  const text = response.text?.trim();
  return text || content;
}

export async function generateHreflangTags(params: {
  geminiApiKey: string;
  modelName: string;
  baseUrl: string;
  locales: string[];
  currentPath: string;
}): Promise<string> {
  const { locales, baseUrl, currentPath } = params;

  const tags = locales
    .map(
      (locale) =>
        `<link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}${currentPath}" />`
    )
    .join("\n    ");

  const xDefault = `<link rel="alternate" hreflang="x-default" href="${baseUrl}${currentPath}" />`;

  return `    ${tags}\n    ${xDefault}`;
}

export async function generateSitemapWithLocales(params: {
  baseUrl: string;
  locales: string[];
  pages: string[];
}): Promise<string> {
  const { baseUrl, locales, pages } = params;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  for (const page of pages) {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${page}</loc>\n`;
    for (const locale of locales) {
      xml += `    <xhtml:link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}${page}" />\n`;
    }
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${page}" />\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;
  return xml;
}
