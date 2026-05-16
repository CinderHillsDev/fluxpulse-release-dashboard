import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';
import { getRepoStatus } from '@/lib/github';

const env = cfEnv as any as Env;

export const prerender = false;

/**
 * Temporary diagnostic endpoint — hit GET /api/debug to see whether the
 * GITHUB_TOKEN Cloudflare secret can read deployments.  Remove once the
 * token issue is confirmed and fixed.
 */
export const GET: APIRoute = async () => {
  const token = env?.GITHUB_TOKEN;
  const results: Record<string, unknown> = {
    tokenPresent: !!token,
    tokenPrefix: token ? `${token.slice(0, 8)}…` : null,
  };

  if (!token) {
    return Response.json(results);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'fluxpulse-release-dashboard',
  };

  // 1. Verify token identity
  const userRes = await fetch('https://api.github.com/user', { headers }).catch(() => null);
  results.userStatus = userRes?.status ?? 'fetch-failed';
  if (userRes?.ok) {
    const user = await userRes.json() as any;
    results.tokenLogin = user.login;
  }

  // 2. Check token scopes (classic PAT only)
  results.xOauthScopes = userRes?.headers.get('x-oauth-scopes') ?? null;

  // 3. Try reading deployments for fluxpulse-platform
  const deployRes = await fetch(
    'https://api.github.com/repos/CinderHillsDev/fluxpulse-platform/deployments?environment=uat&per_page=1',
    { headers }
  ).catch(() => null);
  results.deploymentsStatus = deployRes?.status ?? 'fetch-failed';
  if (deployRes?.ok) {
    const deps = await deployRes.json() as any[];
    results.deploymentsCount = deps.length;
    results.latestDeploymentSha = deps[0]?.sha?.slice(0, 7) ?? null;
  } else if (deployRes) {
    results.deploymentsError = await deployRes.text().catch(() => '(unreadable)');
  }

  // 4. Run actual getRepoStatus for just fluxpulse-platform to see what the
  //    dashboard pipeline produces end-to-end.
  try {
    const statuses = await getRepoStatus(token);
    const platform = statuses.find(r => r.name === 'fluxpulse-platform');
    results.platformRepoStatus = platform
      ? { syncState: platform.syncState, uatDeploy: platform.uatDeploy, prodDeploy: platform.prodDeploy }
      : '(not found in results)';
    results.totalReposReturned = statuses.length;
  } catch (err) {
    results.getRepoStatusError = String(err);
  }

  return Response.json(results, { status: 200 });
};
