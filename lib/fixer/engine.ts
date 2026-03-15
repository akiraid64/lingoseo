import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import * as cheerio from "cheerio";
import type { SeoIssue, FixResult } from "@/types";
import {
  translateText,
  translateObject,
  batchTranslateText,
  translateHtml,
} from "@/lib/translation/lingo-client";
import {
  optimizeSeoContent,
  generateHreflangTags,
  generateSitemapWithLocales,
  calculateSeoScore,
  callGemini,
} from "@/lib/translation/seo-optimizer";

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
  lingoApiKey: string;
  fixModes: FixModes;
}

export async function applyFixes(params: FixerParams): Promise<FixResult[]> {
  const {
    cloneDir,
    issues,
    geminiApiKey,
    modelName,
    targetLocales,
    lingoApiKey,
    fixModes,
  } = params;

  const SEO_ISSUE_TYPES = new Set([
    "missing-title", "title-too-short", "title-too-long",
    "missing-meta-description", "meta-description-too-long",
    "missing-hreflang", "missing-og-tags", "missing-twitter-tags",
    "missing-canonical", "missing-viewport", "missing-html-lang",
    "unoptimized-headings", "missing-schema", "invalid-schema",
  ]);

  const ARIA_ISSUE_TYPES = new Set([
    "untranslated-aria-labels", "untranslated-sr-only",
  ]);

  const filteredIssues = issues.filter((issue) => {
    if (SEO_ISSUE_TYPES.has(issue.type)) return fixModes.seo;
    if (ARIA_ISSUE_TYPES.has(issue.type)) return fixModes.aria;
    return true;
  });

  // Group issues by file
  const issuesByFile = new Map<string, SeoIssue[]>();
  for (const issue of filteredIssues) {
    const existing = issuesByFile.get(issue.filePath) || [];
    existing.push(issue);
    issuesByFile.set(issue.filePath, existing);
  }

  const fixResults: FixResult[] = [];
  const globalLog: string[] = [];

  globalLog.push(`[FIXER] Starting — ${filteredIssues.length} issues across ${issuesByFile.size} files`);
  globalLog.push(`[FIXER] Modes: SEO=${fixModes.seo} ARIA=${fixModes.aria} FULLPAGE=${fixModes.fullPage}`);
  globalLog.push(`[FIXER] Target locales: ${targetLocales.join(", ") || "none"}`);

  for (const [filePath, fileIssues] of issuesByFile) {
    const fullPath = join(cloneDir, filePath);
    const isTsx = /\.(tsx|jsx|ts|js)$/.test(filePath);

    let content: string;
    try {
      content = await readFile(fullPath, "utf-8");
      globalLog.push(`[READ] ${filePath} (${content.length} chars, ${isTsx ? "TSX/JSX → Gemini" : "HTML → Cheerio"})`);
    } catch {
      if (filePath === "sitemap.xml" && targetLocales.length > 0) {
        globalLog.push(`[SITEMAP] Creating sitemap.xml with ${targetLocales.length} locales`);
        const sitemapResult = await createSitemap(cloneDir, targetLocales, geminiApiKey, modelName);
        if (sitemapResult) {
          sitemapResult.log = [`[SITEMAP] Created with locales: ${targetLocales.join(", ")}`];
          fixResults.push(sitemapResult);
          globalLog.push(`[SITEMAP] ✓ Created`);
        }
      } else {
        globalLog.push(`[SKIP] ${filePath} — file not found`);
      }
      continue;
    }

    // ── TSX/JSX: Gemini understands React/Next.js patterns ──
    if (isTsx) {
      globalLog.push(`[GEMINI] Analyzing ${filePath} with ${fileIssues.length} issues...`);
      try {
        const result = await fixTsxWithGemini({
          filePath, content, issues: fileIssues,
          geminiApiKey, modelName, targetLocales,
          lingoApiKey, fixModes,
        });
        if (result.newContent !== content) {
          await writeFile(fullPath, result.newContent, "utf-8");
          fixResults.push({
            filePath,
            originalContent: content,
            newContent: result.newContent,
            issuesFixed: result.fixedIssueIds,
            log: result.log,
          });
          globalLog.push(`[GEMINI] ✓ ${filePath} — fixed ${result.fixedIssueIds.length} issues`);
        } else {
          globalLog.push(`[GEMINI] ⚠ ${filePath} — Gemini returned unchanged content`);
        }
      } catch (err) {
        globalLog.push(`[GEMINI] ✗ ${filePath} — ${err instanceof Error ? err.message : String(err)}`);
        console.error(`[FIXER] Gemini failed for ${filePath}:`, err);
      }
      continue;
    }

    // ── HTML: Cheerio path ──
    const originalContent = content;
    const $ = cheerio.load(content);
    const fixedIssueIds: string[] = [];

    for (const issue of fileIssues) {
      try {
        switch (issue.type) {
          case "missing-html-lang": {
            $("html").attr("lang", "en");
            fixedIssueIds.push(issue.id);
            break;
          }

          case "missing-title": {
            if ($("title").length === 0) {
              $("head").append("<title></title>");
            }
            const currentTitle = $("title").text() || "";

            if (lingoApiKey && currentTitle) {
              // Step 1: Use lingo.dev to translate title to all target locales
              // This creates the base translations
              const translations = await batchTranslateText(
                lingoApiKey,
                currentTitle,
                "en",
                targetLocales
              );

              // Step 2: Use Gemini to optimize translations for search keywords
              for (const [locale, translated] of Object.entries(translations)) {
                const optimized = await optimizeSeoContent({
                  geminiApiKey,
                  modelName,
                  content: translated,
                  locale,
                  contentType: "title tag",
                  context: `Original English: "${currentTitle}". This was translated by lingo.dev. Now optimize the translated text for SEO search intent in locale "${locale}". Use keywords people actually search for.`,
                });
                translations[locale] = optimized;
              }

              // Store translations as data attributes for locale routing
              for (const [locale, text] of Object.entries(translations)) {
                $("title").attr(`data-lingo-${locale}`, text);
              }
            }

            if (!currentTitle) {
              // Generate title with Gemini from page content
              const pageText = $("body").text().slice(0, 500);
              const generated = await optimizeSeoContent({
                geminiApiKey,
                modelName,
                content: pageText,
                locale: "en",
                contentType: "title tag",
                context: "Generate an SEO-optimized page title under 60 characters.",
              });
              $("title").text(generated);
            }

            fixedIssueIds.push(issue.id);
            break;
          }

          case "missing-meta-description": {
            const existing = $('meta[name="description"]');
            let descContent = existing.attr("content") || "";

            if (existing.length === 0 || !descContent.trim() || descContent.length < 50) {
              // Generate/improve description with Gemini
              const pageText = $("body").text().slice(0, 500);
              const generated = await optimizeSeoContent({
                geminiApiKey,
                modelName,
                content: descContent || pageText,
                locale: "en",
                contentType: "meta description",
                context: "Write a meta description of 120-160 characters for search results.",
              });

              if (existing.length === 0) {
                $("head").append(
                  `<meta name="description" content="${generated.replace(/"/g, "&quot;")}" />`
                );
              } else {
                existing.attr("content", generated);
              }
              descContent = generated;
            }

            // Translate description to all locales via lingo.dev
            if (lingoApiKey && descContent && targetLocales.length > 0) {
              const translations = await batchTranslateText(
                lingoApiKey,
                descContent,
                "en",
                targetLocales
              );

              // Optimize each translation for SEO
              for (const [locale, translated] of Object.entries(translations)) {
                const optimized = await optimizeSeoContent({
                  geminiApiKey,
                  modelName,
                  content: translated,
                  locale,
                  contentType: "meta description",
                  context: `Original English: "${descContent}". Translated by lingo.dev. Optimize for search intent in "${locale}". Keep 120-160 chars.`,
                });
                translations[locale] = optimized;
              }

              // Add locale-specific meta tags as comments for developer reference
              const metaComment = Object.entries(translations)
                .map(([locale, text]) => `<!-- ${locale}: ${text.replace(/--/g, "- -")} -->`)
                .join("\n    ");
              $('meta[name="description"]').after("\n    " + metaComment);
            }

            fixedIssueIds.push(issue.id);
            break;
          }

          case "missing-og-tags": {
            const title = $("title").text() || "";
            const desc = $('meta[name="description"]').attr("content") || "";

            if ($('meta[property="og:title"]').length === 0 && title) {
              $("head").append(
                `<meta property="og:title" content="${title.replace(/"/g, "&quot;")}" />`
              );
            }
            if ($('meta[property="og:description"]').length === 0 && desc) {
              $("head").append(
                `<meta property="og:description" content="${desc.replace(/"/g, "&quot;")}" />`
              );
            }
            if ($('meta[property="og:image"]').length === 0) {
              $("head").append(
                `<meta property="og:image" content="/og-image.png" />`
              );
            }
            if ($('meta[property="og:type"]').length === 0) {
              $("head").append(
                `<meta property="og:type" content="website" />`
              );
            }
            fixedIssueIds.push(issue.id);
            break;
          }

          case "missing-twitter-tags": {
            if ($('meta[name="twitter:card"]').length === 0) {
              $("head").append(
                `<meta name="twitter:card" content="summary_large_image" />`
              );
            }
            fixedIssueIds.push(issue.id);
            break;
          }

          case "missing-hreflang": {
            if (targetLocales.length > 0) {
              const tags = await generateHreflangTags({
                geminiApiKey,
                modelName,
                baseUrl: "",
                locales: ["en", ...targetLocales],
                currentPath: "/" + filePath.replace(/\\/g, "/"),
              });
              $("head").append("\n" + tags + "\n");
              fixedIssueIds.push(issue.id);
            }
            break;
          }

          case "untranslated-alt": {
            // Translate alt text using lingo.dev SDK
            const imgElements = $("img").toArray();
            for (const el of imgElements) {
              const alt = $(el).attr("alt");
              if (!alt || !alt.trim()) {
                const src = $(el).attr("src") || "image";
                const filename =
                  src.split("/").pop()?.replace(/\.[^.]+$/, "") || "image";
                const readableAlt = filename.replace(/[-_]/g, " ");
                $(el).attr("alt", readableAlt);

                // Translate alt text to all locales via lingo.dev
                if (lingoApiKey && targetLocales.length > 0) {
                  const translations = await batchTranslateText(
                    lingoApiKey,
                    readableAlt,
                    "en",
                    targetLocales
                  );
                  // Store as data attributes
                  for (const [locale, text] of Object.entries(translations)) {
                    $(el).attr(`data-alt-${locale}`, text);
                  }
                }
              }
            }
            fixedIssueIds.push(issue.id);
            break;
          }

          case "unoptimized-headings": {
            // Translate headings using lingo.dev
            if (lingoApiKey && targetLocales.length > 0) {
              const h1 = $("h1").first();
              const h1Text = h1.text();
              if (h1Text) {
                const translations = await batchTranslateText(
                  lingoApiKey,
                  h1Text,
                  "en",
                  targetLocales
                );
                // Store locale translations as data attributes
                for (const [locale, text] of Object.entries(translations)) {
                  h1.attr(`data-lingo-${locale}`, text);
                }
              }
            }
            fixedIssueIds.push(issue.id);
            break;
          }

          case "untranslated-aria-labels": {
            // Collect ALL aria-label strings in the file into one object
            // then use lingo.dev's translateObject() — ONE call per locale
            // translates ALL of them at once
            if (!lingoApiKey || targetLocales.length === 0) break;

            const ariaMap: Record<string, string> = {};
            $("[aria-label]").each((i, el) => {
              const val = $(el).attr("aria-label") || "";
              if (val.trim()) ariaMap[`aria_${i}`] = val;
            });

            if (Object.keys(ariaMap).length === 0) {
              fixedIssueIds.push(issue.id);
              break;
            }

            for (const locale of targetLocales) {
              const translated = await translateObject(
                lingoApiKey,
                ariaMap,
                "en",
                locale,
                geminiApiKey,
                "aria"
              );

              $("[aria-label]").each((i, el) => {
                const key = `aria_${i}`;
                if (translated[key]) {
                  $(el).attr(`data-aria-${locale}`, translated[key]);
                }
              });
            }

            fixedIssueIds.push(issue.id);
            break;
          }

          case "untranslated-sr-only": {
            // Same pattern: collect ALL sr-only text → translateObject() → write back
            if (!lingoApiKey || targetLocales.length === 0) break;

            const srSelectors = [
              ".sr-only",
              ".visually-hidden",
              ".screen-reader-only",
              ".screen-reader-text",
              '[class*="sr-only"]',
              '[class*="visually-hidden"]',
            ].join(", ");

            const srMap: Record<string, string> = {};
            $(srSelectors).each((i, el) => {
              const text = $(el).text().trim();
              if (text) srMap[`sr_${i}`] = text;
            });

            if (Object.keys(srMap).length === 0) {
              fixedIssueIds.push(issue.id);
              break;
            }

            for (const locale of targetLocales) {
              const translated = await translateObject(
                lingoApiKey,
                srMap,
                "en",
                locale,
                geminiApiKey,
                "aria"
              );

              $(srSelectors).each((i, el) => {
                const key = `sr_${i}`;
                if (translated[key]) {
                  $(el).attr(`data-sr-${locale}`, translated[key]);
                }
              });
            }

            fixedIssueIds.push(issue.id);
            break;
          }

          default:
            break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        globalLog.push(`[CHEERIO] ✗ ${issue.type} in ${filePath}: ${msg}`);
        console.error(`[FIXER] Failed to fix ${issue.type} in ${filePath}:`, err);
      }
    }

    if (fixedIssueIds.length > 0) {
      const newContent = $.html();
      await writeFile(fullPath, newContent, "utf-8");
      globalLog.push(`[CHEERIO] ✓ ${filePath} — fixed: ${fixedIssueIds.join(", ")}`);
      fixResults.push({
        filePath,
        originalContent,
        newContent,
        issuesFixed: fixedIssueIds,
        log: fixedIssueIds.map(id => `Fixed ${id}`),
      });
    } else {
      globalLog.push(`[CHEERIO] ⚠ ${filePath} — no fixes applied (${fileIssues.length} issues found but no HTML elements matched)`);
    }
  }

  // Full page translation using lingo.dev localizeHtml
  if (fixModes.fullPage && lingoApiKey && targetLocales.length > 0) {
    for (const [filePath] of issuesByFile) {
      const fullPath = join(cloneDir, filePath);
      try {
        const html = await readFile(fullPath, "utf-8");
        for (const locale of targetLocales) {
          const translated = await translateHtml(lingoApiKey, html, "en", locale);
          const localePath = filePath.replace(/(\.[^.]+)$/, `.${locale}$1`);
          const localeFullPath = join(cloneDir, localePath);
          await mkdir(dirname(localeFullPath), { recursive: true });
          await writeFile(localeFullPath, translated, "utf-8");
          fixResults.push({
            filePath: localePath,
            originalContent: "",
            newContent: translated,
            issuesFixed: [`full-page-${locale}`],
          });
        }
      } catch {
        // skip files that can't be read
      }
    }
  }

  // Generate locale JSON files with translated SEO metadata using lingo.dev
  if (lingoApiKey && targetLocales.length > 0) {
    const seoMetadata = extractSeoMetadata(fixResults);
    if (Object.keys(seoMetadata).length > 0) {
      const localeFilesResult = await generateLocaleFiles(
        cloneDir,
        seoMetadata,
        targetLocales,
        lingoApiKey,
        geminiApiKey
      );
      fixResults.push(...localeFilesResult);
    }
  }

  globalLog.push(`[FIXER] Done — ${fixResults.length} files modified`);

  // Attach global log to first result so it surfaces in the PR
  if (fixResults.length > 0) {
    fixResults[0].log = [...globalLog, ...(fixResults[0].log || [])];
  } else {
    // No fixes — return a dummy entry so the log is accessible
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

// ── Gemini-powered TSX/JSX fixer ──────────────────────────────────────────

async function fixTsxWithGemini(params: {
  filePath: string;
  content: string;
  issues: SeoIssue[];
  geminiApiKey: string;
  modelName: string;
  targetLocales: string[];
  lingoApiKey: string;
  fixModes: FixModes;
}): Promise<{ newContent: string; fixedIssueIds: string[]; log: string[] }> {
  const { filePath, content, issues, geminiApiKey, modelName, targetLocales, fixModes, lingoApiKey } = params;
  const log: string[] = [];

  // Collect SEO strings for lingo.dev translation first
  const seoStrings: Record<string, string> = {};
  issues.forEach((issue, i) => {
    if (issue.currentValue) seoStrings[`issue_${i}`] = issue.currentValue;
  });

  // Batch translate with lingo.dev if we have strings and locales
  let translations: Record<string, Record<string, string>> = {};
  if (lingoApiKey && targetLocales.length > 0 && Object.keys(seoStrings).length > 0) {
    log.push(`[LINGO] Batch translating ${Object.keys(seoStrings).length} strings to ${targetLocales.length} locales`);
    for (const locale of targetLocales) {
      try {
        translations[locale] = await translateObject(lingoApiKey, seoStrings, "en", locale);
        log.push(`[LINGO] ✓ ${locale}: ${Object.keys(translations[locale]).length} strings translated`);
      } catch (err) {
        log.push(`[LINGO] ✗ ${locale}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const issueList = issues
    .map(i => `- [${i.severity.toUpperCase()}] ${i.type}: ${i.message}${i.currentValue ? ` (current: "${i.currentValue}")` : ""}`)
    .join("\n");

  const localeBlock = targetLocales.length > 0
    ? `\nTARGET LOCALES: ${targetLocales.join(", ")} — add translated versions as described below.`
    : "";

  const seoInstructions = fixModes.seo ? `
SEO FIXES (this is a Next.js App Router project):
- Add or update: export const metadata: Metadata = { title: "...", description: "...", openGraph: { title, description, images }, twitter: { card: "summary_large_image" }, alternates: { canonical: "/", languages: { ${targetLocales.map(l => `"${l}": "/${l}"`).join(", ")} } } }
- Add if missing: export const viewport: Viewport = { width: "device-width", initialScale: 1 }
- Import Metadata and Viewport from "next"
- Title: 50-60 chars, include primary keyword. Description: 150-160 chars, compelling.
- For hreflang: use metadata.alternates.languages with ISO 639-1 codes` : "";

  const ariaInstructions = fixModes.aria ? `
ARIA FIXES:
- Find all aria-label="..." in JSX
- Add data-aria-{locale}="translated" attributes for each target locale
- Find className="sr-only" elements, add data-sr-{locale}="translated"
- Use lingo.dev translated values if available` : "";

  const fullPageInstructions = fixModes.fullPage ? `
FULL PAGE:
- Wrap visible text strings in translation-ready format
- Add data-locale attributes to mark translatable sections` : "";

  const prompt = `You are an expert Next.js developer. Fix SEO and accessibility issues in this file.

FILE: ${filePath}
ISSUES TO FIX:
${issueList}
${localeBlock}
${seoInstructions}
${ariaInstructions}
${fullPageInstructions}

CURRENT FILE CONTENT:
${content.slice(0, 10000)}

RULES:
- Return ONLY the complete modified TypeScript/TSX file content
- Do NOT wrap in markdown code blocks
- Do NOT change visual styles, layout, or component logic
- Only ADD metadata exports, viewport exports, and aria/data attributes
- Preserve all existing imports and code exactly

FIXED FILE:`;

  log.push(`[GEMINI] Sending ${filePath} to ${modelName} (${issues.length} issues, ${content.length} chars)`);

  const fixed = await callGemini(geminiApiKey, modelName, prompt);

  if (!fixed || fixed.length < 50) {
    log.push(`[GEMINI] ✗ Empty or too-short response (${fixed?.length ?? 0} chars)`);
    throw new Error("Gemini returned empty response");
  }

  // Strip markdown fences if Gemini added them anyway
  const cleaned = fixed
    .replace(/^```(?:tsx?|jsx?|typescript)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  log.push(`[GEMINI] ✓ Response: ${cleaned.length} chars`);

  return {
    newContent: cleaned,
    fixedIssueIds: issues.map(i => i.id),
    log,
  };
}

/**
 * Extract all SEO-relevant text from fixed files into a structured object
 */
function extractSeoMetadata(
  fixes: FixResult[]
): Record<string, string> {
  const metadata: Record<string, string> = {};

  for (const fix of fixes) {
    const $ = cheerio.load(fix.newContent);
    const title = $("title").text();
    const desc = $('meta[name="description"]').attr("content");
    const h1 = $("h1").first().text();

    if (title) metadata[`${fix.filePath}:title`] = title;
    if (desc) metadata[`${fix.filePath}:description`] = desc;
    if (h1) metadata[`${fix.filePath}:h1`] = h1;
  }

  return metadata;
}

/**
 * Generate locale-specific JSON files with lingo.dev translated SEO content.
 * These files can be consumed by i18n frameworks.
 */
async function generateLocaleFiles(
  cloneDir: string,
  seoMetadata: Record<string, string>,
  targetLocales: string[],
  lingoApiKey: string,
  geminiApiKey?: string
): Promise<FixResult[]> {
  const results: FixResult[] = [];
  const localesDir = join(cloneDir, "locales", "seo");

  try {
    await mkdir(localesDir, { recursive: true });
  } catch {}

  // Use lingo.dev's localizeObject to translate ALL metadata at once per locale
  for (const locale of targetLocales) {
    const translated = await translateObject(
      lingoApiKey,
      seoMetadata,
      "en",
      locale,
      geminiApiKey,
      "seo"
    );

    const filePath = join("locales", "seo", `${locale}.json`);
    const fullPath = join(cloneDir, filePath);
    const content = JSON.stringify(translated, null, 2);

    await writeFile(fullPath, content, "utf-8");

    results.push({
      filePath,
      originalContent: "",
      newContent: content,
      issuesFixed: [`seo-locale-${locale}`],
    });
  }

  // Also write the source locale file
  const sourceFilePath = join("locales", "seo", "en.json");
  const sourceContent = JSON.stringify(seoMetadata, null, 2);
  await writeFile(join(cloneDir, sourceFilePath), sourceContent, "utf-8");

  results.push({
    filePath: sourceFilePath,
    originalContent: "",
    newContent: sourceContent,
    issuesFixed: ["seo-locale-en"],
  });

  return results;
}

/**
 * Create sitemap.xml with locale alternates
 */
async function createSitemap(
  cloneDir: string,
  targetLocales: string[],
  geminiApiKey: string,
  modelName: string
): Promise<FixResult | null> {
  try {
    const sitemap = generateSitemapWithLocales({
      baseUrl: "",
      locales: ["en", ...targetLocales],
      pages: ["/"],
    });

    const sitemapPath = join("public", "sitemap.xml");
    const fullPath = join(cloneDir, sitemapPath);

    try {
      await mkdir(dirname(fullPath), { recursive: true });
    } catch {}

    await writeFile(fullPath, sitemap, "utf-8");

    return {
      filePath: sitemapPath,
      originalContent: "",
      newContent: sitemap,
      issuesFixed: ["sitemap-locales"],
    };
  } catch {
    return null;
  }
}
