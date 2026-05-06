const REPOS = [
  'fluxpulse-platform',
  'fluxpulse-web',
  'fluxpulse-admin-web',
  'fluxpulse-status',
  'fluxpulse-public-website',
  'fluxpulse-docs',
  'fluxpulse-portal',
  'fluxpulse-agent-linux',
  'fluxpulse-agent-macos',
  'fluxpulse-agent-windows',
  'fluxpulse-health-checks',
  'fluxpulse-infrastructure',
  'fluxpulse-specs',
];

const GH_OWNER = 'CinderHillsDev';
const CACHE_TTL = 300; // 5 minutes

interface DeployInfo {
  version: string | null;
  runAt: string;
  runUrl: string;
  conclusion: 'success' | 'failure' | 'in_progress';
}

interface RepoStatus {
  name: string;
  latestTag: string | null;
  uatDeploy: DeployInfo | null;
  prodDeploy: DeployInfo | null;
  syncState: 'in-sync' | 'uat-ahead' | 'never-deployed' | 'unknown';
  openPrCount: number;
  unreleasedCommits: number;
  ciFailing: boolean;
}

async function fetchGitHub(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function getLatestTag(repo: string, token: string): Promise<string | null> {
  try {
    const data = await fetchGitHub(
      `https://api.github.com/repos/${GH_OWNER}/${repo}/tags?per_page=1`,
      token
    );
    return data[0]?.name || null;
  } catch {
    return null;
  }
}

async function getLastDeploy(
  repo: string,
  workflow: string,
  token: string
): Promise<DeployInfo | null> {
  try {
    const data = await fetchGitHub(
      `https://api.github.com/repos/${GH_OWNER}/${repo}/actions/workflows/${workflow}/runs?status=completed&per_page=1&branch=main`,
      token
    );

    const run = data.workflow_runs?.[0];
    if (!run) return null;

    // Extract version from run name (e.g., "Deploy prod (v1.2.3)")
    const match = run.name.match(/v[\d.]+/);
    const version = match ? match[0] : null;

    return {
      version,
      runAt: run.created_at,
      runUrl: run.html_url,
      conclusion: run.conclusion || 'in_progress',
    };
  } catch {
    return null;
  }
}

async function getOpenPRCount(repo: string, token: string): Promise<number> {
  try {
    const data = await fetchGitHub(
      `https://api.github.com/repos/${GH_OWNER}/${repo}/pulls?state=open&per_page=1`,
      token
    );
    return data.length > 0 ? Math.min(data[0]?.number || 0, 100) : 0;
  } catch {
    return 0;
  }
}

async function getUnreleasedCommits(repo: string, latestTag: string | null, token: string): Promise<number> {
  try {
    if (!latestTag) {
      // Count commits on main if no tag exists
      const data = await fetchGitHub(
        `https://api.github.com/repos/${GH_OWNER}/${repo}/commits?sha=main&per_page=1`,
        token
      );
      return 0; // Will be calculated differently
    }

    const compare = await fetchGitHub(
      `https://api.github.com/repos/${GH_OWNER}/${repo}/compare/${latestTag}...main`,
      token
    );
    return compare.ahead_by || 0;
  } catch {
    return 0;
  }
}

async function getRepoStatus(repo: string, token: string): Promise<RepoStatus> {
  const [latestTag, uatDeploy, prodDeploy, openPrCount, unreleasedCommits] = await Promise.all([
    getLatestTag(repo, token),
    getLastDeploy(repo, 'deploy-uat.yml', token),
    getLastDeploy(repo, 'deploy-prod.yml', token),
    getOpenPRCount(repo, token),
    getUnreleasedCommits(repo, latestTag, token),
  ]);

  // Determine sync state
  let syncState: 'in-sync' | 'uat-ahead' | 'never-deployed' | 'unknown' = 'unknown';
  if (!prodDeploy) {
    syncState = 'never-deployed';
  } else if (!uatDeploy) {
    syncState = 'unknown';
  } else if (uatDeploy.version === prodDeploy.version) {
    syncState = 'in-sync';
  } else if (uatDeploy.version && prodDeploy.version) {
    syncState = 'uat-ahead';
  }

  return {
    name: repo,
    latestTag,
    uatDeploy,
    prodDeploy,
    syncState,
    openPrCount,
    unreleasedCommits,
    ciFailing: false, // TODO: check CI status
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    // Try to get from cache
    const cacheKey = new Request(new URL('/status', request.url).toString(), {
      method: 'GET',
    });
    const cached = await env.CACHE.get('status');

    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch fresh data
    const statuses = await Promise.all(
      REPOS.map((repo) => getRepoStatus(repo, env.GITHUB_TOKEN))
    );

    const response = JSON.stringify(statuses);

    // Cache for 5 minutes
    await env.CACHE.put('status', response, { expirationTtl: CACHE_TTL });

    return new Response(response, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
