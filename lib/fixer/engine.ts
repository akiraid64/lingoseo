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
} from "@/lib/translation/seo-optimizer";

interface FixerParams {
  cloneDir: string;
  issues: SeoIssue[];
  geminiApiKey: string;
  modelName: string;
  targetLocales: string[];
  lingoApiKey: string;
}

export async function applyFixes(params: FixerParams): Promise<FixResult[]> {
  const {
    cloneDir,
    issues,
    geminiApiKey,
    modelName,
    targetLocales,
    lingoApiKey,
  } = params;

  // Group issues by file
  const issuesByFile = new Map<string, SeoIssue[]>();
  for (const issue of issues) {
    const existing = issuesByFile.get(issue.filePath) || [];
    existing.push(issue);
    issuesByFile.set(issue.filePath, existing);
  }

  const fixResults: FixResult[] = [];

  for (const [filePath, fileIssues] of issuesByFile) {
    // Skip virtual files like sitemap.xml that don't exist yet
    const fullPath = join(cloneDir, filePath);

    let content: string;
    try {
      content = await readFile(fullPath, "utf-8");
    } catch {
      // Handle sitemap.xml creation separately
      if (filePath === "sitemap.xml" && targetLocales.length > 0) {
        const sitemapResult = await createSitemap(
          cloneDir,
          targetLocales,
          geminiApiKey,
          modelName
        );
        if (sitemapResult) fixResults.push(sitemapResult);
      }
      continue;
    }

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
              // One translateObject call translates ALL aria strings at once
              const translated = await translateObject(
                lingoApiKey,
                ariaMap,
                "en",
                locale
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
                locale
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
        console.error(`Failed to fix ${issue.type} in ${filePath}:`, err);
      }
    }

    if (fixedIssueIds.length > 0) {
      const newContent = $.html();
      await writeFile(fullPath, newContent, "utf-8");

      fixResults.push({
        filePath,
        originalContent,
        newContent,
        issuesFixed: fixedIssueIds,
      });
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
        lingoApiKey
      );
      fixResults.push(...localeFilesResult);
    }
  }

  return fixResults;
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
  lingoApiKey: string
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
      locale
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
    const sitemap = await generateSitemapWithLocales({
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
