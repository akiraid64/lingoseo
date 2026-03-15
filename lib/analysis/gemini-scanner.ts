import { GoogleGenAI } from "@google/genai";
import type { SeoIssue, IssueType, Severity } from "@/types";
import { randomUUID } from "crypto";

/**
 * Gemini-powered semantic scanner.
 * Runs AFTER the pattern-based scanners and catches issues that
 * require understanding content meaning — not just tag presence.
 *
 * Examples of what it catches that Cheerio misses:
 * - Title exists but says "Untitled" or "Page" or is gibberish
 * - Meta description exists but is filler ("Welcome to our website")
 * - ARIA labels present but useless ("button", "click here", "icon")
 * - Alt text present but wrong ("image1.png" not replaced)
 * - hreflang present but using wrong locale codes ("esp" instead of "es")
 * - Content clearly not in the right language
 * - Schema markup present but missing required fields
 */
export async function runGeminiScanner(params: {
  geminiApiKey: string;
  modelName: string;
  filePath: string;
  fileContent: string;
  existingIssueTypes: Set<string>; // avoid exact duplicates with pattern scanner
}): Promise<SeoIssue[]> {
  const { geminiApiKey, modelName, filePath, fileContent, existingIssueTypes } = params;

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const prompt = `You are a professional SEO and web accessibility auditor. Analyze this file for SEO and accessibility issues that require understanding the actual content — not just checking if tags exist.

FILE: ${filePath}
CONTENT:
${fileContent.slice(0, 8000)}

YOUR JOB:
Find issues that a simple pattern scanner would MISS because it requires reading and understanding the content. Examples:
- A <title> tag that says "Untitled", "Home", "Page", or is too generic
- A meta description that says "Welcome to our website" or is copy-pasted filler
- An aria-label that says "button", "click here", "icon", "img", or is not descriptive
- Alt text that is a filename like "image1.jpg" or "photo.png" instead of a real description
- hreflang tags using wrong codes ("esp" instead of "es", "ch" instead of "zh")
- A title/description that exists in English on a page that appears to be serving another language
- Schema markup present but with missing required fields or wrong types
- Open Graph tags present but with placeholder values like "TODO" or empty strings
- Canonical URL pointing to wrong domain or a 404 path
- ARIA labels that are technically present but describe the wrong thing
- Content that is clearly AI-generated filler text with no real SEO value

IMPORTANT: Only report issues you are CONFIDENT about. Do not hallucinate issues that don't exist.

Return a JSON array of issues. Each issue must match this exact structure:
{
  "type": one of: "missing-title" | "missing-meta-description" | "missing-og-tags" | "missing-twitter-tags" | "missing-hreflang" | "untranslated-alt" | "missing-html-lang" | "missing-sitemap-locales" | "unoptimized-headings" | "untranslated-aria-labels" | "untranslated-sr-only" | "missing-canonical" | "missing-viewport" | "invalid-schema",
  "severity": "critical" | "warning" | "info",
  "message": "plain English explanation of the specific problem found (mention the actual bad value)",
  "currentValue": "the actual problematic text/value found in the file",
  "suggestedFix": "what it should say instead (be specific)"
}

Return ONLY a JSON array. No markdown, no explanation. If no issues found, return [].

ISSUES FOUND:`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { temperature: 0.1 },
    });

    const raw = response.text?.trim() || "[]";
    const cleaned = raw
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const validTypes = new Set<IssueType>([
      "missing-title", "missing-meta-description", "missing-og-tags",
      "missing-twitter-tags", "missing-hreflang", "untranslated-alt",
      "missing-html-lang", "missing-sitemap-locales", "unoptimized-headings",
      "untranslated-aria-labels", "untranslated-sr-only", "missing-canonical",
      "missing-viewport", "invalid-schema",
    ]);

    const validSeverities = new Set<Severity>(["critical", "warning", "info"]);

    return parsed
      .filter((item: any) => {
        // Validate structure
        if (!item.type || !item.severity || !item.message) return false;
        if (!validTypes.has(item.type)) return false;
        if (!validSeverities.has(item.severity)) return false;
        // Skip if pattern scanner already found the exact same issue type
        if (existingIssueTypes.has(item.type)) return false;
        return true;
      })
      .map((item: any): SeoIssue => ({
        id: `gemini-${randomUUID()}`,
        type: item.type as IssueType,
        severity: item.severity as Severity,
        filePath,
        message: `[AI] ${item.message}`,
        currentValue: item.currentValue,
        suggestedFix: item.suggestedFix,
      }));

  } catch (err) {
    console.error(`[gemini-scanner] Failed for ${filePath}:`, err);
    return [];
  }
}
