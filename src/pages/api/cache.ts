import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (env?.SESSION) {
    // Clear cache keys
    await env.SESSION.delete('status');
    await env.SESSION.delete('prs');
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
