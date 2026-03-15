import { auth } from "@/auth";
import { cloneRepo } from "@/lib/github/clone";
import { analyzeRepo } from "@/lib/analysis/engine";
import { applyFixes } from "@/lib/fixer/engine";
import { pushBranchAndCreatePr } from "@/lib/github/pr";
import { rm } from "fs/promises";
import type { ExtendedSession } from "@/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const session = (await auth()) as ExtendedSession | null;
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const geminiApiKey = req.headers.get("x-gemini-api-key");
  if (!geminiApiKey) {
    return Response.json(
      { error: "Missing Gemini API key" },
      { status: 401 }
    );
  }

  const lingoApiKey = req.headers.get("x-lingo-api-key") || process.env.LINGO_API_KEY || "";

  const { repoUrl, modelName, targetLocale, fixModes } = await req.json();
  const targetLocales = targetLocale ? [targetLocale] : [];
  if (!repoUrl || !modelName) {
    return Response.json(
      { error: "Missing repoUrl or modelName" },
      { status: 400 }
    );
  }

  let cloneDir: string | null = null;

  try {
    // Clone
    const cloned = await cloneRepo(repoUrl, session.accessToken);
    cloneDir = cloned.cloneDir;

    // Analyze
    const analysis = await analyzeRepo(cloneDir, repoUrl);

    if (analysis.issues.length === 0) {
      return Response.json({
        message: "No SEO issues found — your repo is clean!",
        analysis,
      });
    }

    // Fix
    const fixes = await applyFixes({
      cloneDir,
      issues: analysis.issues,
      geminiApiKey,
      modelName,
      targetLocales: targetLocales || analysis.localesDetected || [],
      lingoApiKey,
      fixModes: fixModes || { seo: true, aria: true, fullPage: false },
    });

    if (fixes.length === 0) {
      return Response.json({
        message: "Issues found but no automatic fixes could be applied",
        analysis,
      });
    }

    // Push and create PR
    const prResult = await pushBranchAndCreatePr({
      git: cloned.git,
      cloneDir,
      accessToken: session.accessToken,
      owner: cloned.owner,
      repo: cloned.repo,
      fixes,
      analysis,
      targetLocale: targetLocale || "en",
      fixModes: fixModes || { seo: true, aria: true, fullPage: false },
    });

    const fixLog = fixes.flatMap(f => f.log || []);

    return Response.json({
      analysis,
      fixes: fixes.map((f) => ({
        filePath: f.filePath,
        issuesFixed: f.issuesFixed.length,
      })),
      fixLog,
      pr: prResult,
    });
  } catch (err) {
    console.error("Fix error:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Fix & PR creation failed",
      },
      { status: 500 }
    );
  } finally {
    if (cloneDir) {
      rm(cloneDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
