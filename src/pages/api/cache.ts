import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {

  // Clear cache keys
  await env.CACHE.delete('status');
  await env.CACHE.delete('prs');

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
