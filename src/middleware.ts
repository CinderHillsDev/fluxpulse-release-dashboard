import { defineMiddleware } from 'astro:middleware';

// In Astro 6+, CSRF protection is automatic for POST requests.
// This middleware makes the CSRF token available to page components.
export const onRequest = defineMiddleware(async (context, next) => {
  // Get or generate a CSRF token for form submissions
  let token = context.cookies.get('astro.csrf')?.value;
  if (!token) {
    token = crypto.getRandomValues(new Uint8Array(32))
      .reduce((s, b) => s + (b < 16 ? '0' : '') + b.toString(16), '');
    context.cookies.set('astro.csrf', token, {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }
  context.locals.csrfToken = token;

  // Show loading page on first visit to home page
  if (context.url.pathname === '/' && !context.cookies.has('visited')) {
    context.cookies.set('visited', 'true', {
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return context.redirect('/loading');
  }

  return next();
});
