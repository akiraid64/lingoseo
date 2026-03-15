import { auth } from "@/auth";
import { cloneRepo, parseRepoUrl } from "@/lib/github/clone";
import { analyzeRepo } from "@/lib/analysis/engine";
import { rm } from "fs/promises";
import type { ExtendedSession } from "@/types";
import { log } from "@/lib/logger";

export async function POST(req: Request) {
  log.divider("ANALYZE REQUEST");

  const session = (await auth()) as ExtendedSession | null;
  if (!session?.accessToken) {
    log.err("Unauthorized — no access token");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info(`User: ${session.user?.name || session.user?.email}`);

  const { repoUrl } = await req.json();
  if (!repoUrl) {
    log.err("Missing repoUrl in request body");
    return Response.json({ error: "Missing repoUrl" }, { status: 400 });
  }

  log.info(`Repo: ${repoUrl}`);

  try {
    parseRepoUrl(repoUrl);
  } catch (err) {
    log.err("Invalid GitHub URL", err);
    return Response.json({ error: "Invalid GitHub URL" }, { status: 400 });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || undefined;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (geminiApiKey) {
    log.info(`Gemini: ${geminiModel} (semantic scan enabled)`);
  } else {
    log.warn("No GEMINI_API_KEY in env — pattern-only scan");
  }

  let cloneDir: string | null = null;

  try {
    const cloned = await cloneRepo(repoUrl, session.accessToken);
    cloneDir = cloned.cloneDir;

    const analysis = await analyzeRepo(cloneDir, repoUrl, geminiApiKey, geminiModel);

    log.ok(`Analysis complete — ${analysis.issues.length} issues found across ${analysis.scannedFiles} files`);
    log.item(`Score: ${analysis.score.grade} (${analysis.score.total}/100)`);
    log.item(`Critical: ${analysis.summary.critical} | Warning: ${analysis.summary.warning} | Info: ${analysis.summary.info}`);

    return Response.json({ analysis });
  } catch (err) {
    log.err("Analysis failed", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  } finally {
    if (cloneDir) {
      rm(cloneDir, { recursive: true, force: true }).catch(() => {});
      log.item(`Cleaned up temp dir`);
    }
  }
}
