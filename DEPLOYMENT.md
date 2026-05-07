# Deployment Guide

## Prerequisites

- Cloudflare account with Pages project set up
- `wrangler` CLI installed and authenticated (`wrangler auth`)
- GitHub OAuth App configured with proper secrets

## Setting Up KV Namespaces

The dashboard requires a KV namespace for OAuth state tokens and session storage. Follow these steps:

### 1. Create KV Namespaces

```bash
# Create production namespace
wrangler kv:namespace create "fluxpulse-dashboard-kv" --preview false

# Create preview namespace (for staging/development)
wrangler kv:namespace create "fluxpulse-dashboard-kv" --preview
```

Each command will output a namespace ID. Save both.

### 2. Update wrangler.toml

Replace the placeholder IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "APP_KV"
id = "YOUR_PRODUCTION_NAMESPACE_ID"
preview_id = "YOUR_PREVIEW_NAMESPACE_ID"
```

### 3. Set Secrets

Store GitHub OAuth credentials as Cloudflare secrets:

```bash
wrangler secret put GITHUB_CLIENT_ID --env production
wrangler secret put GITHUB_CLIENT_SECRET --env production
wrangler secret put GITHUB_TOKEN --env production
```

When prompted, enter the values from your GitHub OAuth App and Personal Access Token.

## Deploying

```bash
git push  # Commits must be pushed to trigger Pages deployment
```

Cloudflare Pages will automatically deploy when you push to your main branch (if connected).

Alternatively, manually deploy:

```bash
npm run build
wrangler pages deploy dist --project-name fluxpulse-release-dashboard
```

## Verifying Deployment

1. Navigate to your Pages project URL
2. You should be redirected to `/api/auth/login`
3. Click "Sign in with GitHub"
4. Complete GitHub OAuth flow
5. If successful, you'll see the release dashboard

## Troubleshooting

### "Worker threw exception" errors
- Check that KV namespace ID is correctly set in wrangler.toml
- Verify `wrangler secret list` shows all three GitHub secrets

### OAuth redirect loop
- Verify GitHub OAuth App redirect URI matches deployed URL: `https://your-project.pages.dev/api/auth/callback`
- Check that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct

### Sessions not persisting
- Ensure KV namespace binding is properly configured
- Check that Cloudflare Pages has read/write access to the KV namespace

## Local Development

1. Copy `.dev.vars.example` to `.dev.vars`
2. Fill in GitHub OAuth App credentials
3. Run `npm run dev` or `astro dev`
4. Server will start on `http://localhost:3000`

Note: Local development with KV requires Wrangler's local KV emulation (automatic with `npm run dev`).
