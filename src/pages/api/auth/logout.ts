import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

const env = cfEnv as any as Env;

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const sessionId = cookies.get('dashboard_session')?.value;

  if (sessionId) {
    if (env?.SESSION) {
      await env.SESSION.delete(`session:${sessionId}`);
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
