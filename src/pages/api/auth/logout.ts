import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const env = locals.runtime.env;

  const sessionId = cookies.get('dashboard_session')?.value;

  if (sessionId) {
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
