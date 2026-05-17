import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // For local development, use a simple non-expiring CSRF token
  let token = context.cookies.get('astro.csrf')?.value;
  if (!token) {
    token = 'dev-token-' + Math.random().toString(36).substring(7);
    context.cookies.set('astro.csrf', token, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  }
  context.locals.csrfToken = token;

  // Show loading page on first visit to home page
  if (context.url.pathname === '/' && !context.cookies.has('visited')) {
    context.cookies.set('visited', 'true', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
    return context.redirect('/loading');
  }

  return next();
});
