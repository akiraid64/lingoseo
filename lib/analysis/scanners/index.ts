import * as cheerio from "cheerio";
import type { SeoIssue } from "@/types";
import { randomUUID } from "crypto";
import { DEPRECATED_SCHEMA, QUALITY_GATES, HREFLANG_RULES } from "@/lib/translation/seo-optimizer";

type CheerioAPI = ReturnType<typeof cheerio.load>;

// Scan for missing, empty, or incorrectly sized <title>
// Standard: 50-60 characters (claude-seo / Google guidelines)
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
  } else {
    const text = title.text().trim();
    if (!text) {
      issues.push({
        id: randomUUID(),
        type: "missing-title",
        severity: "critical",
        filePath,
        message: "Empty <title> tag — search engines need descriptive titles",
        currentValue: "",
      });
    } else if (text.length < QUALITY_GATES.title.min) {
      issues.push({
        id: randomUUID(),
        type: "missing-title",
        severity: "warning",
        filePath,
        message: `Title too short (${text.length} chars) — aim for ${QUALITY_GATES.title.min}-${QUALITY_GATES.title.max} characters for full SERP display`,
        currentValue: text,
      });
    } else if (text.length > QUALITY_GATES.title.max) {
      issues.push({
        id: randomUUID(),
        type: "missing-title",
        severity: "warning",
        filePath,
        message: `Title too long (${text.length} chars) — Google truncates at ~${QUALITY_GATES.title.max} chars in search results`,
        currentValue: text,
      });
    }
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
    } else if (content.length < QUALITY_GATES.metaDescription.min) {
      issues.push({
        id: randomUUID(),
        type: "missing-meta-description",
        severity: "warning",
        filePath,
        message: `Meta description too short (${content.length} chars) — aim for ${QUALITY_GATES.metaDescription.min}-${QUALITY_GATES.metaDescription.max} characters for full SERP display`,
        currentValue: content,
      });
    } else if (content.length > QUALITY_GATES.metaDescription.max) {
      issues.push({
        id: randomUUID(),
        type: "missing-meta-description",
        severity: "info",
        filePath,
        message: `Meta description too long (${content.length} chars) — Google truncates at ~${QUALITY_GATES.metaDescription.max} chars`,
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

// Scan for missing hreflang alternate links + validate codes using claude-seo rules
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
    return issues;
  }

  // Validate individual hreflang codes
  const codes: string[] = [];
  hreflangs.each((_, el) => {
    const code = $(el).attr("hreflang") || "";
    codes.push(code);

    if (code !== "x-default" && HREFLANG_RULES.invalidCodes.has(code)) {
      const correction = (HREFLANG_RULES.corrections as Record<string, string>)[code];
      issues.push({
        id: randomUUID(),
        type: "missing-hreflang",
        severity: "warning",
        filePath,
        message: `Invalid hreflang code "${code}"${correction ? ` — use "${correction}" instead` : " — must be ISO 639-1 two-letter code"}`,
        currentValue: code,
      });
    }
  });

  // Check for x-default (required per claude-seo)
  if (HREFLANG_RULES.xDefaultRequired && !codes.includes("x-default")) {
    issues.push({
      id: randomUUID(),
      type: "missing-hreflang",
      severity: "warning",
      filePath,
      message: "Missing x-default hreflang tag — required as fallback for unmatched languages",
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
  } else if (h1s.length > QUALITY_GATES.h1PerPage) {
    issues.push({
      id: randomUUID(),
      type: "unoptimized-headings",
      severity: "info",
      filePath,
      message: `Multiple <h1> tags found (${h1s.length}) — recommend exactly ${QUALITY_GATES.h1PerPage} H1 per page`,
    });
  }

  return issues;
}

// Scan for missing canonical tag
export function scanCanonical(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const canonical = $('link[rel="canonical"]');

  if (canonical.length === 0) {
    issues.push({
      id: randomUUID(),
      type: "missing-canonical",
      severity: "warning",
      filePath,
      message:
        "Missing canonical tag — required to prevent duplicate content penalties when serving multiple locales",
    });
  }

  return issues;
}

// Scan for missing viewport meta (mobile SEO requirement)
export function scanViewport(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const viewport = $('meta[name="viewport"]');

  if (viewport.length === 0) {
    issues.push({
      id: randomUUID(),
      type: "missing-viewport",
      severity: "critical",
      filePath,
      message:
        "Missing viewport meta tag — Google uses mobile-first indexing; this page will rank poorly on mobile",
      suggestedFix: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    });
  }

  return issues;
}

// DEPRECATED_SCHEMA imported from seo-optimizer.ts (claude-seo Feb 2026 list)

// Scan for JSON-LD schema issues
export function scanJsonLd(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const scripts = $('script[type="application/ld+json"]').toArray();

  if (scripts.length === 0) {
    issues.push({
      id: randomUUID(),
      type: "invalid-schema",
      severity: "info",
      filePath,
      message:
        "No JSON-LD structured data found — schema markup increases likelihood of rich results and AI search citations by ~2.5x",
    });
    return issues;
  }

  for (const script of scripts) {
    const raw = $(script).html() || "";
    try {
      const parsed = JSON.parse(raw);
      const type = parsed["@type"] as string | undefined;

      if (type && DEPRECATED_SCHEMA.has(type)) {
        issues.push({
          id: randomUUID(),
          type: "invalid-schema",
          severity: "critical",
          filePath,
          message: `Deprecated schema type "${type}" detected — Google no longer uses this for rich results`,
          currentValue: type,
        });
      }

      // Check for missing @context
      if (!parsed["@context"]) {
        issues.push({
          id: randomUUID(),
          type: "invalid-schema",
          severity: "warning",
          filePath,
          message: 'JSON-LD schema missing @context declaration (required: "https://schema.org")',
        });
      }
    } catch {
      issues.push({
        id: randomUUID(),
        type: "invalid-schema",
        severity: "critical",
        filePath,
        message: "Invalid JSON-LD schema — syntax error prevents Google from parsing structured data",
      });
    }
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

// ── STRUCTURAL ARIA SCANNERS ─────────────────────────────────────────────────
// These detect MISSING aria attributes/roles — elements that SHOULD have
// accessibility markup but don't. Different from the translation scanners
// above which check existing labels that need localization.

// Scan for nav elements without distinguishing aria-labels
export function scanNavLandmarks(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const navs = $("nav").toArray();

  // Multiple navs need aria-labels so screen readers can distinguish them
  if (navs.length > 1) {
    const unlabeled = navs.filter((el) => {
      const label = $(el).attr("aria-label") || $(el).attr("aria-labelledby") || "";
      return !label.trim();
    });
    if (unlabeled.length > 0) {
      issues.push({
        id: randomUUID(),
        type: "missing-nav-label",
        severity: "warning",
        filePath,
        message: `${unlabeled.length} of ${navs.length} <nav> elements have no aria-label — screen readers can't distinguish between main navigation and footer navigation`,
        currentValue: unlabeled.map((el) => {
          const cls = $(el).attr("class") || "";
          return cls ? `<nav class="${cls}">` : "<nav>";
        }).slice(0, 3).join(", "),
      });
    }
  } else if (navs.length === 1) {
    // Single nav — still recommend aria-label for clarity
    const label = $(navs[0]).attr("aria-label") || $(navs[0]).attr("aria-labelledby") || "";
    if (!label.trim()) {
      issues.push({
        id: randomUUID(),
        type: "missing-nav-label",
        severity: "info",
        filePath,
        message: "Single <nav> has no aria-label — adding one improves screen reader context (e.g. \"Main navigation\")",
      });
    }
  }

  return issues;
}

// Scan for missing skip navigation link
export function scanSkipLink(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  // Look for common skip link patterns
  const skipSelectors = [
    'a[href="#main"]', 'a[href="#main-content"]', 'a[href="#content"]',
    'a[href="#maincontent"]', '.skip-link', '.skip-nav', '.skip-to-content',
    '[class*="skip"]',
  ];
  const hasSkipLink = skipSelectors.some((sel) => $(sel).length > 0);

  // Also check first <a> in <body> for skip-link-like text
  const firstLink = $("body a").first();
  const firstLinkText = firstLink.text().toLowerCase();
  const isSkipLike = firstLinkText.includes("skip") || firstLinkText.includes("main content");

  if (!hasSkipLink && !isSkipLike) {
    issues.push({
      id: randomUUID(),
      type: "missing-skip-link",
      severity: "warning",
      filePath,
      message: "No \"Skip to main content\" link — keyboard users must tab through the entire navigation on every page load",
    });
  }

  return issues;
}

// Scan for decorative content not hidden from screen readers
export function scanDecorativeContent(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  // Emoji in text content — common pattern: emoji inside spans/divs as icons
  const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const emojiElements: string[] = [];

  $("span, div, p, li, td, h1, h2, h3, h4, h5, h6").each((_, el) => {
    const directText = $(el).contents().filter(function() {
      return this.type === "text";
    }).text();
    if (emojiPattern.test(directText)) {
      const hidden = $(el).attr("aria-hidden") || "";
      const role = $(el).attr("role") || "";
      if (hidden !== "true" && role !== "presentation" && role !== "img") {
        const text = directText.trim().slice(0, 30);
        emojiElements.push(text);
      }
    }
  });

  if (emojiElements.length > 0) {
    issues.push({
      id: randomUUID(),
      type: "decorative-not-hidden",
      severity: "info",
      filePath,
      message: `${emojiElements.length} element(s) contain decorative emoji visible to screen readers — they hear "rocket", "money bag" etc. Add aria-hidden="true" to parent or wrap emoji in <span aria-hidden="true">`,
      currentValue: emojiElements.slice(0, 3).join(" | "),
    });
  }

  // <i> tags (icon fonts like Font Awesome) without aria-hidden
  const iconTags = $("i").toArray().filter((el) => {
    const cls = $(el).attr("class") || "";
    const hidden = $(el).attr("aria-hidden") || "";
    // Icon font classes: fa-, icon-, bi-, material-icons, etc.
    return (cls.match(/^(fa|icon|bi|material|glyphicon)/i) || cls.includes("fa-")) && hidden !== "true";
  });

  if (iconTags.length > 0) {
    issues.push({
      id: randomUUID(),
      type: "missing-icon-hiding",
      severity: "warning",
      filePath,
      message: `${iconTags.length} icon element(s) (<i> with icon classes) missing aria-hidden="true" — screen readers read empty or garbled text for each icon`,
      currentValue: iconTags.map((el) => `<i class="${$(el).attr("class")}">`).slice(0, 3).join(", "),
    });
  }

  return issues;
}

// Scan for <a href="#"> used as buttons without role="button"
export function scanActionLinks(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  const actionLinks = $('a[href="#"], a[href="javascript:void(0)"], a[href="javascript:;"]').toArray().filter((el) => {
    const role = $(el).attr("role") || "";
    return role !== "button";
  });

  if (actionLinks.length > 0) {
    issues.push({
      id: randomUUID(),
      type: "action-link-no-role",
      severity: "info",
      filePath,
      message: `${actionLinks.length} link(s) use href="#" but have no role="button" — screen readers announce them as links, but they trigger actions. Users expect link behavior (navigation) not button behavior`,
      currentValue: actionLinks.map((el) => {
        const text = $(el).text().trim().slice(0, 30);
        return `"${text}"`;
      }).slice(0, 3).join(", "),
    });
  }

  return issues;
}

// Scan for card/section structures that need region labels
export function scanRegionLabels(
  filePath: string,
  $: CheerioAPI
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  // Sections without aria-label or aria-labelledby
  const sections = $("section").toArray().filter((el) => {
    const label = $(el).attr("aria-label") || $(el).attr("aria-labelledby") || "";
    // Also check for heading as implicit label
    const hasHeading = $(el).find("h1, h2, h3, h4, h5, h6").length > 0;
    return !label.trim() && !hasHeading;
  });

  if (sections.length > 0) {
    issues.push({
      id: randomUUID(),
      type: "missing-region-label",
      severity: "info",
      filePath,
      message: `${sections.length} <section> element(s) have no aria-label and no heading — screen readers list these as unnamed regions, making page navigation confusing`,
      currentValue: sections.map((el) => {
        const cls = $(el).attr("class") || "";
        const id = $(el).attr("id") || "";
        return id ? `<section id="${id}">` : cls ? `<section class="${cls.split(" ")[0]}">` : "<section>";
      }).slice(0, 3).join(", "),
    });
  }

  return issues;
}

// Run all HTML scanners
export function runAllScanners(
  filePath: string,
  html: string
): SeoIssue[] {
  // Skip non-HTML files (sitemap.xml, robots.txt, etc.)
  if (filePath.endsWith(".xml") || filePath.endsWith(".txt")) {
    return [];
  }

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
    ...scanCanonical(filePath, $),
    ...scanViewport(filePath, $),
    ...scanJsonLd(filePath, $),
    ...scanAriaLabels(filePath, $),
    ...scanSrOnly(filePath, $),
    // Structural ARIA
    ...scanNavLandmarks(filePath, $),
    ...scanSkipLink(filePath, $),
    ...scanDecorativeContent(filePath, $),
    ...scanActionLinks(filePath, $),
    ...scanRegionLabels(filePath, $),
  ];
}
