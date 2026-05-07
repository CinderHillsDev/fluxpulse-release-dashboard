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

  try {
    const runtime = (context.locals as any).runtime;
    if (runtime?.env?.SESSION) {
      const sessionData = await runtime.env.SESSION.get(`session:${sessionId}`);
      if (!sessionData) {
        context.cookies.delete('dashboard_session');
        return context.redirect('/api/auth/login');
      }
      context.locals.session = JSON.parse(sessionData);
      context.locals.sessionId = sessionId;
    }
  } catch (e) {
    // Runtime not available in middleware, allow request through
  }

  return next();
});
