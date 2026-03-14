import * as cheerio from "cheerio";
import type { SeoIssue } from "@/types";
import { randomUUID } from "crypto";

type CheerioAPI = ReturnType<typeof cheerio.load>;

// Scan for missing or empty <title>
export function scanTitle(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const title = $("title");

  if (title.length === 0) {
    issues.push({
      id: randomUUID(),
      type: "missing-title",
      severity: "critical",
      filePath,
      message: "Missing <title> tag — critical for SEO ranking",
    });
  } else if (!title.text().trim()) {
    issues.push({
      id: randomUUID(),
      type: "missing-title",
      severity: "critical",
      filePath,
      message: "Empty <title> tag — search engines need descriptive titles",
      currentValue: "",
    });
  }

  return issues;
}

// Scan for missing meta description
export function scanMetaDescription(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const metaDesc = $('meta[name="description"]');

  if (metaDesc.length === 0) {
    issues.push({
      id: randomUUID(),
      type: "missing-meta-description",
      severity: "critical",
      filePath,
      message:
        "Missing <meta name='description'> — affects click-through rate in search results",
    });
  } else {
    const content = metaDesc.attr("content") || "";
    if (!content.trim()) {
      issues.push({
        id: randomUUID(),
        type: "missing-meta-description",
        severity: "critical",
        filePath,
        message: "Empty meta description content",
        currentValue: "",
      });
    } else if (content.length < 50) {
      issues.push({
        id: randomUUID(),
        type: "missing-meta-description",
        severity: "warning",
        filePath,
        message: `Meta description too short (${content.length} chars, recommend 120-160)`,
        currentValue: content,
      });
    }
  }

  return issues;
}

// Scan for missing Open Graph tags
export function scanOgTags(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const requiredOg = ["og:title", "og:description", "og:image"];

  for (const tag of requiredOg) {
    const meta = $(`meta[property="${tag}"]`);
    if (meta.length === 0) {
      issues.push({
        id: randomUUID(),
        type: "missing-og-tags",
        severity: "warning",
        filePath,
        message: `Missing ${tag} — affects social media sharing previews`,
      });
    }
  }

  return issues;
}

// Scan for missing Twitter Card tags
export function scanTwitterTags(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const card = $('meta[name="twitter:card"]');

  if (card.length === 0) {
    issues.push({
      id: randomUUID(),
      type: "missing-twitter-tags",
      severity: "info",
      filePath,
      message: "Missing twitter:card meta tag",
    });
  }

  return issues;
}

// Scan for missing hreflang alternate links
export function scanHreflang(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const hreflangs = $('link[rel="alternate"][hreflang]');

  if (hreflangs.length === 0) {
    issues.push({
      id: randomUUID(),
      type: "missing-hreflang",
      severity: "critical",
      filePath,
      message:
        "No hreflang tags found — Google cannot associate locale-specific pages, causing duplicate content penalties",
    });
  }

  return issues;
}

// Scan for untranslated alt text on images
export function scanAltText(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  $("img").each((_, el) => {
    const alt = $(el).attr("alt");
    if (!alt || !alt.trim()) {
      issues.push({
        id: randomUUID(),
        type: "untranslated-alt",
        severity: "warning",
        filePath,
        message: `Image missing alt text — bad for accessibility and image SEO`,
        currentValue: $(el).attr("src") || "unknown",
      });
    }
  });

  return issues;
}

// Scan for missing <html lang="">
export function scanHtmlLang(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const html = $("html");

  if (html.length > 0) {
    const lang = html.attr("lang");
    if (!lang || !lang.trim()) {
      issues.push({
        id: randomUUID(),
        type: "missing-html-lang",
        severity: "critical",
        filePath,
        message:
          "Missing lang attribute on <html> — screen readers and search engines need this",
      });
    }
  }

  return issues;
}

// Scan for heading optimization
export function scanHeadings(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const h1s = $("h1");

  if (h1s.length === 0) {
    issues.push({
      id: randomUUID(),
      type: "unoptimized-headings",
      severity: "warning",
      filePath,
      message: "No <h1> tag found — primary heading is critical for page SEO",
    });
  } else if (h1s.length > 1) {
    issues.push({
      id: randomUUID(),
      type: "unoptimized-headings",
      severity: "info",
      filePath,
      message: `Multiple <h1> tags found (${h1s.length}) — recommend single H1 per page`,
    });
  }

  return issues;
}

// Scan for untranslated aria-label attributes (screen reader text)
export function scanAriaLabels(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const ariaElements = $("[aria-label]").toArray();

  const untranslated = ariaElements.filter((el) => {
    const val = $(el).attr("aria-label") || "";
    // Flag if it has text but no data-aria-* locale translations yet
    const hasTranslations = Object.keys((el as any).attribs || {}).some((k) =>
      k.startsWith("data-aria-")
    );
    return val.trim().length > 0 && !hasTranslations;
  });

  if (untranslated.length > 0) {
    issues.push({
      id: randomUUID(),
      type: "untranslated-aria-labels",
      severity: "warning",
      filePath,
      message: `${untranslated.length} element(s) have aria-label text not translated — blind users in other locales hear English screen reader output`,
      currentValue: untranslated
        .map((el) => `"${$(el).attr("aria-label")}"`)
        .slice(0, 3)
        .join(", "),
    });
  }

  return issues;
}

// Scan for untranslated sr-only / visually-hidden text
export function scanSrOnly(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  // Common screen-reader-only class patterns
  const srSelectors = [
    ".sr-only",
    ".visually-hidden",
    ".screen-reader-only",
    ".screen-reader-text",
    '[class*="sr-only"]',
    '[class*="visually-hidden"]',
  ];

  const srElements = $(srSelectors.join(", ")).toArray();

  const untranslated = srElements.filter((el) => {
    const text = $(el).text().trim();
    const hasTranslations = Object.keys((el as any).attribs || {}).some((k) =>
      k.startsWith("data-sr-")
    );
    return text.length > 0 && !hasTranslations;
  });

  if (untranslated.length > 0) {
    issues.push({
      id: randomUUID(),
      type: "untranslated-sr-only",
      severity: "warning",
      filePath,
      message: `${untranslated.length} sr-only element(s) contain untranslated text — this text exists ONLY for screen reader users and is never translated`,
      currentValue: untranslated
        .map((el) => `"${$(el).text().trim()}"`)
        .slice(0, 3)
        .join(", "),
    });
  }

  return issues;
}

// Run all HTML scanners
export function runAllScanners(
  filePath: string,
  html: string
): SeoIssue[] {
  const $ = cheerio.load(html);

  return [
    ...scanTitle(filePath, $),
    ...scanMetaDescription(filePath, $),
    ...scanOgTags(filePath, $),
    ...scanTwitterTags(filePath, $),
    ...scanHreflang(filePath, $),
    ...scanAltText(filePath, $),
    ...scanHtmlLang(filePath, $),
    ...scanHeadings(filePath, $),
    ...scanAriaLabels(filePath, $),
    ...scanSrOnly(filePath, $),
  ];
}
