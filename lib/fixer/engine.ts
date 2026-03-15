import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, extname } from "path";
import * as cheerio from "cheerio";
import type { SeoIssue, FixResult } from "@/types";
import {
  translateObject,
  translateHtml,
} from "@/lib/translation/lingo-client";
import { generateSitemapWithLocales } from "@/lib/translation/seo-optimizer";
import { log } from "@/lib/logger";

interface FixModes {
  seo: boolean;
  aria: boolean;
  fullPage: boolean;
}

interface FixerParams {
  cloneDir: string;
  issues: SeoIssue[];
  geminiApiKey: string;
  modelName: string;
  targetLocales: string[];
  fixModes: FixModes;
}

// ──────────────────────────────────────────────────────────────────────────
// One language in → one language out.
//
// Each PR/branch is a single locale. The fixer modifies the ACTUAL files:
//   English content gets replaced with the target locale content.
//
// Translation flow for everything:
//   extract strings → lingo.dev SDK → our /api/process/localize → Gemini
//   Gemini knows the culture, search behavior, accessibility norms.
//   Not machine translation — culturally accurate, market-specific.
//
// Modes:
//   SEO  → replaces titles, descriptions, headings, alt text in-place
//   ARIA → replaces aria-labels and sr-only text in-place
//   FULL → replaces ALL text content in-place (via localizeHtml)
// ──────────────────────────────────────────────────────────────────────────

export async function applyFixes(params: FixerParams): Promise<FixResult[]> {
  const { cloneDir, issues, targetLocales, fixModes } = params;

  const fixResults: FixResult[] = [];
  const globalLog: string[] = [];
  const locale = targetLocales[0]; // one locale per PR

  const modeLabel = [fixModes.seo && "SEO", fixModes.aria && "ARIA", fixModes.fullPage && "FULL-PAGE"].filter(Boolean).join("+");
  globalLog.push(`[FIXER] Starting — ${modeLabel} → ${locale || "none"}`);

  if (!locale) {
    globalLog.push(`[FIXER] No target locale — nothing to translate`);
    fixResults.push({ filePath: "__fixer_log__", originalContent: "", newContent: "", issuesFixed: [], log: globalLog });
    return fixResults;
  }

  // Collect all unique files that have issues
  const issueFiles = new Set(issues.map(i => i.filePath));

  for (const filePath of issueFiles) {
    if (filePath === "sitemap.xml") continue;

    const fullPath = join(cloneDir, filePath);
    let content: string;
    try {
      content = await readFile(fullPath, "utf-8");
    } catch {
      globalLog.push(`[SKIP] ${filePath} — not found`);
      continue;
    }

    const originalContent = content;
    const ext = extname(filePath).toLowerCase();
    const isHtml = [".html", ".htm", ".php", ".ejs", ".astro", ".vue", ".svelte"].includes(ext);
    const isTsx = [".tsx", ".jsx", ".ts", ".js"].includes(ext);
    const fixedIssueIds: string[] = [];

    // ── FULL PAGE: translate everything via localizeHtml ─────────────
    // This replaces all text content. If fullPage is on, we do this and
    // skip SEO/ARIA since localizeHtml covers all text.
    if (fixModes.fullPage && isHtml) {
      log.info(`[FULL] ${filePath} → ${locale}`);
      try {
        const translated = await translateHtml(content, "en", locale);
        content = translated;
        fixedIssueIds.push("full-page");
        log.ok(`[FULL] ✓ ${filePath}`);
      } catch (err) {
        log.err(`[FULL] ✗ ${filePath}`, err);
        globalLog.push(`[FULL] ✗ ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // For TSX + full page: extract all visible text, translate, replace
    if (fixModes.fullPage && isTsx) {
      log.info(`[FULL] ${filePath} → ${locale} (TSX)`);
      try {
        content = await translateTsxContent(content, locale);
        fixedIssueIds.push("full-page");
        log.ok(`[FULL] ✓ ${filePath}`);
      } catch (err) {
        log.err(`[FULL] ✗ ${filePath}`, err);
        globalLog.push(`[FULL] ✗ ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── SEO: replace titles, descriptions, headings, alt text ────────
    if (fixModes.seo && !fixModes.fullPage) {
      if (isHtml) {
        try {
          content = await translateHtmlSeo(content, locale);
          fixedIssueIds.push("seo");
          log.ok(`[SEO] ✓ ${filePath} → ${locale}`);
        } catch (err) {
          log.err(`[SEO] ✗ ${filePath}`, err);
        }
      }
      if (isTsx) {
        try {
          content = await translateTsxSeo(content, locale);
          fixedIssueIds.push("seo");
          log.ok(`[SEO] ✓ ${filePath} → ${locale}`);
        } catch (err) {
          log.err(`[SEO] ✗ ${filePath}`, err);
        }
      }
    }

    // ── ARIA: replace aria-labels and sr-only text ───────────────────
    if (fixModes.aria && !fixModes.fullPage) {
      if (isHtml) {
        try {
          content = await translateHtmlAria(content, locale);
          fixedIssueIds.push("aria");
          log.ok(`[ARIA] ✓ ${filePath} → ${locale}`);
        } catch (err) {
          log.err(`[ARIA] ✗ ${filePath}`, err);
        }
      }
      if (isTsx) {
        try {
          content = await translateTsxAria(content, locale);
          fixedIssueIds.push("aria");
          log.ok(`[ARIA] ✓ ${filePath} → ${locale}`);
        } catch (err) {
          log.err(`[ARIA] ✗ ${filePath}`, err);
        }
      }
    }

    // Write modified file back
    if (content !== originalContent && fixedIssueIds.length > 0) {
      await writeFile(fullPath, content, "utf-8");
      fixResults.push({
        filePath,
        originalContent,
        newContent: content,
        issuesFixed: fixedIssueIds,
        log: [`${filePath} — ${fixedIssueIds.join(", ")} → ${locale}`],
      });
      globalLog.push(`[WRITE] ✓ ${filePath} — ${fixedIssueIds.join(", ")}`);
    }
  }

  // ── Sitemap with locale alternates ──────────────────────────────────
  if (issues.some(i => i.type === "missing-sitemap-locales")) {
    try {
      const sitemap = generateSitemapWithLocales({
        baseUrl: "",
        locales: ["en", locale],
        pages: ["/"],
      });

      const sitemapDir = join(cloneDir, "public");
      await mkdir(sitemapDir, { recursive: true });
      await writeFile(join(sitemapDir, "sitemap.xml"), sitemap, "utf-8");

      fixResults.push({
        filePath: join("public", "sitemap.xml"),
        originalContent: "",
        newContent: sitemap,
        issuesFixed: ["sitemap-locales"],
      });
      log.ok(`[SITEMAP] ✓ en + ${locale}`);
    } catch (err) {
      log.err("[SITEMAP] ✗", err);
    }
  }

  // ── Done ────────────────────────────────────────────────────────────
  globalLog.push(`[FIXER] Done — ${fixResults.length} files modified → ${locale}`);

  if (fixResults.length > 0) {
    fixResults[0].log = [...globalLog, ...(fixResults[0].log || [])];
  } else {
    fixResults.push({
      filePath: "__fixer_log__",
      originalContent: "",
      newContent: "",
      issuesFixed: [],
      log: globalLog,
    });
  }

  return fixResults;
}


// ── HTML translations ──────────────────────────────────────────────────

async function translateHtmlSeo(html: string, locale: string): Promise<string> {
  const $ = cheerio.load(html);

  // Collect all SEO strings into one object
  const strings: Record<string, string> = {};

  const title = $("title").text().trim();
  if (title) strings["title"] = title;

  const desc = $('meta[name="description"]').attr("content")?.trim();
  if (desc) strings["description"] = desc;

  $("h1, h2, h3").each((i, el) => {
    const text = $(el).text().trim();
    if (text) strings[`h_${i}`] = text;
  });

  $("img[alt]").each((i, el) => {
    const alt = $(el).attr("alt")?.trim();
    if (alt) strings[`alt_${i}`] = alt;
  });

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) strings["og_title"] = ogTitle;
  const ogDesc = $('meta[property="og:description"]').attr("content")?.trim();
  if (ogDesc) strings["og_description"] = ogDesc;

  if (Object.keys(strings).length === 0) return html;

  // One call to lingo.dev → Gemini translates all SEO strings at once
  const translated = await translateObject(strings, "en", locale);

  // Write translations back into the HTML
  if (translated["title"]) $("title").text(translated["title"]);
  if (translated["description"]) $('meta[name="description"]').attr("content", translated["description"]);

  $("h1, h2, h3").each((i, el) => {
    if (translated[`h_${i}`]) $(el).text(translated[`h_${i}`]);
  });

  $("img[alt]").each((i, el) => {
    if (translated[`alt_${i}`]) $(el).attr("alt", translated[`alt_${i}`]);
  });

  if (translated["og_title"]) $('meta[property="og:title"]').attr("content", translated["og_title"]);
  if (translated["og_description"]) $('meta[property="og:description"]').attr("content", translated["og_description"]);

  // Update html lang
  $("html").attr("lang", locale);

  return $.html();
}

async function translateHtmlAria(html: string, locale: string): Promise<string> {
  const $ = cheerio.load(html);
  const strings: Record<string, string> = {};

  $("[aria-label]").each((i, el) => {
    const val = $(el).attr("aria-label")?.trim();
    if (val) strings[`aria_${i}`] = val;
  });

  const srSel = ".sr-only, .visually-hidden, .screen-reader-only, .screen-reader-text";
  $(srSel).each((i, el) => {
    const text = $(el).text().trim();
    if (text) strings[`sr_${i}`] = text;
  });

  if (Object.keys(strings).length === 0) return html;

  const translated = await translateObject(strings, "en", locale);

  $("[aria-label]").each((i, el) => {
    if (translated[`aria_${i}`]) $(el).attr("aria-label", translated[`aria_${i}`]);
  });

  $(srSel).each((i, el) => {
    if (translated[`sr_${i}`]) $(el).text(translated[`sr_${i}`]);
  });

  return $.html();
}


// ── TSX translations ───────────────────────────────────────────────────
// For TSX we can't use Cheerio (it's not HTML). We use regex to find
// translatable strings and replace them. The file structure stays intact.

async function translateTsxSeo(content: string, locale: string): Promise<string> {
  const strings: Record<string, string> = {};

  // Metadata strings
  const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
  if (titleMatch) strings["title"] = titleMatch[1];
  const descMatch = content.match(/description:\s*["']([^"']+)["']/);
  if (descMatch) strings["description"] = descMatch[1];

  // Headings in JSX
  const headingMatches = [...content.matchAll(/<h[1-3][^>]*>([^<{]{2,200})<\/h[1-3]>/g)];
  headingMatches.forEach((m, i) => { strings[`h_${i}`] = m[1].trim(); });

  // Alt text
  const altMatches = [...content.matchAll(/alt=["']([^"']{2,})["']/g)];
  altMatches.forEach((m, i) => { strings[`alt_${i}`] = m[1]; });

  if (Object.keys(strings).length === 0) return content;

  const translated = await translateObject(strings, "en", locale);
  let result = content;

  // Replace title in metadata
  if (translated["title"] && titleMatch) {
    result = result.replace(titleMatch[0], titleMatch[0].replace(titleMatch[1], translated["title"]));
  }
  if (translated["description"] && descMatch) {
    result = result.replace(descMatch[0], descMatch[0].replace(descMatch[1], translated["description"]));
  }

  // Replace headings — go in reverse to preserve indices
  for (let i = headingMatches.length - 1; i >= 0; i--) {
    if (translated[`h_${i}`]) {
      const m = headingMatches[i];
      const original = m[0];
      const replaced = original.replace(m[1], translated[`h_${i}`]);
      result = result.replace(original, replaced);
    }
  }

  // Replace alt text
  for (let i = altMatches.length - 1; i >= 0; i--) {
    if (translated[`alt_${i}`]) {
      const m = altMatches[i];
      result = result.replace(m[0], m[0].replace(m[1], translated[`alt_${i}`]));
    }
  }

  return result;
}

async function translateTsxAria(content: string, locale: string): Promise<string> {
  const strings: Record<string, string> = {};

  const ariaMatches = [...content.matchAll(/aria-label=["']([^"']+)["']/g)];
  ariaMatches.forEach((m, i) => { strings[`aria_${i}`] = m[1]; });

  const srMatches = [...content.matchAll(/className=["'][^"']*sr-only[^"']*["'][^>]*>([^<]{1,200})</g)];
  srMatches.forEach((m, i) => { if (m[1].trim()) strings[`sr_${i}`] = m[1].trim(); });

  if (Object.keys(strings).length === 0) return content;

  const translated = await translateObject(strings, "en", locale);
  let result = content;

  // Replace aria-labels in-place
  for (let i = ariaMatches.length - 1; i >= 0; i--) {
    if (translated[`aria_${i}`]) {
      const m = ariaMatches[i];
      result = result.replace(m[0], m[0].replace(m[1], translated[`aria_${i}`]));
    }
  }

  // Replace sr-only text in-place
  for (let i = srMatches.length - 1; i >= 0; i--) {
    if (translated[`sr_${i}`]) {
      const m = srMatches[i];
      result = result.replace(m[0], m[0].replace(m[1], translated[`sr_${i}`]));
    }
  }

  return result;
}

async function translateTsxContent(content: string, locale: string): Promise<string> {
  // For full page TSX: extract ALL visible text strings from JSX
  const strings: Record<string, string> = {};

  // Text between JSX tags: >Some text<
  const textMatches = [...content.matchAll(/>([^<>{]{3,300})</g)];
  textMatches.forEach((m, i) => {
    const text = m[1].trim();
    // Skip things that aren't real text (CSS values, code, URLs)
    if (text && !text.startsWith("//") && !text.startsWith("/*") &&
        !text.includes("className") && !text.includes("style=") &&
        !text.match(/^[a-z]+:\/\//) && !text.match(/^\s*$/)) {
      strings[`t_${i}`] = text;
    }
  });

  // Also catch metadata, headings, alt, aria (same as other modes)
  const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
  if (titleMatch) strings["title"] = titleMatch[1];
  const descMatch = content.match(/description:\s*["']([^"']+)["']/);
  if (descMatch) strings["description"] = descMatch[1];

  const altMatches = [...content.matchAll(/alt=["']([^"']{2,})["']/g)];
  altMatches.forEach((m, i) => { strings[`alt_${i}`] = m[1]; });

  const ariaMatches = [...content.matchAll(/aria-label=["']([^"']+)["']/g)];
  ariaMatches.forEach((m, i) => { strings[`aria_${i}`] = m[1]; });

  if (Object.keys(strings).length === 0) return content;

  log.info(`[FULL] Extracted ${Object.keys(strings).length} strings from TSX`);
  const translated = await translateObject(strings, "en", locale);

  let result = content;

  // Replace all text matches — go in reverse order to preserve string positions
  for (let i = textMatches.length - 1; i >= 0; i--) {
    const key = `t_${i}`;
    if (translated[key] && strings[key]) {
      const m = textMatches[i];
      result = result.replace(m[0], m[0].replace(m[1], translated[key]));
    }
  }

  // Replace metadata
  if (translated["title"] && titleMatch) {
    result = result.replace(titleMatch[0], titleMatch[0].replace(titleMatch[1], translated["title"]));
  }
  if (translated["description"] && descMatch) {
    result = result.replace(descMatch[0], descMatch[0].replace(descMatch[1], translated["description"]));
  }

  // Replace alt text
  for (let i = altMatches.length - 1; i >= 0; i--) {
    if (translated[`alt_${i}`]) {
      result = result.replace(altMatches[i][0], altMatches[i][0].replace(altMatches[i][1], translated[`alt_${i}`]));
    }
  }

  // Replace aria-labels
  for (let i = ariaMatches.length - 1; i >= 0; i--) {
    if (translated[`aria_${i}`]) {
      result = result.replace(ariaMatches[i][0], ariaMatches[i][0].replace(ariaMatches[i][1], translated[`aria_${i}`]));
    }
  }

  return result;
}
