import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';
import { STATUS_CACHE_KEY } from '@/lib/github';

const env = cfEnv as any as Env;

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (env?.SESSION) {
    // Single source of truth for the cache key — imported from github.ts.
    // Also wipe the legacy unprefixed key in case anything was written
    // under it pre-bump.
    await Promise.all([
      env.SESSION.delete(STATUS_CACHE_KEY),
      env.SESSION.delete('status:v5'), // legacy keys from before subrequest-limit fix
      env.SESSION.delete('status:v4'),
      env.SESSION.delete('status'),
      env.SESSION.delete('prs'),
    ]);
  }

  // Redirect back to referer or home
  const referer = request.headers.get('Referer');
  const redirectTo = referer ? new URL(referer).pathname : '/';

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectTo,
    },
  });
};
