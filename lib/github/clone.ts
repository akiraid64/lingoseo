import simpleGit from "simple-git";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { log } from "@/lib/logger";

export function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2] };
}

export async function cloneRepo(repoUrl: string, accessToken: string) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const cloneDir = join(tmpdir(), `lingoseo-${randomUUID()}`);
  const authenticatedUrl = `https://${accessToken}@github.com/${owner}/${repo}.git`;

  log.step(`Cloning ${owner}/${repo}`);
  log.item(`→ ${cloneDir}`);

  const git = simpleGit();
  await git.clone(authenticatedUrl, cloneDir, ["--depth", "1"]);

  log.ok(`Cloned ${owner}/${repo}`);

  return {
    cloneDir,
    git: simpleGit(cloneDir),
    owner,
    repo,
  };
}
