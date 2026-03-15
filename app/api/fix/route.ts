import { auth } from "@/auth";
import { cloneRepo } from "@/lib/github/clone";
import { analyzeRepo } from "@/lib/analysis/engine";
import { applyFixes } from "@/lib/fixer/engine";
import { pushBranchAndCreatePr } from "@/lib/github/pr";
import { rm } from "fs/promises";
import type { ExtendedSession } from "@/types";
import { log } from "@/lib/logger";

export const maxDuration = 120;

export async function POST(req: Request) {
  const session = (await auth()) as ExtendedSession | null;
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All keys are server-side now — no client-side keys needed.
  const geminiApiKey = process.env.GEMINI_API_KEY || "";

  const { repoUrl, modelName, targetLocale, fixModes } = await req.json();
  const targetLocales = targetLocale ? [targetLocale] : [];
  if (!repoUrl) {
    return Response.json(
      { error: "Missing repoUrl" },
      { status: 400 }
    );
  }

  const model = modelName || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const modes = fixModes || { seo: true, aria: true, fullPage: false };
  const modeLabel = [modes.seo && "SEO", modes.aria && "ARIA", modes.fullPage && "FULL-PAGE"].filter(Boolean).join("+");

  log.divider("FIX REQUEST");
  log.info(`Repo:   ${repoUrl}`);
  log.info(`Locale: ${targetLocale || "none"}`);
  log.info(`Modes:  ${modeLabel}`);
  log.info(`Model:  ${model}`);
  log.info(`Engine: lingo.dev SDK → /api/process/localize → Gemini`);

  let cloneDir: string | null = null;

  try {
    // ── 1. CLONE ──────────────────────────────────────────
    log.step("1/5 Cloning repository");
    const cloned = await cloneRepo(repoUrl, session.accessToken);
    cloneDir = cloned.cloneDir;

    // ── 2. ANALYZE ────────────────────────────────────────
    log.step("2/5 Analyzing repo for SEO issues");
    const analysis = await analyzeRepo(cloneDir, repoUrl);
    log.ok(`Found ${analysis.issues.length} issues (${analysis.summary.critical} critical, ${analysis.summary.warning} warning, ${analysis.summary.info} info)`);

    if (analysis.issues.length === 0) {
      log.ok("Repo is clean — no fixes needed");
      return Response.json({ message: "No SEO issues found — your repo is clean!", analysis });
    }

    // ── 3. FIX ────────────────────────────────────────────
    log.step("3/5 Applying fixes");
    log.info(`Fixing ${analysis.issues.length} issues across ${new Set(analysis.issues.map(i => i.filePath)).size} files`);

    const fixes = await applyFixes({
      cloneDir,
      issues: analysis.issues,
      geminiApiKey,
      modelName: model,
      targetLocales: targetLocales.length > 0 ? targetLocales : analysis.localesDetected,
      fixModes: modes,
    });

    const realFixes = fixes.filter(f => f.filePath !== "__fixer_log__");
    log.ok(`Fixed ${realFixes.length} files`);
    realFixes.forEach(f => log.item(`${f.filePath} — ${f.issuesFixed.length} issues fixed`));

    if (realFixes.length === 0) {
      log.warn("No files were modified — issues found but no fixes applied");
      return Response.json({ message: "Issues found but no automatic fixes could be applied", analysis });
    }

    // ── 4. PUSH + PR ──────────────────────────────────────
    log.step("4/5 Committing and pushing branch");
    const prResult = await pushBranchAndCreatePr({
      git: cloned.git,
      cloneDir,
      accessToken: session.accessToken,
      owner: cloned.owner,
      repo: cloned.repo,
      fixes,
      analysis,
      targetLocale: targetLocale || "en",
      fixModes: modes,
    });

    // ── 5. DONE ───────────────────────────────────────────
    log.step("5/5 Done");
    log.ok(`PR created: ${prResult.prUrl}`);
    log.item(`Branch: ${prResult.branchName}`);
    log.item(`Files changed: ${prResult.filesChanged}`);

    const fixLog = fixes.flatMap(f => f.log || []);

    return Response.json({
      analysis,
      fixes: realFixes.map((f) => ({ filePath: f.filePath, issuesFixed: f.issuesFixed.length })),
      fixLog,
      pr: prResult,
    });
  } catch (err) {
    log.err("Fix pipeline failed", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Fix & PR creation failed" },
      { status: 500 }
    );
  } finally {
    if (cloneDir) {
      rm(cloneDir, { recursive: true, force: true }).catch(() => {});
      log.item("Cleaned up temp dir");
    }
  }
}
