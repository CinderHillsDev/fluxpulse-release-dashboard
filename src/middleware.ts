import { defineMiddleware } from 'astro:middleware';
import { env as cfEnv } from 'cloudflare:workers';

const env = cfEnv as any as Env;
const isLocal = typeof env === 'object' && !('SESSION' in env);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // Skip auth for local development
  if (isLocal) {
    return next();
  }

  if (path.startsWith('/api/auth/') || path.startsWith('/auth/')) {
    return next();
  }

  const sessionId = context.cookies.get('dashboard_session')?.value;
  if (!sessionId) {
    return context.redirect('/api/auth/login');
  }

  try {
    const sessionData = await env.SESSION.get(`session:${sessionId}`);
    if (!sessionData) {
      const headers = new Headers({ Location: '/api/auth/login' });
      headers.append('Set-Cookie', 'dashboard_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
      return new Response(null, { status: 302, headers });
    }
    context.locals.session = JSON.parse(sessionData);
    context.locals.sessionId = sessionId;
  } catch (e) {
    console.error('Session validation error:', e);
    return context.redirect('/api/auth/login');
  }

  return next();
});
