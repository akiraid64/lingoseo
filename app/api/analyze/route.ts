import { auth } from "@/auth";
import { cloneRepo, parseRepoUrl } from "@/lib/github/clone";
import { analyzeRepo } from "@/lib/analysis/engine";
import { rm } from "fs/promises";
import type { ExtendedSession } from "@/types";

export async function POST(req: Request) {
  const session = (await auth()) as ExtendedSession | null;
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoUrl } = await req.json();
  if (!repoUrl) {
    return Response.json({ error: "Missing repoUrl" }, { status: 400 });
  }

  try {
    parseRepoUrl(repoUrl);
  } catch {
    return Response.json({ error: "Invalid GitHub URL" }, { status: 400 });
  }

  let cloneDir: string | null = null;

  try {
    const cloned = await cloneRepo(repoUrl, session.accessToken);
    cloneDir = cloned.cloneDir;

    const analysis = await analyzeRepo(cloneDir, repoUrl);

    return Response.json({ analysis });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Analysis failed",
      },
      { status: 500 }
    );
  } finally {
    if (cloneDir) {
      rm(cloneDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
