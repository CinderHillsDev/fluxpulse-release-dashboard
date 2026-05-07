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

  const raw = await context.locals.runtime.env.CACHE.get(
    `session:${sessionId}`
  );

  if (!raw) {
    context.cookies.delete('dashboard_session');
    return context.redirect('/api/auth/login');
  }

  context.locals.session = JSON.parse(raw);
  context.locals.sessionId = sessionId;

  return next();
});
