import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, locals }) => {
  const sessionId = cookies.get('dashboard_session')?.value;

  if (sessionId) {
    const env = (locals as any).runtime?.env;
    if (env?.APP_KV) {
      await env.APP_KV.delete(`session:${sessionId}`);
    }
  }

  cookies.delete('dashboard_session');

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/api/auth/login',
    },
  });
};
