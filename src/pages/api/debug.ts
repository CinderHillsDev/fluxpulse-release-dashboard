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

  // 4. Trace fetchDeploymentByEnvironment step by step for fluxpulse-platform/uat
  if (deployRes?.ok) {
    try {
      const deps = await fetch(
        'https://api.github.com/repos/CinderHillsDev/fluxpulse-platform/deployments?environment=uat&per_page=1',
        { headers }
      );
      const depsJson = await deps.json() as any[];
      const dep = depsJson[0];
      results.step4_deploymentId = dep?.id ?? null;
      results.step4_statusesUrl = dep?.statuses_url ?? null;

      if (dep?.statuses_url) {
        const statusRes = await fetch(`${dep.statuses_url}?per_page=1`, { headers });
        results.step4_statusesHttpStatus = statusRes.status;
        if (statusRes.ok) {
          const statuses = await statusRes.json() as any[];
          results.step4_statusesCount = statuses.length;
          results.step4_latestState = statuses[0]?.state ?? null;
        } else {
          results.step4_statusesError = await statusRes.text().catch(() => '(unreadable)');
        }
      }
    } catch (err) {
      results.step4_error = String(err);
    }
  }

  // 5. Run actual getRepoStatus to see end-to-end pipeline result.
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

  // 6. Verify the deployments endpoint still works AFTER the getRepoStatus burst.
  //    If this fails, it confirms Cloudflare's subrequest limit was exhausted.
  try {
    const postBurstRes = await fetch(
      'https://api.github.com/repos/CinderHillsDev/fluxpulse-platform/deployments?environment=uat&per_page=1',
      { headers }
    );
    results.step6_postBurstStatus = postBurstRes.status;
    if (!postBurstRes.ok) {
      results.step6_postBurstError = await postBurstRes.text().catch(() => '(unreadable)');
    }
  } catch (err) {
    results.step6_postBurstError = String(err);
  }

  return Response.json(results, { status: 200 });
};
