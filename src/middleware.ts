import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const isAuthRoute = context.url.pathname.startsWith('/api/auth/');

  if (isAuthRoute) {
    return next();
  }

  const sessionId = context.cookies.get('dashboard_session')?.value;

  if (!sessionId) {
    return context.redirect('/api/auth/login');
  }

  const env = (context.locals as any).runtime?.env;
  if (!env?.SESSION) {
    return context.redirect('/api/auth/login');
  }

  const sessionData = await env.SESSION.get(`session:${sessionId}`);
  if (!sessionData) {
    return context.redirect('/api/auth/login');
  }

  context.locals.session = JSON.parse(sessionData);
  context.locals.sessionId = sessionId;

  return next();
});
