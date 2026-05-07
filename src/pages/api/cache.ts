import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env;

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
