import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

const env = cfEnv as any as Env;

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const sessionId = cookies.get('dashboard_session')?.value;
  if (sessionId) {
    try {
      await env.SESSION.delete(`session:${sessionId}`);
    } catch {}
  }

  const headers = new Headers({ Location: '/api/auth/login' });
  headers.append(
    'Set-Cookie',
    'dashboard_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
  );
  return new Response(null, { status: 302, headers });
};
