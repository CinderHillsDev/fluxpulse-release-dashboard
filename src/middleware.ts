import { defineMiddleware } from 'astro:middleware';

// In Astro 6+, CSRF protection is automatic for POST requests.
// This middleware makes the CSRF token available to page components.
export const onRequest = defineMiddleware(async (context, next) => {
  // Get or generate a CSRF token for form submissions
  let token = context.cookies.get('__Host-astro.csrf')?.value;
  if (!token) {
    token = crypto.getRandomValues(new Uint8Array(32))
      .reduce((s, b) => s + (b < 16 ? '0' : '') + b.toString(16), '');
    context.cookies.set('__Host-astro.csrf', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }
  context.locals.csrfToken = token;
  return next();
});
