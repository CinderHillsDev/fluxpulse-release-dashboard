import { defineMiddleware } from 'astro:middleware';

const DEV_CSRF_TOKEN = 'development-csrf-token-12345678';

export const onRequest = defineMiddleware(async (context, next) => {
  // For local development, use a fixed CSRF token
  context.cookies.set('astro.csrf', DEV_CSRF_TOKEN, {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    path: '/',
  });
  context.locals.csrfToken = DEV_CSRF_TOKEN;

  // Show loading page briefly on home page visits
  // Skip loading page if it has the _skip_loading query param (set after showing loading)
  const skipLoading = context.url.searchParams.has('_skip_loading');
  if (context.url.pathname === '/' && !skipLoading) {
    return context.redirect('/loading');
  }

  return next();
});
