import { REPOS, GH_OWNER } from '@/repos';
import type {
  RepoStatus,
  DeployInfo,
  PR,
} from '@/types';

const GH_API = 'https://api.github.com';
const GH_API_VERSION = '2022-11-28';

interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
}

interface GitHubTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GH_API_VERSION,
    'User-Agent': 'fluxpulse-release-dashboard',
  };
}

async function fetchLatestTag(token: string, repo: string): Promise<string | null> {
  try {
    const res = await fetch(`${GH_API}/repos/${GH_OWNER}/${repo}/tags?per_page=1`, {
      headers: getHeaders(token),
    });
    if (!res.ok) return null;
    const tags = (await res.json()) as GitHubTag[];
    return tags[0]?.name ?? null;
  } catch {
    return null;
  }
}

async function fetchDeployRun(
  token: string,
  repo: string,
  workflow: string
): Promise<DeployInfo | null> {
  try {
    const res = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/${workflow}/runs?per_page=1`,
      {
        headers: getHeaders(token),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { workflow_runs: GitHubWorkflowRun[] };
    const run = data.workflow_runs[0];
    if (!run) return null;

    // Extract version from run name (e.g. "Deploy v1.0.0" -> "v1.0.0")
    const versionMatch = run.name.match(/v[\d.]+/);
    const version = versionMatch ? versionMatch[0] : null;

    return {
      version,
      runAt: run.updated_at,
      runUrl: `https://github.com/${GH_OWNER}/${repo}/actions/runs/${run.id}`,
      conclusion: (run.conclusion as 'success' | 'failure' | 'in_progress') ?? 'in_progress',
    };
  } catch {
    return null;
  }
}

async function checkCIStatus(token: string, repo: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/ci.yml/runs?branch=main&per_page=1`,
      {
        headers: getHeaders(token),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { workflow_runs: GitHubWorkflowRun[] };
    const run = data.workflow_runs[0];
    return run ? run.conclusion === 'success' : false;
  } catch {
    return false;
  }
}

async function fetchOpenPRCount(token: string, repo: string): Promise<number> {
  try {
    const res = await fetch(`${GH_API}/repos/${GH_OWNER}/${repo}/pulls?state=open&per_page=1`, {
      headers: getHeaders(token),
    });
    if (!res.ok) return 0;
    const linkHeader = res.headers.get('link');
    if (!linkHeader) return (await res.json() as any[]).length;
    // Parse total from Link header
    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
    return match ? parseInt(match[1], 10) : 1;
  } catch {
    return 0;
  }
}

async function fetchUnreleasedCommits(
  token: string,
  repo: string,
  latestTag: string | null
): Promise<number> {
  if (!latestTag) return 0;
  try {
    const res = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/compare/${latestTag}...main`,
      {
        headers: getHeaders(token),
      }
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { ahead_by?: number };
    return data.ahead_by ?? 0;
  } catch {
    return 0;
  }
}

async function fetchAllOpenPRs(token: string): Promise<PR[]> {
  const prs: PR[] = [];
  for (const repo of REPOS) {
    try {
      const res = await fetch(
        `${GH_API}/repos/${GH_OWNER}/${repo}/pulls?state=open&per_page=100`,
        {
          headers: getHeaders(token),
        }
      );
      if (!res.ok) continue;
      const repoPRs = (await res.json()) as any[];
      repoPRs.forEach((pr) => {
        prs.push({
          repo,
          number: pr.number,
          title: pr.title,
          author: pr.user.login,
          createdAt: pr.created_at,
          url: pr.html_url,
          labels: pr.labels.map((l: any) => l.name),
        });
      });
    } catch {
      // continue
    }
  }
  return prs;
}

function determineSyncState(
  latestTag: string | null,
  uatDeploy: DeployInfo | null,
  prodDeploy: DeployInfo | null
): 'in-sync' | 'uat-ahead' | 'never-deployed' | 'unknown' {
  if (!latestTag) return 'unknown';
  if (!uatDeploy && !prodDeploy) return 'never-deployed';
  if (!prodDeploy) return 'uat-ahead';

  const uatVersion = uatDeploy?.version ?? latestTag;
  const prodVersion = prodDeploy?.version ?? null;

  if (!prodVersion) return 'never-deployed';
  if (uatVersion === prodVersion) return 'in-sync';
  return 'uat-ahead';
}

export async function getRepoStatus(token: string): Promise<RepoStatus[]> {
  const results = await Promise.allSettled(
    REPOS.map(async (repo) => {
      const [latestTag, uatDeploy, prodDeploy, openPrCount, ciPassing] =
        await Promise.all([
          fetchLatestTag(token, repo),
          fetchDeployRun(token, repo, 'deploy-uat.yml'),
          fetchDeployRun(token, repo, 'deploy-prod.yml'),
          fetchOpenPRCount(token, repo),
          checkCIStatus(token, repo),
        ]);

      const unreleasedCommits = await fetchUnreleasedCommits(token, repo, latestTag);

      const syncState = determineSyncState(latestTag, uatDeploy, prodDeploy);

      return {
        name: repo,
        latestTag,
        uatDeploy,
        prodDeploy,
        syncState,
        openPrCount,
        unreleasedCommits,
        ciFailing: !ciPassing,
      };
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<RepoStatus>).value);
}

export async function getAllPRs(token: string): Promise<PR[]> {
  return fetchAllOpenPRs(token);
}

export async function cacheStatus(
  env: Env,
  token: string
): Promise<RepoStatus[]> {
  const cached = await env.SESSION.get('status', { type: 'json' });
  if (cached) return cached as RepoStatus[];

  const fresh = await getRepoStatus(token);
  await env.SESSION.put('status', JSON.stringify(fresh), { expirationTtl: 300 });
  return fresh;
}

export async function cachePRs(env: Env, token: string): Promise<PR[]> {
  const cached = await env.SESSION.get('prs', { type: 'json' });
  if (cached) return cached as PR[];

  const fresh = await getAllPRs(token);
  await env.SESSION.put('prs', JSON.stringify(fresh), { expirationTtl: 120 });
  return fresh;
}
