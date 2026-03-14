import { GoogleGenAI } from "@google/genai";
import type { SeoIssue, SeoScore } from "@/types";

// Professional SEO standards (sourced from claude-seo skill / Google guidelines)
const SEO_STANDARDS = `
PROFESSIONAL SEO STANDARDS (follow exactly):
- Title tags: 50-60 characters. Include primary keyword near the front. Unique per page.
- Meta descriptions: 150-160 characters. Compelling summary with keyword integration. Unique per page.
- H1: Exactly one per page. Keyword-rich. Clear page topic signal.
- Alt text: 10-125 characters. Describe the actual image content. No keyword stuffing.
- Canonical: Every page needs a self-referencing canonical to prevent duplicate content.
- Hreflang: ISO 639-1 two-letter codes (e.g. "es" not "esp"), self-referencing required, x-default required.
- Schema: Use JSON-LD. Never use deprecated types: HowTo, FAQPage (non-gov/health), SpecialAnnouncement.
- E-E-A-T signals: Experience (first-hand knowledge), Expertise (credentials), Authoritativeness (citations), Trustworthiness (contact info, HTTPS).

LOCALE-SPECIFIC KEYWORD STRATEGY:
- Translations must use the keywords people ACTUALLY SEARCH for in the target locale
- "cheap flights" in en-US ≠ "vuelos baratos" in es-MX — check regional search intent
- Keyword density: 1-3% with semantic variations. Never stuff keywords.
- Common mistakes: direct translations often have zero search volume in the target market
`.trim();

// Deprecated schema types Google no longer supports for rich results
const DEPRECATED_SCHEMA = ["HowTo", "FAQPage", "SpecialAnnouncement", "CourseInfo", "ClaimReview"];

export async function optimizeSeoContent(params: {
  geminiApiKey: string;
  modelName: string;
  content: string;
  locale: string;
  contentType: string;
  context: string;
}): Promise<string> {
  const { geminiApiKey, modelName, content, locale, contentType, context } = params;

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const charLimits: Record<string, string> = {
    "title tag": "50-60 characters exactly. Include the primary search keyword near the start.",
    "meta description": "150-160 characters exactly. Write as a compelling SERP snippet that drives clicks.",
    "alt text": "10-125 characters. Describe what is visually in the image. Naturally include keywords if relevant.",
    "heading": "Use natural, keyword-rich phrasing. Exactly one H1 per page.",
  };

  const limit = charLimits[contentType] || "Follow SEO best practices for this content type.";

  const prompt = `You are a professional SEO localization specialist.

${SEO_STANDARDS}

TASK: Optimize this ${contentType} for the locale "${locale}".
LENGTH REQUIREMENT: ${limit}

CONTENT TO OPTIMIZE:
"${content}"

CONTEXT: ${context}

CRITICAL RULES:
1. Output MUST be in the language of locale "${locale}"
2. Use keywords that people actually search for in "${locale}" — not word-for-word translations
3. Adhere exactly to the character limit
4. Preserve meaning and intent from the original
5. Output ONLY the optimized text — no quotes, no explanation, no prefix

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

  // Generate correct hreflang tags following ISO 639-1 + self-referencing + x-default
  const tags = locales
    .map(
      (locale) =>
        `<link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}${currentPath}" />`
    )
    .join("\n    ");

  // x-default points to the canonical (non-locale-prefixed) URL
  const xDefault = `<link rel="alternate" hreflang="x-default" href="${baseUrl}${currentPath}" />`;

  // Self-referencing canonical
  const canonical = `<link rel="canonical" href="${baseUrl}${currentPath}" />`;

  return `    ${tags}\n    ${xDefault}\n    ${canonical}`;
}

export function generateSitemapWithLocales(params: {
  baseUrl: string;
  locales: string[];
  pages: string[];
}): string {
  const { baseUrl, locales, pages } = params;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  for (const page of pages) {
    // Each page gets entries for all locales + x-default, with bidirectional links
    for (const locale of locales) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/${locale}${page}</loc>\n`;
      // Self-referencing for this locale
      xml += `    <xhtml:link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}${page}" />\n`;
      // All other locales (bidirectional requirement)
      for (const other of locales) {
        if (other !== locale) {
          xml += `    <xhtml:link rel="alternate" hreflang="${other}" href="${baseUrl}/${other}${page}" />\n`;
        }
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${page}" />\n`;
      xml += `  </url>\n`;
    }
  }

  xml += `</urlset>`;
  return xml;
}

/**
 * Calculate an SEO score (0-100) and letter grade based on issues found.
 * Weights derived from the claude-seo skill's scoring framework.
 */
export function calculateSeoScore(issues: SeoIssue[]): SeoScore {
  // Points deducted per issue type (critical = heavy, warning = medium, info = light)
  const deductions: Record<string, number> = {
    critical: 15,
    warning: 5,
    info: 1,
  };

  // Categorize issues by area (for breakdown)
  const technical = issues.filter((i) =>
    ["missing-html-lang", "missing-canonical", "missing-viewport", "missing-hreflang"].includes(i.type)
  );
  const onPage = issues.filter((i) =>
    ["missing-title", "missing-meta-description", "missing-og-tags", "missing-twitter-tags", "unoptimized-headings"].includes(i.type)
  );
  const accessibility = issues.filter((i) =>
    ["untranslated-alt", "untranslated-aria-labels", "untranslated-sr-only"].includes(i.type)
  );
  const schema = issues.filter((i) =>
    ["invalid-schema", "missing-jsonld-localization", "missing-sitemap-locales"].includes(i.type)
  );

  function areaScore(areaIssues: SeoIssue[]): number {
    const lost = areaIssues.reduce((sum, i) => sum + (deductions[i.severity] ?? 0), 0);
    return Math.max(0, 100 - lost);
  }

  // Weighted total (matches claude-seo weight distribution)
  const breakdown = {
    technical: areaScore(technical),      // 25% weight
    onPage: areaScore(onPage),            // 25% weight
    accessibility: areaScore(accessibility), // 25% weight
    schema: areaScore(schema),            // 25% weight
  };

  const total = Math.round(
    breakdown.technical * 0.25 +
    breakdown.onPage * 0.25 +
    breakdown.accessibility * 0.25 +
    breakdown.schema * 0.25
  );

  const grade =
    total >= 90 ? "A" :
    total >= 75 ? "B" :
    total >= 60 ? "C" :
    total >= 45 ? "D" : "F";

  return { total, grade, breakdown };
}
