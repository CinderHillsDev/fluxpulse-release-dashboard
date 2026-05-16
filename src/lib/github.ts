import { REPOS, GH_OWNER, HEALTH_ENDPOINTS, RELEASE_ONLY_REPOS } from '@/repos';
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
export const STATUS_CACHE_KEY = 'status:v11';

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
    // Fetch recent deployments. We need up to ~5 so we can find the last
    // *successful* one — a failed deploy still creates a record at the
    // current SHA, which would otherwise make unreleased/pending counts
    // appear as zero even though UAT is running old code.
    const deployRes = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/deployments?environment=${environment}&per_page=5`,
      { headers: getHeaders(token) }
    );
    if (!deployRes.ok) {
      console.error(`fetchDeploymentByEnvironment failed for ${repo}/${environment}:`, deployRes.status);
      return null;
    }
    const deployments = (await deployRes.json()) as GitHubDeployment[];
    if (deployments.length === 0) return null;

    // Fetch statuses for the most recent deployment to get latest conclusion.
    const latestDeploy = deployments[0];
    const latestStatusRes = await fetch(`${latestDeploy.statuses_url}?per_page=1`, {
      headers: getHeaders(token),
    });
    const latestStatuses = latestStatusRes.ok
      ? ((await latestStatusRes.json()) as GitHubDeploymentStatus[])
      : [];
    const latestStatus = latestStatuses[0];
    const latestConclusion: DeployInfo['conclusion'] =
      latestStatus?.state === 'success' ? 'success'
      : latestStatus?.state === 'failure' ? 'failure'
      : 'in_progress';

    // Find the last successful deployment to use its SHA as the baseline for
    // commit comparisons (pendingUatItems, unreleasedCommits). When the latest
    // deploy failed, this will be an older SHA, surfacing the real pending queue.
    let successfulDeploy = latestConclusion === 'success' ? latestDeploy : null;
    if (!successfulDeploy) {
      for (const dep of deployments.slice(1)) {
        const sRes = await fetch(`${dep.statuses_url}?per_page=1`, { headers: getHeaders(token) });
        if (!sRes.ok) continue;
        const ss = (await sRes.json()) as GitHubDeploymentStatus[];
        if (ss[0]?.state === 'success') {
          successfulDeploy = dep;
          break;
        }
      }
    }

    // version = last successful SHA (for comparison); falls back to latest
    // deploy SHA when no successful deploy exists yet.
    const baseDeploy = successfulDeploy ?? latestDeploy;
    const version = baseDeploy.sha.substring(0, 7);
    const runAt = latestStatus?.updated_at ?? latestDeploy.updated_at;

    const workflowFile = RELEASE_ONLY_REPOS.has(repo as any)
      ? 'release.yml'
      : environment === 'uat' ? 'deploy-uat.yml' : 'deploy-prod.yml';
    return {
      version,
      runAt,
      runUrl: `https://github.com/${GH_OWNER}/${repo}/actions/workflows/${workflowFile}`,
      conclusion: latestConclusion,
    };
  } catch (err) {
    console.error(`fetchDeploymentByEnvironment error for ${repo}/${environment}:`, err);
    return null;
  }
}

async function checkCIStatus(
  token: string,
  repo: string
): Promise<{ passing: boolean; runUrl: string | null; conclusion: string | null; status: string | null }> {
  try {
    const res = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/ci.yml/runs?branch=main&per_page=1`,
      { headers: getHeaders(token) }
    );
    if (!res.ok) return { passing: false, runUrl: null, conclusion: null, status: null };
    const data = (await res.json()) as { workflow_runs: (GitHubWorkflowRun & { html_url: string })[] };
    const run = data.workflow_runs[0];
    if (!run) return { passing: false, runUrl: null, conclusion: null, status: null };
    return {
      passing: run.conclusion === 'success',
      runUrl: run.html_url,
      conclusion: run.conclusion,   // success | failure | cancelled | etc. (null when in_progress)
      status: run.status,           // queued | in_progress | completed
    };
  } catch {
    return { passing: false, runUrl: null, conclusion: null, status: null };
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

async function fetchHealthStatus(url: string): Promise<'up' | 'down' | 'unknown'> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.ok || res.status < 500 ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

async function fetchRepoStatus(token: string, repo: string): Promise<RepoStatus> {
  const endpoints = HEALTH_ENDPOINTS[repo as keyof typeof HEALTH_ENDPOINTS];
  const isReleaseOnly = RELEASE_ONLY_REPOS.has(repo as any);

  const [latestTag, uatDeploy, prodDeploy, openPrCount, ciResult, uatHealth, prodHealth] =
    await Promise.all([
      fetchLatestTag(token, repo),
      // Release-only repos have no UAT stage — skip the API call entirely.
      isReleaseOnly ? Promise.resolve(null) : fetchDeploymentByEnvironment(token, repo, 'uat'),
      fetchDeploymentByEnvironment(token, repo, 'production'),
      fetchOpenPRCount(token, repo),
      checkCIStatus(token, repo),
      endpoints?.uat ? fetchHealthStatus(endpoints.uat) : Promise.resolve('unknown' as const),
      endpoints?.prod ? fetchHealthStatus(endpoints.prod) : Promise.resolve('unknown' as const),
    ]);

  const baseRef = uatDeploy?.version ?? latestTag;
  const unreleasedCommits = await fetchUnreleasedCommits(token, repo, baseRef);

  // Release-only repos are "in sync" once a prod release exists; there is
  // never a UAT stage to be ahead of.
  const syncState = isReleaseOnly
    ? (prodDeploy ? 'in-sync' : 'never-deployed')
    : determineSyncState(uatDeploy, prodDeploy);

  // For release-only repos use latestTag (or prodDeploy SHA) as the base for
  // the pending queue, since there is no UAT deploy version to compare against.
  const queueBaseRef = isReleaseOnly
    ? (latestTag ?? prodDeploy?.version ?? null)
    : (uatDeploy?.version ?? null);

  const [pendingUatItems, pendingProdItems] = await Promise.all([
    fetchQueuedItems(token, repo, queueBaseRef, 'main'),
    uatDeploy && prodDeploy
      ? fetchQueuedItems(token, repo, prodDeploy.version, uatDeploy.version ?? 'main')
      : Promise.resolve([] as QueuedItem[]),
  ]);

  return {
    name: repo,
    releaseOnly: isReleaseOnly,
    latestTag,
    uatDeploy,
    prodDeploy,
    syncState,
    openPrCount,
    unreleasedCommits,
    pendingUatItems,
    pendingProdItems,
    ciFailing: !ciResult.passing,
    ciRunUrl: ciResult.runUrl,
    ciConclusion: ciResult.conclusion,
    ciStatus: ciResult.status,
    uatHealth,
    prodHealth,
  };
}

export async function getRepoStatus(token: string): Promise<RepoStatus[]> {
  const BATCH_SIZE = 3;
  const allResults: RepoStatus[] = [];

  for (let i = 0; i < REPOS.length; i += BATCH_SIZE) {
    const batch = REPOS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((repo) => fetchRepoStatus(token, repo))
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        allResults.push(r.value);
      }
    }
  }

  return allResults;
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

export interface ActivityEvent {
  repo: string;
  workflow: string;       // 'ci' | 'deploy-uat' | 'deploy-prod'
  status: string;         // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | null
  runAt: string;          // created_at ISO string
  updatedAt: string;      // updated_at ISO string
  runUrl: string;         // html_url
  actor: string | null;   // triggering actor login
}

export async function fetchActivity(token: string): Promise<ActivityEvent[]> {
  const headers = getHeaders(token);
  const events: ActivityEvent[] = [];

  // Fetch last 5 runs of each workflow type for each repo — batched 4 repos at a time.
  // release.yml is included for agent repos; GitHub returns 404 for non-existent
  // workflows which the inner try/catch already handles gracefully.
  const WORKFLOWS = ['ci.yml', 'deploy-uat.yml', 'deploy-prod.yml', 'release.yml'];
  const BATCH = 4;

  for (let i = 0; i < REPOS.length; i += BATCH) {
    const batch = REPOS.slice(i, i + BATCH);
    await Promise.all(
      batch.flatMap((repo) =>
        WORKFLOWS.map(async (wf) => {
          try {
            const res = await fetch(
              `${GH_API}/repos/${GH_OWNER}/${repo}/actions/workflows/${wf}/runs?per_page=5`,
              { headers }
            );
            if (!res.ok) return;
            const data = await res.json() as { workflow_runs: any[] };
            for (const run of data.workflow_runs ?? []) {
              events.push({
                repo,
                workflow: wf.replace('.yml', ''),
                status: run.status,
                conclusion: run.conclusion,
                runAt: run.created_at,
                updatedAt: run.updated_at,
                runUrl: run.html_url,
                actor: run.triggering_actor?.login ?? null,
              });
            }
          } catch { /* skip */ }
        })
      )
    );
  }

  return events
    .sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime())
    .slice(0, 50);
}
