import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env;

  if (env?.CACHE) {
    // Clear cache keys
    await env.CACHE.delete('status');
    await env.CACHE.delete('prs');
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
