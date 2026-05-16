import { REPOS, GH_OWNER } from '@/repos';
import type {
  RepoStatus,
  DeployInfo,
  PR,
  QueuedItem,
} from '@/types';

const GH_API = 'https://api.github.com';
const GH_API_VERSION = '2022-11-28';

/**
 * KV cache key for the per-repo status payload returned by getRepoStatus.
 * Bump the suffix when changing the cached shape so old entries are
 * automatically ignored. Exported so /api/cache (the Refresh button) and
 * cacheStatus stay in lockstep.
 */
export const STATUS_CACHE_KEY = 'status:v4';

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

/**
 * Returns the commits on `headRef` but not on `baseRef`, in deploy
 * order (newest first), each enriched with PR info when the commit is
 * the merge tip of a closed PR. Direct pushes to main stay visible as
 * raw-commit rows; PR-merged commits get the PR title/number/labels.
 *
 * Used to populate the release-queue page's two buckets:
 *   - Pending UAT:  fetchQueuedItems(repo, uatSha, "main")
 *   - Pending Prod: fetchQueuedItems(repo, prodSha, uatSha)
 */
async function fetchQueuedItems(
  token: string,
  repo: string,
  baseRef: string | null,
  headRef: string
): Promise<QueuedItem[]> {
  if (!baseRef) return [];
  try {
    // Step 1: commits between the two refs
    const cmpRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/compare/${baseRef}...${headRef}`,
      { headers: getHeaders(token) }
    );
    if (!cmpRes.ok) return [];
    const cmp = (await cmpRes.json()) as {
      commits?: Array<{
        sha: string;
        html_url: string;
        commit: {
          message: string;
          author: { name: string; date: string };
          committer: { date: string };
        };
      }>;
    };
    const commits = cmp.commits ?? [];
    if (commits.length === 0) return [];

    // Step 2: PR lookup table — recent closed PRs keyed by merge_commit_sha.
    // One call covers up to 100 recent PRs across the whole repo.
    const prRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
      { headers: getHeaders(token) }
    );
    const prMap = new Map<
      string,
      {
        number: number;
        title: string;
        author: string;
        mergedAt: string;
        url: string;
        labels: string[];
      }
    >();
    if (prRes.ok) {
      const prs = (await prRes.json()) as Array<{
        number: number;
        title: string;
        merged_at: string | null;
        merge_commit_sha: string | null;
        html_url: string;
        user: { login: string };
        labels: { name: string }[];
      }>;
      for (const p of prs) {
        if (p.merged_at && p.merge_commit_sha) {
          prMap.set(p.merge_commit_sha, {
            number: p.number,
            title: p.title,
            author: p.user.login,
            mergedAt: p.merged_at,
            url: p.html_url,
            labels: p.labels.map((l) => l.name),
          });
        }
      }
    }

    // Step 3: assemble rows — newest first. PR enrichment when match;
    // otherwise raw commit (first line of message + author name).
    return commits
      .slice()
      .reverse() // /compare returns oldest first; we want newest at top
      .map((c) => {
        const pr = prMap.get(c.sha);
        if (pr) {
          return {
            sha: c.sha,
            shortSha: c.sha.substring(0, 8),
            title: pr.title,
            author: pr.author,
            date: pr.mergedAt,
            url: pr.url,
            prNumber: pr.number,
            labels: pr.labels,
          };
        }
        const firstLine = c.commit.message.split('\n')[0];
        return {
          sha: c.sha,
          shortSha: c.sha.substring(0, 8),
          title: firstLine,
          author: c.commit.author.name,
          date: c.commit.committer.date,
          url: c.html_url,
          prNumber: null,
          labels: [],
        };
      });
  } catch (err) {
    console.error(`fetchQueuedItems error for ${repo} ${baseRef}...${headRef}:`, err);
    return [];
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

      // Queued items for the release queue — commits between the two refs,
      // enriched with PR info when available. Skipped when the relevant
      // deploy SHA is missing.
      const [pendingUatItems, pendingProdItems] = await Promise.all([
        fetchQueuedItems(token, repo, uatDeploy?.version ?? null, 'main'),
        uatDeploy && prodDeploy
          ? fetchQueuedItems(token, repo, prodDeploy.version, uatDeploy.version ?? 'main')
          : Promise.resolve([] as QueuedItem[]),
      ]);

      return {
        name: repo,
        latestTag,
        uatDeploy,
        prodDeploy,
        syncState,
        openPrCount,
        unreleasedCommits,
        pendingUatItems,
        pendingProdItems,
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

interface CachedStatus {
  data: RepoStatus[];
  fetchedAt: string;
}

interface CachedPRs {
  data: PR[];
  fetchedAt: string;
}

export async function cacheStatus(
  env: Env,
  token: string
): Promise<{ repos: RepoStatus[]; fetchedAt: string }> {
  const cached = await env.SESSION.get<CachedStatus>(STATUS_CACHE_KEY, { type: 'json' });
  if (cached?.data && cached?.fetchedAt) {
    return { repos: cached.data, fetchedAt: cached.fetchedAt };
  }

  const fresh = await getRepoStatus(token);
  const fetchedAt = new Date().toISOString();
  await env.SESSION.put(STATUS_CACHE_KEY, JSON.stringify({ data: fresh, fetchedAt }), { expirationTtl: 60 });
  return { repos: fresh, fetchedAt };
}

export async function cachePRs(
  env: Env,
  token: string
): Promise<{ prs: PR[]; fetchedAt: string }> {
  const cached = await env.SESSION.get<CachedPRs>('prs', { type: 'json' });
  if (cached?.data && cached?.fetchedAt) {
    return { prs: cached.data, fetchedAt: cached.fetchedAt };
  }

  const fresh = await getAllPRs(token);
  const fetchedAt = new Date().toISOString();
  await env.SESSION.put('prs', JSON.stringify({ data: fresh, fetchedAt }), { expirationTtl: 60 });
  return { prs: fresh, fetchedAt };
}
