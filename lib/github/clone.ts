import simpleGit from "simple-git";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(
    /github\.com[/:]([^/]+)\/([^/.]+)/
  );
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2] };
}

export async function cloneRepo(repoUrl: string, accessToken: string) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const cloneDir = join(tmpdir(), `lingoseo-${randomUUID()}`);
  const authenticatedUrl = `https://${accessToken}@github.com/${owner}/${repo}.git`;

  const git = simpleGit();
  await git.clone(authenticatedUrl, cloneDir, ["--depth", "1"]);

  return {
    cloneDir,
    git: simpleGit(cloneDir),
    owner,
    repo,
  };
}
