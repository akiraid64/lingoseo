import { GoogleGenAI } from "@google/genai";
import type { SeoIssue, SeoScore } from "@/types";

// ──────────────────────────────────────────────────────────────────────────
// SEO standards sourced from claude-seo skill (github.com/AgriciDaniel/claude-seo)
// Schema.org v29.4 (Dec 2025), Google Quality Rater Guidelines (Sept 2025)
// ──────────────────────────────────────────────────────────────────────────

// Deprecated/restricted schema types — never recommend
// Source: claude-seo/seo/references/schema-types.md (Feb 2026)
export const DEPRECATED_SCHEMA = new Set([
  "HowTo",                // Rich results removed Sept 2023
  "FAQPage",              // Restricted to gov/health Aug 2023
  "SpecialAnnouncement",  // Deprecated July 31, 2025
  "CourseInfo",           // Retired June 2025
  "EstimatedSalary",     // Retired June 2025
  "LearningVideo",       // Retired June 2025 (use VideoObject)
  "ClaimReview",         // Retired June 2025
  "VehicleListing",      // Retired June 2025
  "PracticeProblem",     // Retired late 2025
  "Dataset",             // Retired late 2025
]);

// Quality gates from claude-seo/seo/references/quality-gates.md
export const QUALITY_GATES = {
  title: { min: 30, max: 60 },          // Google truncates at ~60
  metaDescription: { min: 120, max: 160 }, // Google truncates at ~155-160
  altText: { min: 10, max: 125 },
  h1PerPage: 1,                           // Exactly one H1 per page
} as const;

// Hreflang validation rules from claude-seo/skills/seo-hreflang
export const HREFLANG_RULES = {
  selfReferencing: true,    // Every page must include hreflang pointing to itself
  bidirectional: true,      // A→B requires B→A
  xDefaultRequired: true,   // x-default required for fallback
  // Invalid hreflang codes people commonly get wrong
  invalidCodes: new Set(["eng", "esp", "fra", "deu", "jp", "uk", "cz", "in"]),
  // Correct mappings for common mistakes
  corrections: { jp: "ja", uk: "en-GB", cz: "cs", "in": "hi" } as Record<string, string>,
} as const;

export async function callGemini(
  geminiApiKey: string,
  modelName: string,
  prompt: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const response = await ai.models.generateContent({ model: modelName, contents: prompt });
  return response.text?.trim() || "";
}

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
    "title tag": `${QUALITY_GATES.title.min}-${QUALITY_GATES.title.max} characters. Include primary keyword near the start. Brand name at end.`,
    "meta description": `${QUALITY_GATES.metaDescription.min}-${QUALITY_GATES.metaDescription.max} characters. Compelling SERP snippet with CTA.`,
    "alt text": `${QUALITY_GATES.altText.min}-${QUALITY_GATES.altText.max} characters. Describe the actual image content. Naturally include keywords.`,
    "heading": "Use natural, keyword-rich phrasing. Exactly one H1 per page.",
  };

  const limit = charLimits[contentType] || "Follow SEO best practices for this content type.";

  const prompt = `You are a professional SEO localization specialist.

TASK: Optimize this ${contentType} for the locale "${locale}".
LENGTH REQUIREMENT: ${limit}

CONTENT TO OPTIMIZE:
"${content}"

CONTEXT: ${context}

LOCALE-SPECIFIC KEYWORD STRATEGY:
- Translations must use keywords people ACTUALLY SEARCH for in "${locale}"
- "cheap flights" in en-US ≠ "vuelos baratos" in es-MX — check regional search intent
- Common mistakes: direct translations often have zero search volume in the target market

CRITICAL RULES:
1. Output MUST be in the language of locale "${locale}"
2. Use keywords people actually search for in "${locale}" — not word-for-word translations
3. Adhere exactly to the character limit
4. Preserve meaning and intent from the original
5. NEVER translate brand names, product names, or proper nouns
6. Output ONLY the optimized text — no quotes, no explanation, no prefix

OPTIMIZED TEXT:`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  const text = response.text?.trim();
  return text || content;
}

export async function generateHreflangTags(params: {
  baseUrl: string;
  locales: string[];
  currentPath: string;
}): Promise<string> {
  const { locales, baseUrl, currentPath } = params;

  // Generate correct hreflang tags following claude-seo hreflang skill:
  // - ISO 639-1 two-letter codes
  // - Self-referencing required (each page points to itself)
  // - x-default required (fallback for unmatched languages)
  // - Bidirectional (A→B and B→A)
  const tags = locales
    .map(
      (locale) =>
        `<link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}${currentPath}" />`
    )
    .join("\n    ");

  const xDefault = `<link rel="alternate" hreflang="x-default" href="${baseUrl}${currentPath}" />`;
  const canonical = `<link rel="canonical" href="${baseUrl}${currentPath}" />`;

  return `    ${tags}\n    ${xDefault}\n    ${canonical}`;
}

export function generateSitemapWithLocales(params: {
  baseUrl: string;
  locales: string[];
  pages: string[];
}): string {
  const { baseUrl, locales, pages } = params;

  // Follows claude-seo sitemap skill:
  // - xmlns:xhtml namespace required
  // - Every <url> entry must include ALL language alternates (including itself)
  // - Each alternate appears as separate <url> with its own full set (bidirectional)
  // - x-default in every entry
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  for (const page of pages) {
    for (const locale of locales) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/${locale}${page}</loc>\n`;
      // Self-referencing + all alternates (bidirectional requirement)
      for (const alt of locales) {
        xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${baseUrl}/${alt}${page}" />\n`;
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${page}" />\n`;
      xml += `  </url>\n`;
    }
  }

  xml += `</urlset>`;
  return xml;
}

/**
 * Calculate SEO score using claude-seo skill's weighted methodology.
 *
 * Weights (adapted from claude-seo for translation focus):
 *   Technical SEO:     22%  (html-lang, canonical, viewport, hreflang)
 *   On-Page SEO:       23%  (title, meta desc, OG, twitter, headings)
 *   Accessibility:     20%  (alt text, aria-labels, sr-only)
 *   Schema:            10%  (JSON-LD, sitemap locales)
 *   i18n Readiness:    25%  (hreflang, locale detection, content translation)
 *
 * Priority levels (from claude-seo):
 *   Critical: Blocks indexing or causes penalties (immediate fix)
 *   High/Warning: Significantly impacts rankings (fix within 1 week)
 *   Medium/Info: Optimization opportunity (fix within 1 month)
 */
export function calculateSeoScore(issues: SeoIssue[]): SeoScore {
  const deductions: Record<string, number> = {
    critical: 15,
    warning: 8,
    info: 2,
  };

  const technical = issues.filter((i) =>
    ["missing-html-lang", "missing-canonical", "missing-viewport"].includes(i.type)
  );
  const onPage = issues.filter((i) =>
    ["missing-title", "missing-meta-description", "missing-og-tags", "missing-twitter-tags", "unoptimized-headings"].includes(i.type)
  );
  const accessibility = issues.filter((i) =>
    [
      "untranslated-alt", "untranslated-aria-labels", "untranslated-sr-only",
      // Structural ARIA issues
      "missing-nav-label", "missing-skip-link", "decorative-not-hidden",
      "action-link-no-role", "missing-region-label", "missing-icon-hiding",
    ].includes(i.type)
  );
  const schema = issues.filter((i) =>
    ["invalid-schema", "missing-jsonld-localization", "missing-sitemap-locales"].includes(i.type)
  );
  const i18n = issues.filter((i) =>
    ["missing-hreflang"].includes(i.type)
  );

  function areaScore(areaIssues: SeoIssue[]): number {
    const lost = areaIssues.reduce((sum, i) => sum + (deductions[i.severity] ?? 0), 0);
    return Math.max(0, 100 - lost);
  }

  // Weighted total matching claude-seo methodology
  const breakdown = {
    technical: areaScore(technical),
    onPage: areaScore(onPage),
    accessibility: areaScore(accessibility),
    schema: areaScore(schema),
  };

  const i18nScore = areaScore(i18n);

  const total = Math.round(
    breakdown.technical * 0.22 +
    breakdown.onPage * 0.23 +
    breakdown.accessibility * 0.20 +
    breakdown.schema * 0.10 +
    i18nScore * 0.25
  );

  const grade =
    total >= 90 ? "A" :
    total >= 75 ? "B" :
    total >= 60 ? "C" :
    total >= 45 ? "D" : "F";

  return { total, grade, breakdown };
}
