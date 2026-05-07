import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const env = (locals as any).runtime?.env;

  const sessionId = cookies.get('dashboard_session')?.value;

  if (sessionId && env?.CACHE) {
    await env.CACHE.delete(`session:${sessionId}`);
  }

  cookies.delete('dashboard_session');

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/api/auth/login',
    },
  });
};
