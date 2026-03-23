import type {GithubReleaseInfo} from './types.js';

function parseGithubRepo(workloadRepoUrl: string): {owner: string; repo: string} | null {
  const match = workloadRepoUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (!match) {
    return null;
  }
  return {owner: match[1], repo: match[2]};
}

export async function fetchGithubReleaseTags(workloadRepoUrl: string): Promise<GithubReleaseInfo[]> {
  const repo = parseGithubRepo(workloadRepoUrl);
  if (!repo) {
    return [];
  }

  const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/releases?per_page=8`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'ztdeploy',
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as Array<{tag_name?: string; published_at?: string}>;
  return payload
    .filter((entry) => entry.tag_name)
    .map((entry) => ({tag: entry.tag_name as string, publishedAt: entry.published_at}));
}
