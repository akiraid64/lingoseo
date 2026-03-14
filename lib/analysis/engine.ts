import { readdir, readFile, stat } from "fs/promises";
import { join, extname, relative } from "path";
import { runAllScanners } from "./scanners";
import { calculateSeoScore } from "@/lib/translation/seo-optimizer";
import type { AnalysisResult, SeoIssue } from "@/types";

const SCANNABLE_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".jsx",
  ".tsx",
  ".astro",
  ".vue",
  ".svelte",
  ".php",
  ".ejs",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".vercel",
  ".lingo",
]);

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await walkDir(fullPath);
      files.push(...subFiles);
    } else if (SCANNABLE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    } else if (entry.name === "sitemap.xml") {
      files.push(fullPath);
    }
  }

  return files;
}

// Detect locale files/folders to understand what locales the project uses
async function detectLocales(cloneDir: string): Promise<string[]> {
  const locales: Set<string> = new Set();
  const localePattern = /^[a-z]{2}(-[A-Z]{2})?$/;

  try {
    // Check for i18n.json (lingo.dev config)
    const i18nConfig = join(cloneDir, "i18n.json");
    try {
      const content = await readFile(i18nConfig, "utf-8");
      const config = JSON.parse(content);
      if (config.locale?.targets) {
        for (const t of config.locale.targets) locales.add(t);
      }
      if (config.locale?.source) locales.add(config.locale.source);
    } catch {}

    // Check for common locale directories
    for (const dir of ["locales", "locale", "i18n", "lang", "languages", "messages", "translations"]) {
      try {
        const localeDir = join(cloneDir, dir);
        const entries = await readdir(localeDir, { withFileTypes: true });
        for (const entry of entries) {
          const name = entry.name.replace(/\.(json|yaml|yml|ts|js)$/, "");
          if (localePattern.test(name)) locales.add(name);
        }
      } catch {}
    }

    // Check for next-intl / next.config locale configs
    for (const configFile of ["next.config.js", "next.config.ts", "next.config.mjs"]) {
      try {
        const content = await readFile(join(cloneDir, configFile), "utf-8");
        const localeMatches = content.match(/['"]([a-z]{2}(-[A-Z]{2})?)['"]/g);
        if (localeMatches) {
          for (const m of localeMatches) {
            const cleaned = m.replace(/['"]/g, "");
            if (localePattern.test(cleaned)) locales.add(cleaned);
          }
        }
      } catch {}
    }
  } catch {}

  return Array.from(locales);
}

export async function analyzeRepo(
  cloneDir: string,
  repoUrl: string
): Promise<AnalysisResult> {
  const files = await walkDir(cloneDir);
  const allIssues: SeoIssue[] = [];

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(cloneDir, filePath);
      const issues = runAllScanners(relPath, content);
      allIssues.push(...issues);
    } catch {}
  }

  // Check for sitemap.xml at root
  try {
    await stat(join(cloneDir, "public", "sitemap.xml"));
  } catch {
    try {
      await stat(join(cloneDir, "sitemap.xml"));
    } catch {
      allIssues.push({
        id: crypto.randomUUID(),
        type: "missing-sitemap-locales",
        severity: "warning",
        filePath: "sitemap.xml",
        message: "No sitemap.xml found — needed for search engine indexing of locale pages",
      });
    }
  }

  const locales = await detectLocales(cloneDir);

  const summary = {
    critical: allIssues.filter((i) => i.severity === "critical").length,
    warning: allIssues.filter((i) => i.severity === "warning").length,
    info: allIssues.filter((i) => i.severity === "info").length,
  };

  const score = calculateSeoScore(allIssues);

  return {
    repoUrl,
    repoName: repoUrl.split("/").slice(-2).join("/"),
    scannedFiles: files.length,
    issues: allIssues,
    summary,
    localesDetected: locales,
    score,
    timestamp: new Date().toISOString(),
  };
}
