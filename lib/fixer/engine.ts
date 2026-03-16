import { readFile, writeFile, mkdir } from "fs/promises";
import { join, extname, relative } from "path";
import * as cheerio from "cheerio";
import type { SeoIssue, FixResult } from "@/types";
import {
  translateObject,
  translateHtml,
} from "@/lib/translation/lingo-client";
import { callGemini } from "@/lib/translation/seo-optimizer";
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

// Brand context extracted from the codebase — tells Gemini what NOT to translate
interface BrandContext {
  appName: string;          // e.g. "InvoiceFlow"
  brandNames: string[];     // all brand-like strings found
  description: string;      // existing meta description if found
}

// ──────────────────────────────────────────────────────────────────────────
// TRANSLATION ONLY. Never adds, removes, or replaces existing code.
//
// Rules:
//   1. Only translate TEXT CONTENT — never touch code structure, imports,
//      SVGs, CSS, class names, or JSX syntax
//   2. Preserve brand names exactly (InvoiceFlow stays InvoiceFlow)
//   3. One language in → one language out (in-place replacement)
//   4. If a string is already translated or is code, skip it
// ──────────────────────────────────────────────────────────────────────────

// ── Source language detection ─────────────────────────────────────────────
// Two-pass detection:
//   Pass 1 (fast): Check <html lang> and metadata — zero API calls
//   Pass 2 (Gemini): Sample visible text and ask Gemini to identify the language
//
// This handles any language, not just English. If someone has a Japanese site
// and wants to translate to Korean, Gemini correctly identifies "ja" as source.

async function detectSourceLocale(cloneDir: string): Promise<string> {
  // ── Pass 1: Structural hints (free, instant) ────────────────────────

  // Check HTML files for <html lang="...">
  const htmlCandidates = [
    "index.html", "public/index.html", "src/index.html",
    "dist/index.html", "out/index.html",
  ];
  for (const f of htmlCandidates) {
    try {
      const html = await readFile(join(cloneDir, f), "utf-8");
      const langMatch = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
      if (langMatch && langMatch[1].trim() && langMatch[1].trim() !== "x-default") {
        log.info(`[DETECT] Source locale from <html lang>: "${langMatch[1].trim()}" (${f})`);
        return langMatch[1].trim().toLowerCase();
      }
    } catch {}
  }

  // Check layout files
  const layoutFiles = [
    "app/layout.tsx", "app/layout.jsx", "src/app/layout.tsx", "src/app/layout.jsx",
  ];
  for (const f of layoutFiles) {
    try {
      const content = await readFile(join(cloneDir, f), "utf-8");
      const htmlLangMatch = content.match(/<html[^>]*\slang=["']([^"']+)["']/i);
      if (htmlLangMatch && htmlLangMatch[1].trim()) {
        log.info(`[DETECT] Source locale from layout <html lang>: "${htmlLangMatch[1].trim()}" (${f})`);
        return htmlLangMatch[1].trim().toLowerCase();
      }
      const localeMatch = content.match(/locale:\s*["']([a-z]{2}(?:-[A-Za-z]{2,})?)["']/);
      if (localeMatch) {
        log.info(`[DETECT] Source locale from metadata: "${localeMatch[1]}" (${f})`);
        return localeMatch[1].toLowerCase();
      }
    } catch {}
  }

  // ── Pass 2: Ask Gemini to identify the language from content ────────
  const pageFiles = [
    "app/page.tsx", "app/page.jsx", "src/app/page.tsx",
    "pages/index.tsx", "pages/index.jsx", "index.html",
  ];

  let textSample = "";
  for (const f of pageFiles) {
    try {
      const content = await readFile(join(cloneDir, f), "utf-8");
      // Strip code, keep only human-readable text
      textSample = content
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .replace(/import\s+.*?from\s+["'][^"']+["'];?/g, "")
        .replace(/export\s+(?:default\s+)?(?:function|const|class|interface|type)\b[^{]*/g, "")
        .replace(/(?:className|style|onClick|onChange|href|src)=["'][^"']*["']/g, "")
        .replace(/(?:className|style|onClick|onChange|href|src)=\{[^}]*\}/g, "")
        .replace(/https?:\/\/[^\s"'<>]+/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/[{}()\[\]<>;:=.,!?@#$%^&*\/\\|~`"'0-9_\-+]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (textSample.length > 100) break;
    } catch {}
  }

  if (textSample.length < 20) {
    log.warn("[DETECT] Not enough text to detect language — defaulting to 'en'");
    return "en";
  }

  // Take a ~500 char sample (enough for Gemini, not too expensive)
  const sample = textSample.slice(0, 500);

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    if (!geminiApiKey) {
      log.warn("[DETECT] No GEMINI_API_KEY — defaulting to 'en'");
      return "en";
    }

    const prompt = `What language is this text written in? Reply with ONLY the ISO 639-1 two-letter code (e.g. "en", "es", "ja", "ar", "zh", "fr", "de", "ko", "pt", "ru", "hi", "it", "nl", "tr", "vi", "uk", "sv", "pl", "id"). If mixed languages, reply with the DOMINANT language. Reply with ONLY the code, nothing else.

TEXT:
"${sample}"`;

    const result = await callGemini(geminiApiKey, geminiModel, prompt);
    const code = result.trim().toLowerCase().replace(/[^a-z-]/g, "").slice(0, 5);

    if (code && code.length >= 2) {
      log.info(`[DETECT] Gemini identified source language: "${code}"`);
      return code;
    }
  } catch (err) {
    log.warn(`[DETECT] Gemini detection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  log.warn("[DETECT] Could not detect source locale — defaulting to 'en'");
  return "en";
}

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

  // ── Step 0a: Detect source language ──────────────────────────────────
  const sourceLang = await detectSourceLocale(cloneDir);
  globalLog.push(`[DETECT] Source language: "${sourceLang}"`);

  // Sanity check: if source and target are the same, warn and skip
  if (sourceLang === locale || sourceLang.split("-")[0] === locale.split("-")[0]) {
    globalLog.push(`[FIXER] Source (${sourceLang}) and target (${locale}) are the same language — nothing to translate`);
    fixResults.push({ filePath: "__fixer_log__", originalContent: "", newContent: "", issuesFixed: [], log: globalLog });
    return fixResults;
  }

  // ── Step 0b: Extract brand context from the codebase ─────────────────
  const brand = await extractBrandContext(cloneDir);
  globalLog.push(`[BRAND] App name: "${brand.appName}" | Brand names: ${brand.brandNames.join(", ") || "none"}`);

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

    // ── FULL PAGE: translate everything ─────────────────────────────
    if (fixModes.fullPage) {
      if (isHtml) {
        log.info(`[FULL] ${filePath} (${sourceLang}) → ${locale}`);
        try {
          const translated = await translateHtml(content, sourceLang, locale);
          content = translated;
          fixedIssueIds.push("full-page");
          log.ok(`[FULL] ✓ ${filePath}`);
        } catch (err) {
          log.err(`[FULL] ✗ ${filePath}`, err);
          globalLog.push(`[FULL] ✗ ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (isTsx) {
        log.info(`[FULL] ${filePath} (${sourceLang}) → ${locale} (TSX)`);
        try {
          content = await translateTsxContent(content, sourceLang, locale, brand);
          fixedIssueIds.push("full-page");
          log.ok(`[FULL] ✓ ${filePath}`);
        } catch (err) {
          log.err(`[FULL] ✗ ${filePath}`, err);
          globalLog.push(`[FULL] ✗ ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // ── SEO: translate titles, descriptions, headings, alt text ─────
    if (fixModes.seo && !fixModes.fullPage) {
      if (isHtml) {
        try {
          content = await translateHtmlSeo(content, sourceLang, locale, brand);
          fixedIssueIds.push("seo");
          log.ok(`[SEO] ✓ ${filePath} → ${locale}`);
        } catch (err) {
          log.err(`[SEO] ✗ ${filePath}`, err);
        }
      }
      if (isTsx) {
        try {
          content = await translateTsxSeo(content, sourceLang, locale, brand);
          fixedIssueIds.push("seo");
          log.ok(`[SEO] ✓ ${filePath} → ${locale}`);
        } catch (err) {
          log.err(`[SEO] ✗ ${filePath}`, err);
        }
      }
    }

    // ── ARIA: translate aria-labels and sr-only text ────────────────
    if (fixModes.aria && !fixModes.fullPage) {
      if (isHtml) {
        try {
          content = await translateHtmlAria(content, sourceLang, locale);
          fixedIssueIds.push("aria");
          log.ok(`[ARIA] ✓ ${filePath} → ${locale}`);
        } catch (err) {
          log.err(`[ARIA] ✗ ${filePath}`, err);
        }
      }
      if (isTsx) {
        try {
          content = await translateTsxAria(content, sourceLang, locale);
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


// ── Brand context extraction ────────────────────────────────────────────
// Reads the codebase to find the real app name, brand names, and existing
// metadata so translations preserve branding instead of translating it.

async function extractBrandContext(cloneDir: string): Promise<BrandContext> {
  const brandNames: Set<string> = new Set();
  let appName = "";
  let description = "";

  // 1. Read package.json for the project name
  try {
    const pkg = JSON.parse(await readFile(join(cloneDir, "package.json"), "utf-8"));
    if (pkg.name && !pkg.name.includes("/") && pkg.name !== "my-app" && pkg.name !== "next-app") {
      // Convert package name to display name: "invoice-flow" → "InvoiceFlow"
      const displayName = pkg.name
        .split(/[-_]/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
      appName = displayName;
      brandNames.add(displayName);
      brandNames.add(pkg.name);
    }
    if (pkg.description) description = pkg.description;
  } catch {}

  // 2. Scan layout.tsx / page.tsx for metadata exports with real brand names
  for (const metaFile of ["app/layout.tsx", "app/layout.jsx", "app/page.tsx", "app/page.jsx", "src/app/layout.tsx", "src/app/page.tsx"]) {
    try {
      const content = await readFile(join(cloneDir, metaFile), "utf-8");

      // Extract title from metadata
      const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
      if (titleMatch) {
        const title = titleMatch[1];
        // Don't use generic placeholders as the brand name
        if (!isGenericPlaceholder(title)) {
          // Extract the brand part (usually the first word/phrase before a colon or dash)
          const brandPart = title.split(/[:\-–—|]/)[0].trim();
          if (brandPart && brandPart.length > 1 && brandPart.length < 40) {
            if (!appName) appName = brandPart;
            brandNames.add(brandPart);
          }
        }
      }

      // Extract description from metadata
      const descMatch = content.match(/description:\s*["']([^"']+)["']/);
      if (descMatch && !isGenericPlaceholder(descMatch[1])) {
        if (!description) description = descMatch[1];
      }

      // Look for brand name constants: const APP_NAME = "..." or appName: "..."
      const brandPatterns = [
        /(?:APP_NAME|BRAND_NAME|SITE_NAME|appName|brandName|siteName)\s*[:=]\s*["']([^"']+)["']/g,
        /(?:company|brand|app)\s*[:=]\s*["']([^"']+)["']/gi,
      ];
      for (const pat of brandPatterns) {
        for (const m of content.matchAll(pat)) {
          if (m[1] && !isGenericPlaceholder(m[1]) && m[1].length < 40) {
            if (!appName) appName = m[1];
            brandNames.add(m[1]);
          }
        }
      }

      // Look for brand in JSX — the first <h1> or prominent text often has it
      const h1Match = content.match(/<h1[^>]*>([^<{]{2,60})<\/h1>/);
      if (h1Match) {
        // Extract words that look like proper nouns (PascalCase or ALL CAPS)
        const properNouns = h1Match[1].match(/[A-Z][a-z]+(?:[A-Z][a-z]+)+/g); // PascalCase like InvoiceFlow
        if (properNouns) {
          for (const noun of properNouns) brandNames.add(noun);
        }
      }

      // Look for the brand in navbar/header — often has the app name as logo text
      const navBrandMatch = content.match(/(?:logo|brand|navbar|header)[^}]*>([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)</i);
      if (navBrandMatch && navBrandMatch[1].length < 30) {
        brandNames.add(navBrandMatch[1].trim());
      }
    } catch {}
  }

  // 3. Fallback: if we still don't have a name, check common config files
  if (!appName) {
    for (const cfgFile of ["next.config.js", "next.config.ts", "next.config.mjs", "nuxt.config.ts", "astro.config.mjs"]) {
      try {
        const content = await readFile(join(cloneDir, cfgFile), "utf-8");
        const nameMatch = content.match(/(?:title|name|brand)\s*[:=]\s*["']([^"']+)["']/);
        if (nameMatch && !isGenericPlaceholder(nameMatch[1])) {
          appName = nameMatch[1];
          brandNames.add(nameMatch[1]);
        }
      } catch {}
    }
  }

  log.info(`[BRAND] Detected: name="${appName}", brands=[${[...brandNames].join(", ")}]`);

  return {
    appName: appName || "the app",
    brandNames: [...brandNames],
    description,
  };
}

// Common placeholder strings that are NOT real brand names
function isGenericPlaceholder(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("my awesome") ||
    lower.includes("my app") ||
    lower.includes("next.js app") ||
    lower.includes("create next app") ||
    lower.includes("welcome to") ||
    lower.includes("getting started") ||
    lower.includes("example") ||
    lower.includes("placeholder") ||
    lower.includes("lorem ipsum") ||
    lower.includes("untitled") ||
    lower.includes("default") ||
    lower === "home" ||
    lower === "app"
  );
}

// Build a brand-aware context string for translation
function brandHint(brand: BrandContext): string {
  if (brand.brandNames.length === 0) return "";
  return `\nDO NOT TRANSLATE these brand/product names — keep them exactly as-is: ${brand.brandNames.join(", ")}`;
}


// ── HTML translations ──────────────────────────────────────────────────

async function translateHtmlSeo(html: string, sourceLang: string, locale: string, brand: BrandContext): Promise<string> {
  const $ = cheerio.load(html);

  // Collect EXISTING SEO strings — only translate what's already there
  const strings: Record<string, string> = {};

  const title = $("title").text().trim();
  if (title && !isGenericPlaceholder(title)) {
    strings["title"] = title;
  }

  const desc = $('meta[name="description"]').attr("content")?.trim();
  if (desc && !isGenericPlaceholder(desc)) {
    strings["description"] = desc;
  }

  $("h1, h2, h3").each((i, el) => {
    const text = $(el).text().trim();
    if (text && !isInsideSvg($, el)) strings[`h_${i}`] = text;
  });

  $("img[alt]").each((i, el) => {
    const alt = $(el).attr("alt")?.trim();
    if (alt) strings[`alt_${i}`] = alt;
  });

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) strings["og_title"] = ogTitle;
  const ogDesc = $('meta[property="og:description"]').attr("content")?.trim();
  if (ogDesc) strings["og_description"] = ogDesc;

  // Twitter card content
  const twitterTitle = $('meta[name="twitter:title"]').attr("content")?.trim();
  if (twitterTitle) strings["twitter_title"] = twitterTitle;
  const twitterDesc = $('meta[name="twitter:description"]').attr("content")?.trim();
  if (twitterDesc) strings["twitter_description"] = twitterDesc;

  // All visible text nodes — nav links, buttons, badges, footer text
  $("a, button, span, p, li, td, th, label, figcaption, blockquote, dt, dd").each((i, el) => {
    if (isInsideSvg($, el)) return;
    // Only direct text, not nested children's text
    const directText = $(el).contents().filter(function() { return this.type === "text"; }).text().trim();
    if (directText && directText.length >= 2 && !isCodeNotText(directText) && !isGenericPlaceholder(directText)) {
      strings[`txt_${i}`] = directText;
    }
  });

  if (Object.keys(strings).length === 0) return html;

  // Add brand hint as context for Gemini
  if (brand.brandNames.length > 0) {
    strings["__brand_context__"] = `BRAND NAMES (do not translate): ${brand.brandNames.join(", ")}`;
  }

  const translated = await translateObject(strings, sourceLang, locale);

  // Write translations back — only into EXISTING elements
  if (translated["title"]) $("title").text(translated["title"]);
  if (translated["description"]) $('meta[name="description"]').attr("content", translated["description"]);

  $("h1, h2, h3").each((i, el) => {
    if (translated[`h_${i}`] && !isInsideSvg($, el)) $(el).text(translated[`h_${i}`]);
  });

  $("img[alt]").each((i, el) => {
    if (translated[`alt_${i}`]) $(el).attr("alt", translated[`alt_${i}`]);
  });

  if (translated["og_title"]) $('meta[property="og:title"]').attr("content", translated["og_title"]);
  if (translated["og_description"]) $('meta[property="og:description"]').attr("content", translated["og_description"]);
  if (translated["twitter_title"]) $('meta[name="twitter:title"]').attr("content", translated["twitter_title"]);
  if (translated["twitter_description"]) $('meta[name="twitter:description"]').attr("content", translated["twitter_description"]);

  // Write back visible text translations
  $("a, button, span, p, li, td, th, label, figcaption, blockquote, dt, dd").each((i, el) => {
    if (isInsideSvg($, el)) return;
    if (translated[`txt_${i}`]) {
      // Replace only direct text nodes, preserve child elements
      $(el).contents().filter(function() { return this.type === "text"; }).each(function() {
        const original = (this as any).data as string;
        if (original.trim() && translated[`txt_${i}`]) {
          (this as any).data = original.replace(original.trim(), translated[`txt_${i}`]);
        }
      });
    }
  });

  // ── Metadata cleanup: html lang, og:locale, stale data-aria-* ───
  $("html").attr("lang", locale);
  $('meta[property="og:locale"]').attr("content", locale.replace("-", "_"));
  // Clean stale data-aria-* attributes from previous locale runs
  $("[aria-label]").each((_, el) => {
    const attribs = (el as any).attribs || {};
    for (const attr of Object.keys(attribs)) {
      if (attr.startsWith("data-aria-")) $(el).removeAttr(attr);
    }
  });

  return $.html();
}

async function translateHtmlAria(html: string, sourceLang: string, locale: string): Promise<string> {
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

  const translated = await translateObject(strings, sourceLang, locale);

  $("[aria-label]").each((i, el) => {
    if (translated[`aria_${i}`]) {
      $(el).attr("aria-label", translated[`aria_${i}`]);
      // Clean stale data-aria-* from previous runs
      const attribs = (el as any).attribs || {};
      for (const attr of Object.keys(attribs)) {
        if (attr.startsWith("data-aria-")) $(el).removeAttr(attr);
      }
    }
  });

  $(srSel).each((i, el) => {
    if (translated[`sr_${i}`]) $(el).text(translated[`sr_${i}`]);
  });

  return $.html();
}

// Check if an element is inside an <svg> (don't touch SVG content)
function isInsideSvg($: ReturnType<typeof cheerio.load>, el: any): boolean {
  return $(el).closest("svg").length > 0;
}


// ── TSX translations ───────────────────────────────────────────────────
// For TSX we use regex. Rules:
//   - Only replace text VALUES, never code/syntax/imports
//   - Skip SVG content (<svg>...</svg> blocks)
//   - Skip CSS/style objects
//   - Preserve brand names

// Regex to find SVG blocks in TSX — we strip these before extracting text
const SVG_BLOCK_RE = /<svg[\s\S]*?<\/svg>/gi;

// Things that look like text but aren't
function isCodeNotText(text: string): boolean {
  const t = text.trim();
  return (
    t.startsWith("//") ||
    t.startsWith("/*") ||
    t.startsWith("import ") ||
    t.startsWith("export ") ||
    t.startsWith("const ") ||
    t.startsWith("let ") ||
    t.startsWith("var ") ||
    t.startsWith("function ") ||
    t.startsWith("return ") ||
    t.includes("className") ||
    t.includes("style=") ||
    t.includes("onClick") ||
    t.includes("onChange") ||
    t.includes("href=") ||
    t.includes("src=") ||
    /^[a-z]+:\/\//.test(t) ||      // URLs
    /^\s*$/.test(t) ||               // whitespace
    /^[{(]/.test(t) ||               // JSX expressions
    /^[0-9.,\s$€£¥%]+$/.test(t) ||  // pure numbers/currency
    /^[a-z_]+$/i.test(t) ||          // single identifier (variable name)
    t.length < 2                      // too short
  );
}

async function translateTsxSeo(content: string, sourceLang: string, locale: string, brand: BrandContext): Promise<string> {
  const strings: Record<string, string> = {};

  // Metadata strings — only if they exist and aren't placeholders
  const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
  if (titleMatch && !isGenericPlaceholder(titleMatch[1])) {
    strings["title"] = titleMatch[1];
  }
  const descMatch = content.match(/description:\s*["']([^"']+)["']/);
  if (descMatch && !isGenericPlaceholder(descMatch[1])) {
    strings["description"] = descMatch[1];
  }

  // OG / Twitter metadata in TSX — use [\s\S] instead of /s flag for dotAll
  const ogTitleMatch = content.match(/openGraph:\s*\{[\s\S]*?title:\s*["']([^"']+)["']/);
  if (ogTitleMatch) strings["og_title"] = ogTitleMatch[1];
  const ogDescMatch = content.match(/openGraph:\s*\{[\s\S]*?description:\s*["']([^"']+)["']/);
  if (ogDescMatch) strings["og_description"] = ogDescMatch[1];
  const twitterTitleMatch = content.match(/twitter:\s*\{[\s\S]*?title:\s*["']([^"']+)["']/);
  if (twitterTitleMatch) strings["twitter_title"] = twitterTitleMatch[1];
  const twitterDescMatch = content.match(/twitter:\s*\{[\s\S]*?description:\s*["']([^"']+)["']/);
  if (twitterDescMatch) strings["twitter_description"] = twitterDescMatch[1];

  // Headings in JSX — but NOT inside SVG blocks
  const contentNoSvg = content.replace(SVG_BLOCK_RE, (m) => " ".repeat(m.length));
  const headingMatches = [...contentNoSvg.matchAll(/<h[1-3][^>]*>([^<{]{2,200})<\/h[1-3]>/g)];
  headingMatches.forEach((m, i) => {
    const text = m[1].trim();
    if (text && !isCodeNotText(text)) strings[`h_${i}`] = text;
  });

  // Alt text
  const altMatches = [...content.matchAll(/alt=["']([^"']{2,})["']/g)];
  altMatches.forEach((m, i) => { strings[`alt_${i}`] = m[1]; });

  // Visible text between JSX tags: >Some text< — catches nav links, buttons, badges
  const textMatches = [...contentNoSvg.matchAll(/>([^<>{]{3,300})/g)];
  textMatches.forEach((m, i) => {
    const text = m[1].trim();
    if (text && !isCodeNotText(text) && !isGenericPlaceholder(text)) {
      strings[`txt_${i}`] = text;
    }
  });

  if (Object.keys(strings).length === 0) return content;

  // Add brand context
  if (brand.brandNames.length > 0) {
    strings["__brand_context__"] = `BRAND NAMES (do not translate): ${brand.brandNames.join(", ")}`;
  }

  const translated = await translateObject(strings, sourceLang, locale);
  let result = content;

  // ── Position-safe replacement using unique markers ──
  // Build a map of original → translated for all string matches,
  // then do a single pass replacement to avoid first-match-only bugs

  // Metadata replacements
  if (translated["title"] && titleMatch && !isGenericPlaceholder(titleMatch[1])) {
    result = result.replace(titleMatch[0], titleMatch[0].replace(titleMatch[1], translated["title"]));
  }
  if (translated["description"] && descMatch && !isGenericPlaceholder(descMatch[1])) {
    result = result.replace(descMatch[0], descMatch[0].replace(descMatch[1], translated["description"]));
  }
  if (translated["og_title"] && ogTitleMatch) {
    result = result.replace(ogTitleMatch[0], ogTitleMatch[0].replace(ogTitleMatch[1], translated["og_title"]));
  }
  if (translated["og_description"] && ogDescMatch) {
    result = result.replace(ogDescMatch[0], ogDescMatch[0].replace(ogDescMatch[1], translated["og_description"]));
  }
  if (translated["twitter_title"] && twitterTitleMatch) {
    result = result.replace(twitterTitleMatch[0], twitterTitleMatch[0].replace(twitterTitleMatch[1], translated["twitter_title"]));
  }
  if (translated["twitter_description"] && twitterDescMatch) {
    result = result.replace(twitterDescMatch[0], twitterDescMatch[0].replace(twitterDescMatch[1], translated["twitter_description"]));
  }

  // Replace headings — reverse order for position safety
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

  // Replace visible text — use indexed positions to avoid duplicate-match bugs
  // Track which offsets have been replaced to avoid double-replacing
  const replaced = new Set<number>();
  for (let i = textMatches.length - 1; i >= 0; i--) {
    const key = `txt_${i}`;
    if (translated[key] && strings[key]) {
      const m = textMatches[i];
      const offset = m.index!;
      if (replaced.has(offset)) continue;
      replaced.add(offset);
      const originalSnippet = `>${m[1]}`;
      const idx = content.indexOf(originalSnippet, offset > 10 ? offset - 10 : 0);
      if (idx >= 0) {
        const before = result.slice(0, idx);
        const after = result.slice(idx + originalSnippet.length);
        result = before + `>${m[1].replace(m[1].trim(), translated[key])}` + after;
      }
    }
  }

  // Update html lang in TSX layout files
  result = result.replace(/<html([^>]*)\slang=["'][^"']*["']/, `<html$1 lang="${locale}"`);

  // Update og:locale in metadata
  result = result.replace(/(locale:\s*["'])[^"']*(["'])/, `$1${locale.replace("-", "_")}$2`);

  return result;
}

async function translateTsxAria(content: string, sourceLang: string, locale: string): Promise<string> {
  const strings: Record<string, string> = {};

  const ariaMatches = [...content.matchAll(/aria-label=["']([^"']+)["']/g)];
  ariaMatches.forEach((m, i) => { strings[`aria_${i}`] = m[1]; });

  const srMatches = [...content.matchAll(/className=["'][^"']*sr-only[^"']*["'][^>]*>([^<]{1,200})</g)];
  srMatches.forEach((m, i) => { if (m[1].trim()) strings[`sr_${i}`] = m[1].trim(); });

  if (Object.keys(strings).length === 0) return content;

  const translated = await translateObject(strings, sourceLang, locale);
  let result = content;

  for (let i = ariaMatches.length - 1; i >= 0; i--) {
    if (translated[`aria_${i}`]) {
      const m = ariaMatches[i];
      result = result.replace(m[0], m[0].replace(m[1], translated[`aria_${i}`]));
    }
  }

  for (let i = srMatches.length - 1; i >= 0; i--) {
    if (translated[`sr_${i}`]) {
      const m = srMatches[i];
      result = result.replace(m[0], m[0].replace(m[1], translated[`sr_${i}`]));
    }
  }

  // Clean stale data-aria-* attributes
  result = result.replace(/\s+data-aria-[a-z]{2,5}=["'][^"']*["']/g, "");

  return result;
}

async function translateTsxContent(content: string, sourceLang: string, locale: string, brand: BrandContext): Promise<string> {
  const strings: Record<string, string> = {};

  // Strip SVG blocks from analysis (preserve positions for replacement later)
  const contentNoSvg = content.replace(SVG_BLOCK_RE, (m) => " ".repeat(m.length));

  // Text between JSX tags: >Some text< — but NOT inside SVG
  const textMatches = [...contentNoSvg.matchAll(/>([^<>{]{3,300})/g)];
  textMatches.forEach((m, i) => {
    const text = m[1].trim();
    if (text && !isCodeNotText(text)) {
      strings[`t_${i}`] = text;
    }
  });

  // Metadata (only real content, not placeholders)
  const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
  if (titleMatch && !isGenericPlaceholder(titleMatch[1])) {
    strings["title"] = titleMatch[1];
  }
  const descMatch = content.match(/description:\s*["']([^"']+)["']/);
  if (descMatch && !isGenericPlaceholder(descMatch[1])) {
    strings["description"] = descMatch[1];
  }

  // Alt text
  const altMatches = [...content.matchAll(/alt=["']([^"']{2,})["']/g)];
  altMatches.forEach((m, i) => { strings[`alt_${i}`] = m[1]; });

  // Aria labels
  const ariaMatches = [...content.matchAll(/aria-label=["']([^"']+)["']/g)];
  ariaMatches.forEach((m, i) => { strings[`aria_${i}`] = m[1]; });

  if (Object.keys(strings).length === 0) return content;

  // Add brand context
  if (brand.brandNames.length > 0) {
    strings["__brand_context__"] = `BRAND NAMES (do not translate): ${brand.brandNames.join(", ")}`;
  }

  log.info(`[FULL] Extracted ${Object.keys(strings).length} strings from TSX (${brand.brandNames.length} brand names protected)`);
  const translated = await translateObject(strings, sourceLang, locale);

  let result = content;

  // Replace text matches — reverse order for position safety
  // IMPORTANT: use the ORIGINAL content positions, but only replace if the
  // text exists in the original (not in SVG-stripped version only)
  for (let i = textMatches.length - 1; i >= 0; i--) {
    const key = `t_${i}`;
    if (translated[key] && strings[key]) {
      const m = textMatches[i];
      const originalSnippet = `>${m[1]}`;
      // Only replace if this exact text exists in the real content (not inside SVG)
      if (content.includes(originalSnippet)) {
        result = result.replace(originalSnippet, `>${m[1].replace(m[1].trim(), translated[key])}`);
      }
    }
  }

  // Replace metadata
  if (translated["title"] && titleMatch && !isGenericPlaceholder(titleMatch[1])) {
    result = result.replace(titleMatch[0], titleMatch[0].replace(titleMatch[1], translated["title"]));
  }
  if (translated["description"] && descMatch && !isGenericPlaceholder(descMatch[1])) {
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

  // Metadata cleanup
  result = result.replace(/<html([^>]*)\slang=["'][^"']*["']/, `<html$1 lang="${locale}"`);
  result = result.replace(/(locale:\s*["'])[^"']*(["'])/, `$1${locale.replace("-", "_")}$2`);
  // Clean stale data-aria-* from previous locale runs
  result = result.replace(/\s+data-aria-[a-z]{2,5}=["'][^"']*["']/g, "");

  return result;
}
