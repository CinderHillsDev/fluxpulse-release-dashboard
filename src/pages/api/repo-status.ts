import { env } from '@/lib/env';
import { fetchRepoStatus } from '@/lib/github';
import { REPOS } from '@/repos';

export const prerender = false;

export async function GET(context: any) {
  const token = env.CF_GH_PAT_FluxPulseReleaseDashboard;

  const repoParam = context.url.searchParams.get('repo');
  if (!repoParam) {
    return new Response(JSON.stringify({ error: 'Missing repo parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!REPOS.includes(repoParam as any)) {
    return new Response(JSON.stringify({ error: 'Invalid repo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const status = await fetchRepoStatus(token, repoParam);
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`Error fetching repo status for ${repoParam}:`, err);
    return new Response(JSON.stringify({ error: 'Failed to fetch repo status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
