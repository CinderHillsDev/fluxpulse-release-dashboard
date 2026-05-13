import { REPOS, GH_OWNER } from '@/repos';
import type {
  RepoStatus,
  DeployInfo,
  PR,
} from '@/types';

const GH_API = 'https://api.github.com';
const GH_API_VERSION = '2022-11-28';

/**
 * KV cache key for the per-repo status payload returned by getRepoStatus.
 * Bump the suffix when changing the cached shape so old entries are
 * automatically ignored. Exported so /api/cache (the Refresh button) and
 * cacheStatus stay in lockstep.
 */
export const STATUS_CACHE_KEY = 'status:v2';

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

interface GitHubDeployment {
  id: number;
  sha: string;
  ref: string;
  created_at: string;
  updated_at: string;
  statuses_url: string;
}

interface GitHubDeploymentStatus {
  state: 'error' | 'failure' | 'inactive' | 'in_progress' | 'pending' | 'success';
  created_at: string;
  updated_at: string;
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
    if (!res.ok) {
      const text = await res.text();
      console.error(`fetchLatestTag failed for ${repo}:`, res.status, text);
      return null;
    }
    const tags = (await res.json()) as GitHubTag[];
    return tags[0]?.name ?? null;
  } catch (err) {
    console.error(`fetchLatestTag error for ${repo}:`, err);
    return null;
  }
}

async function fetchDeploymentByEnvironment(
  token: string,
  repo: string,
  environment: string
): Promise<DeployInfo | null> {
  try {
    // Fetch latest deployment to the environment
    const deployRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/deployments?environment=${environment}&per_page=1`,
      {
        headers: getHeaders(token),
      }
    );
    if (!deployRes.ok) {
      console.error(
        `fetchDeploymentByEnvironment failed for ${repo}/${environment}:`,
        deployRes.status
      );
      return null;
    }
    const deployments = (await deployRes.json()) as GitHubDeployment[];
    const deployment = deployments[0];
    if (!deployment) return null;

    // Fetch deployment status to get the result
    const statusRes = await fetch(`${deployment.statuses_url}?per_page=1`, {
      headers: getHeaders(token),
    });
    if (!statusRes.ok) {
      console.error(
        `fetchDeploymentStatus failed for ${repo}/${environment}:`,
        statusRes.status
      );
      return null;
    }
    const statuses = (await statusRes.json()) as GitHubDeploymentStatus[];
    const status = statuses[0];

    // Use short commit SHA as version
    const version = deployment.sha.substring(0, 7);

    return {
      version,
      runAt: status?.updated_at ?? deployment.updated_at,
      runUrl: `https://github.com/${GH_OWNER}/${repo}/deployments`,
      conclusion:
        status?.state === 'success'
          ? 'success'
          : status?.state === 'failure'
            ? 'failure'
            : 'in_progress',
    };
  } catch (err) {
    console.error(
      `fetchDeploymentByEnvironment error for ${repo}/${environment}:`,
      err
    );
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
  baseRef: string | null
): Promise<number> {
  // baseRef can be a tag (e.g. "v1.2.3"), a short SHA (e.g. "f2ea479"), or
  // a branch name. We pass uatDeploy.version (short SHA from the GitHub
  // Deployments API) when no tag exists. Returns the count of commits on
  // main that aren't yet reachable from baseRef.
  if (!baseRef) return 0;
  try {
    const res = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/compare/${baseRef}...main`,
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
  uatDeploy: DeployInfo | null,
  prodDeploy: DeployInfo | null
): 'in-sync' | 'uat-ahead' | 'never-deployed' | 'unknown' {
  // Tags are no longer required — we run on a SHA-based release model.
  // Compare the SHAs recorded by GitHub Deployments API for each env.
  if (!uatDeploy && !prodDeploy) return 'never-deployed';
  if (uatDeploy && !prodDeploy) return 'uat-ahead';
  if (!uatDeploy && prodDeploy) return 'unknown'; // prod-only deploy w/ no UAT history
  if (uatDeploy!.version === prodDeploy!.version) return 'in-sync';
  return 'uat-ahead';
}

export async function getRepoStatus(token: string): Promise<RepoStatus[]> {
  const results = await Promise.allSettled(
    REPOS.map(async (repo) => {
      const [latestTag, uatDeploy, prodDeploy, openPrCount, ciPassing] =
        await Promise.all([
          fetchLatestTag(token, repo),
          fetchDeploymentByEnvironment(token, repo, 'uat'),
          fetchDeploymentByEnvironment(token, repo, 'prod'),
          fetchOpenPRCount(token, repo),
          checkCIStatus(token, repo),
        ]);

      // Compare commits on main against the SHA last deployed to UAT (or
      // the latest tag as a fallback if the repo doesn't deploy to UAT).
      const baseRef = uatDeploy?.version ?? latestTag;
      const unreleasedCommits = await fetchUnreleasedCommits(token, repo, baseRef);

      const syncState = determineSyncState(uatDeploy, prodDeploy);

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
  const cached = await env.SESSION.get(STATUS_CACHE_KEY, { type: 'json' });
  if (cached) return cached as RepoStatus[];

  const fresh = await getRepoStatus(token);
  await env.SESSION.put(STATUS_CACHE_KEY, JSON.stringify(fresh), { expirationTtl: 300 });
  return fresh;
}

export async function cachePRs(env: Env, token: string): Promise<PR[]> {
  const cached = await env.SESSION.get('prs', { type: 'json' });
  if (cached) return cached as PR[];

  const fresh = await getAllPRs(token);
  await env.SESSION.put('prs', JSON.stringify(fresh), { expirationTtl: 120 });
  return fresh;
}
