import { readFile, writeFile, mkdir, readdir } from "fs/promises";
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
// THREE-STEP GEMINI + SDK TRANSLATION ENGINE
//
// Zero regex for string extraction or replacement.
//
// Step 1: EXTRACT — Gemini reads the file, returns ALL translatable strings as JSON
// Step 2: TRANSLATE — lingo.dev SDK translates the JSON (our API → Gemini)
// Step 3: REPLACE — Gemini takes original file + translation map, returns translated file
//
// Why: Regex missed ~35% of strings across 6 test passes. Gemini sees everything.
// ──────────────────────────────────────────────────────────────────────────

// ── Locale code normalization ─────────────────────────────────────────────
// lingo.dev SDK validates locale codes with Zod at runtime.
// It accepts: "en", "en-US", "zh-Hant" but REJECTS "en-us", "en_us".

function normalizeLocaleCode(code: string): string {
  const trimmed = code.trim().replace(/_/g, "-");
  const parts = trimmed.split("-");
  if (parts.length === 1) return parts[0].toLowerCase();
  const lang = parts[0].toLowerCase();
  const rest = parts.slice(1).map(p => {
    if (p.length === 4) return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); // Script: Hant
    if (p.length === 2) return p.toUpperCase(); // Region: US
    return p;
  });
  return [lang, ...rest].join("-");
}

// ── Source language detection ─────────────────────────────────────────────
// Always uses Gemini to identify the ACTUAL language of the content.
// Never trusts <html lang> — it's often wrong or stale.

async function detectSourceLocale(cloneDir: string): Promise<string> {
  const contentFiles = [
    "app/page.tsx", "app/page.jsx", "src/app/page.tsx",
    "app/layout.tsx", "app/layout.jsx", "src/app/layout.tsx",
    "pages/index.tsx", "pages/index.jsx",
    "index.html", "public/index.html", "src/index.html",
  ];

  let textSample = "";
  for (const f of contentFiles) {
    try {
      const content = await readFile(join(cloneDir, f), "utf-8");
      const cleaned = content
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
      if (cleaned.length > 10) textSample += " " + cleaned;
    } catch {}
    if (textSample.length > 500) break;
  }

  if (textSample.length < 20) {
    log.warn("[DETECT] Not enough text — defaulting to 'en'");
    return "en";
  }

  const sample = textSample.trim().slice(0, 800);

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    if (!geminiApiKey) {
      log.warn("[DETECT] No GEMINI_API_KEY — defaulting to 'en'");
      return "en";
    }

    const prompt = `Identify the DOMINANT language of this website text. Reply with ONLY the ISO 639-1 two-letter code (e.g. en, es, ja, ar, zh, fr, de, ko, hi). If mixed languages, reply with the DOMINANT one. ONLY the code, nothing else.

TEXT:
"${sample}"`;

    const result = await callGemini(geminiApiKey, geminiModel, prompt);
    const raw = result.trim().replace(/[^a-zA-Z-]/g, "").slice(0, 10);
    const code = normalizeLocaleCode(raw);

    if (code && code.length >= 2) {
      log.info(`[DETECT] Gemini identified source language: "${code}"`);
      return code;
    }
  } catch (err) {
    log.warn(`[DETECT] Gemini detection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return "en";
}

// ── File discovery ────────────────────────────────────────────────────────

const TRANSLATABLE_EXT = new Set([
  ".html", ".htm", ".php", ".ejs", ".astro", ".vue", ".svelte",
  ".tsx", ".jsx",
]);
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".vercel", ".lingo",
  "__tests__", "test", "tests", ".turbo", "coverage",
]);

async function discoverTranslatableFiles(cloneDir: string): Promise<Set<string>> {
  const files = new Set<string>();

  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        const ext = extname(entry.name).toLowerCase();
        if (TRANSLATABLE_EXT.has(ext)) {
          files.add(relative(cloneDir, fullPath));
        }
      }
    }
  }

  await walk(cloneDir);
  return files;
}

// ── Brand context extraction ────────────────────────────────────────────

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

async function extractBrandContext(cloneDir: string): Promise<BrandContext> {
  const brandNames: Set<string> = new Set();
  let appName = "";
  let description = "";
  // package.json name is the ONLY reliable brand source.
  // File content may be corrupted by previous translation runs
  // (e.g. "InvoiceFlow" → "FacturaFlujo" from a Spanish pass).
  // package.json is never translated, so it's always clean.
  let packageName = ""; // the raw package.json name, always trustworthy

  try {
    const pkg = JSON.parse(await readFile(join(cloneDir, "package.json"), "utf-8"));
    if (pkg.name && !pkg.name.includes("/") && pkg.name !== "my-app" && pkg.name !== "next-app") {
      const displayName = pkg.name
        .split(/[-_]/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
      appName = displayName;
      packageName = displayName;
      brandNames.add(displayName);
      brandNames.add(pkg.name);
      // Also add common variations: "Invoice Flow", "invoice-flow"
      const spaced = pkg.name.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      if (spaced !== displayName) brandNames.add(spaced);
    }
    if (pkg.description) description = pkg.description;
  } catch {}

  for (const metaFile of ["app/layout.tsx", "app/layout.jsx", "app/page.tsx", "app/page.jsx", "src/app/layout.tsx", "src/app/page.tsx"]) {
    try {
      const content = await readFile(join(cloneDir, metaFile), "utf-8");

      const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
      if (titleMatch && !isGenericPlaceholder(titleMatch[1])) {
        const brandPart = titleMatch[1].split(/[:\-–—|]/)[0].trim();
        if (brandPart && brandPart.length > 1 && brandPart.length < 40) {
          if (!appName) appName = brandPart;
          brandNames.add(brandPart);
        }
      }

      const descMatch = content.match(/description:\s*["']([^"']+)["']/);
      if (descMatch && !isGenericPlaceholder(descMatch[1])) {
        if (!description) description = descMatch[1];
      }

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

      const h1Match = content.match(/<h1[^>]*>([^<{]{2,60})<\/h1>/);
      if (h1Match) {
        const properNouns = h1Match[1].match(/[A-Z][a-z]+(?:[A-Z][a-z]+)+/g);
        if (properNouns) {
          for (const noun of properNouns) brandNames.add(noun);
        }
      }
    } catch {}
  }

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


// ══════════════════════════════════════════════════════════════════════════
// STEP 1: GEMINI EXTRACT — Ask Gemini to find ALL translatable strings
// ══════════════════════════════════════════════════════════════════════════

async function geminiExtractStrings(
  content: string,
  filePath: string,
  brand: BrandContext,
): Promise<Record<string, string>> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!geminiApiKey) return {};

  const brandList = brand.brandNames.length > 0
    ? `\nThe REAL brand/app name is: "${brand.appName}" (from package.json). Brand variations: ${brand.brandNames.join(", ")}`
    : "";

  const prompt = `You are a string extractor for a website localization tool.
${brandList}

Given this file (${filePath}), extract EVERY human-visible text string that needs translation.

EXTRACT ALL OF THESE:
- Page titles, meta descriptions, OG titles, OG descriptions, Twitter titles, Twitter descriptions
- ALL text inside metadata exports (export const metadata = { ... }) — every string value that is human-readable
- JSON-LD structured data — name, description, any human-readable string
- Headings (h1-h6)
- Paragraphs, spans, links, buttons, list items — ALL visible text
- Navigation labels, footer text, badge text, section labels
- Logo text (the text inside logo/brand elements)
- Alt text on images
- aria-label values
- sr-only / screen-reader text
- Pricing text, plan names, feature descriptions
- ANY other human-readable string a user would see on the page

PLACEHOLDER DETECTION:
If a title or description contains generic placeholder text in ANY language (e.g. "My Awesome Next.js App", "Nuestra App Next.js", "私のアプリ Next.js", etc.) — still extract it. Mark the key with a "_placeholder" suffix so the translator knows to replace it with the real brand name "${brand.appName}".

BRAND CORRUPTION DETECTION:
If you see the brand name "${brand.appName}" translated into another language (e.g. "FacturaFlujo" instead of "InvoiceFlow", "FakturaFluss" instead of "InvoiceFlow"), extract it — the translator will revert it to the original.

DO NOT EXTRACT:
- Import statements, export keywords, function names, variable names
- CSS class names, style values
- URLs, file paths, email addresses
- JSX syntax, HTML tags, attributes (except aria-label values and alt text values)
- SVG content (paths, coordinates, viewBox values)
- Numbers that are just numbers (but DO extract "$19/month" or date strings)
- TypeScript types, interfaces
- Comments (// or /* */) — these are for developers, not users
- Code identifiers like "onClick", "className", "href"

Return a JSON object where:
- Keys are unique descriptive identifiers (e.g. "meta_title", "hero_heading", "nav_features", "pricing_free_name", "footer_about_link")
- Values are the EXACT text strings as they appear in the file (preserve exact characters, don't clean up)

FILE CONTENT:
\`\`\`
${content}
\`\`\`

Return ONLY valid JSON. No markdown fences, no explanation.`;

  const result = await callGemini(geminiApiKey, geminiModel, prompt);

  // Strip markdown fences if present
  const cleaned = result
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) {
      // Filter out empty strings and very short non-text
      const filtered: Record<string, string> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === "string" && val.trim().length >= 1) {
          filtered[key] = val;
        }
      }
      log.info(`[EXTRACT] ${filePath}: Gemini found ${Object.keys(filtered).length} strings`);
      return filtered;
    }
  } catch (err) {
    log.warn(`[EXTRACT] ${filePath}: Failed to parse Gemini JSON — ${err instanceof Error ? err.message : String(err)}`);
    log.warn(`[EXTRACT] Raw response (first 200 chars): ${cleaned.slice(0, 200)}`);
  }

  return {};
}


// ══════════════════════════════════════════════════════════════════════════
// STEP 2: SDK TRANSLATE — lingo.dev SDK translates the extracted strings
// ══════════════════════════════════════════════════════════════════════════
// This is just translateObject() from lingo-client.ts
// SDK → our /api/process/localize → Gemini with mixed-language-aware prompt


// ══════════════════════════════════════════════════════════════════════════
// STEP 3: GEMINI REPLACE — Ask Gemini to apply translations back to the file
// ══════════════════════════════════════════════════════════════════════════

async function geminiReplaceStrings(
  originalContent: string,
  filePath: string,
  originalStrings: Record<string, string>,
  translatedStrings: Record<string, string>,
  targetLocale: string,
  brand: BrandContext,
): Promise<string> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!geminiApiKey) return originalContent;

  // Build the translation map: original → translated
  const translationMap: Record<string, string> = {};
  for (const key of Object.keys(originalStrings)) {
    if (translatedStrings[key]) {
      translationMap[originalStrings[key]] = translatedStrings[key];
    }
  }

  if (Object.keys(translationMap).length === 0) return originalContent;

  const brandList = brand.brandNames.length > 0
    ? brand.brandNames.join(", ")
    : "none detected";

  const prompt = `You are a precision file editor for website localization.

TARGET LOCALE: ${targetLocale}

TASK: Apply the translation map below to the file. Replace each original string with its translated version IN-PLACE on the same line.

TRANSLATION MAP:
${JSON.stringify(translationMap, null, 2)}

METADATA UPDATES:
- Set <html lang="..."> to "${targetLocale}"
- Set og:locale / locale: to "${targetLocale.replace("-", "_")}"
- Set inLanguage in any JSON-LD to "${targetLocale}"
- For hreflang alternates: ADD "${targetLocale}" as an alternate, keep existing alternates (en, es, etc.)
- Remove any data-aria-* attributes (stale from previous runs)
- Any user-visible string NOT in ${targetLocale} and NOT in the translation map → translate it to ${targetLocale} too. Output must be 100% ${targetLocale} for user-visible text.

BRAND NAME PROTECTION:
The original brand name is: "${brand.appName}"
All brand variations to preserve exactly: ${brandList}
- NEVER translate brand names. Keep them exactly as listed above.
- If you see a TRANSLATED version of the brand name from a previous locale run (e.g. "FacturaFlujo" instead of "InvoiceFlow", "발票플로우" instead of "InvoiceFlow"), REVERT it back to the original English brand name "${brand.appName}".
- Logo text (inside elements with class "logo", "footer-logo", "brand", or "navbar-brand") must use the original brand name, never a translation.

CRITICAL RULES:
1. Replace strings IN-PLACE on the same line — NEVER duplicate a key by adding a new line and keeping the old one. Each metadata key (title:, description:, locale:, etc.) must appear exactly ONCE.
2. ONLY change text strings and metadata values — NEVER modify code structure, imports, JSX syntax, component logic, CSS, class names, or TypeScript types
3. Preserve ALL formatting: indentation, line breaks, quotes (single vs double), semicolons, commas
4. The output must have the SAME number of lines as the input. Do NOT add or remove lines.
5. NEVER translate code comments (// or /* */). Comments are for developers, not users. Leave them in their original language.
6. SVG content (paths, coordinates, viewBox) must stay EXACTLY the same
7. If a string appears multiple times, translate ALL occurrences
8. Return the COMPLETE file — every single line, not just the changed parts

ORIGINAL FILE (${filePath}):
\`\`\`
${originalContent}
\`\`\`

Return the COMPLETE translated file. No markdown fences, no explanation, no truncation. Every line of the original must appear in your output.`;

  const result = await callGemini(geminiApiKey, geminiModel, prompt);

  // Strip markdown fences if Gemini wraps the output
  let cleaned = result;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:tsx|jsx|html|typescript|javascript)?\n?/i, "").replace(/\n?```$/i, "");
  }

  // Sanity check: the result should be roughly the same size as the original
  // If it's drastically shorter, Gemini truncated it — reject
  if (cleaned.length < originalContent.length * 0.5) {
    log.warn(`[REPLACE] ${filePath}: Gemini output too short (${cleaned.length} vs ${originalContent.length} original) — rejecting`);
    return originalContent;
  }

  // Sanity check: result should still contain key code patterns
  if (originalContent.includes("export") && !cleaned.includes("export")) {
    log.warn(`[REPLACE] ${filePath}: Gemini removed export statements — rejecting`);
    return originalContent;
  }

  log.ok(`[REPLACE] ${filePath}: Applied ${Object.keys(translationMap).length} translations`);
  return cleaned;
}


// ══════════════════════════════════════════════════════════════════════════
// MAIN FIXER — orchestrates extract → translate → replace for each file
// ══════════════════════════════════════════════════════════════════════════

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

  // ── Step 0a: Detect dominant source language (hint for SDK) ─────────
  const sourceLang = await detectSourceLocale(cloneDir);
  globalLog.push(`[DETECT] Dominant source language: "${sourceLang}" (Gemini handles mixed languages per-string)`);

  // ── Step 0b: Extract brand context ─────────────────────────────────
  const brand = await extractBrandContext(cloneDir);
  globalLog.push(`[BRAND] App name: "${brand.appName}" | Brand names: ${brand.brandNames.join(", ") || "none"}`);

  // ── Step 0c: Discover ALL translatable files ───────────────────────
  const allFiles = await discoverTranslatableFiles(cloneDir);
  const issueFiles = new Set(issues.map(i => i.filePath));
  for (const f of issueFiles) {
    if (f !== "sitemap.xml") allFiles.add(f);
  }
  globalLog.push(`[FIXER] Found ${allFiles.size} translatable files`);

  // ── Process each file with the 3-step pipeline ─────────────────────
  for (const filePath of allFiles) {
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
    const isTsx = [".tsx", ".jsx"].includes(ext);

    try {
      if (isHtml && fixModes.fullPage) {
        // For HTML full-page, use SDK's localizeHtml (it has a real DOM parser)
        log.info(`[FULL] ${filePath} → ${locale} (HTML)`);
        content = await translateHtml(content, sourceLang, locale);
        log.ok(`[FULL] ✓ ${filePath}`);
      } else if (isTsx || isHtml) {
        // ── THE THREE-STEP PIPELINE ───────────────────────────────

        // Step 1: Gemini extracts all translatable strings
        log.info(`[EXTRACT] ${filePath} — extracting strings with Gemini`);
        const extracted = await geminiExtractStrings(content, filePath, brand);

        if (Object.keys(extracted).length === 0) {
          globalLog.push(`[SKIP] ${filePath} — no translatable strings found`);
          continue;
        }

        // Add brand context for the SDK translation step
        if (brand.brandNames.length > 0) {
          extracted["__brand_context__"] = `BRAND NAMES (do not translate): ${brand.brandNames.join(", ")}`;
        }

        // Step 2: SDK translates the strings (lingo.dev SDK → our API → Gemini)
        log.info(`[TRANSLATE] ${filePath} — translating ${Object.keys(extracted).length} strings via SDK`);
        const translated = await translateObject(extracted, sourceLang, locale);

        // Step 3: Gemini applies translations back to the file
        log.info(`[REPLACE] ${filePath} — applying translations with Gemini`);
        content = await geminiReplaceStrings(
          content, filePath, extracted, translated, locale, brand
        );

        log.ok(`[DONE] ✓ ${filePath} → ${locale}`);
      }

      // Write if changed
      if (content !== originalContent) {
        await writeFile(fullPath, content, "utf-8");
        const mode = fixModes.fullPage ? "full-page" : [fixModes.seo && "seo", fixModes.aria && "aria"].filter(Boolean).join("+");
        fixResults.push({
          filePath,
          originalContent,
          newContent: content,
          issuesFixed: [mode || "translate"],
          log: [`${filePath} — ${mode} → ${locale}`],
        });
        globalLog.push(`[WRITE] ✓ ${filePath}`);
      }
    } catch (err) {
      log.err(`[FAIL] ✗ ${filePath}`, err);
      globalLog.push(`[FAIL] ✗ ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Fix Font Awesome: if fa- classes found but no FA stylesheet, add CDN ──
  await fixFontAwesome(cloneDir, globalLog);

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


// ── Font Awesome CDN injection ────────────────────────────────────────
// If any file uses fa- classes (fa-brands, fa-solid, etc.) but no FA
// stylesheet is loaded, inject the CDN link into layout.tsx or index.html.

const FA_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';

async function fixFontAwesome(cloneDir: string, globalLog: string[]): Promise<void> {
  // Check if any file uses FA icons
  let usesFa = false;
  const filesToCheck = ["app/page.tsx", "app/page.jsx", "src/app/page.tsx", "index.html"];
  for (const f of filesToCheck) {
    try {
      const content = await readFile(join(cloneDir, f), "utf-8");
      if (content.includes("fa-brands") || content.includes("fa-solid") || content.includes("fa-regular")) {
        usesFa = true;
        break;
      }
    } catch {}
  }

  if (!usesFa) return;

  // Check if FA is already loaded in layout
  const layoutCandidates = ["app/layout.tsx", "app/layout.jsx", "src/app/layout.tsx", "index.html", "public/index.html"];
  for (const f of layoutCandidates) {
    try {
      let content = await readFile(join(cloneDir, f), "utf-8");

      // Already has FA? Skip.
      if (content.includes("font-awesome") || content.includes("fontawesome")) return;

      // Inject FA CDN link
      if (f.endsWith(".html")) {
        // HTML: add before </head>
        if (content.includes("</head>")) {
          content = content.replace("</head>", `  <link rel="stylesheet" href="${FA_CDN}" />\n</head>`);
          await writeFile(join(cloneDir, f), content, "utf-8");
          globalLog.push(`[FA] ✓ Added Font Awesome CDN to ${f}`);
          log.ok(`[FA] ✓ Added Font Awesome CDN to ${f}`);
          return;
        }
      } else {
        // TSX layout: add a <link> inside <head> or before <body>
        // Next.js App Router: metadata export handles <head>, but we can add via the layout JSX
        // The simplest: add an import and <link> in the <html> <head>
        if (content.includes("<body>")) {
          const faLink = `\n        <head>\n          <link rel="stylesheet" href="${FA_CDN}" />\n        </head>`;
          content = content.replace("<body>", `${faLink}\n        <body>`);
          await writeFile(join(cloneDir, f), content, "utf-8");
          globalLog.push(`[FA] ✓ Added Font Awesome CDN to ${f}`);
          log.ok(`[FA] ✓ Added Font Awesome CDN to ${f}`);
          return;
        }
      }
    } catch {}
  }
}
