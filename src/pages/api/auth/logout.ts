import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {

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
