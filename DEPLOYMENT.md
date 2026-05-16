# Deployment Guide

## Prerequisites

- Cloudflare account with Workers enabled
- `wrangler` CLI installed and authenticated (`wrangler auth`)
- GitHub OAuth App configured
- Cloudflare API token (for CI/CD deployments)

## Setting Up KV Namespaces

The dashboard requires a KV namespace for OAuth state tokens and session storage.

KV namespaces are already created (IDs in `wrangler.toml`). If you need to recreate them:

```bash
wrangler kv:namespace create fluxpulse-dashboard-kv
wrangler kv:namespace create fluxpulse-dashboard-kv --preview
```

## Configuration

### 1. Set Cloudflare Account ID

Update `wrangler.toml` with your Cloudflare account ID:

```toml
[env.production]
account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
```

Find your account ID at: https://dash.cloudflare.com/

### 2. Set DNS Routes (optional)

If deploying to a custom domain, update the `routes` in `wrangler.toml`:

```toml
routes = [
  { pattern = "release-dashboard.YOUR_DOMAIN/*", zone_name = "YOUR_DOMAIN" }
]
```

### 3. Set GitHub Secrets

```bash
wrangler secret put GITHUB_CLIENT_ID --env production
wrangler secret put GITHUB_CLIENT_SECRET --env production
wrangler secret put CF_GH_PAT_FluxPulseReleaseDashboard --env production
```

When prompted, enter values from your GitHub OAuth App and Personal Access Token.

## Deploying

### Manual Deploy

```bash
npm run deploy  # Builds and deploys to production
```

Or with explicit environment:

```bash
npm run build
wrangler deploy --main ./dist/server/entry.mjs --env production
```

### Local Preview

```bash
npm run preview  # Starts local Wrangler dev server
```

## Verifying Deployment

1. Navigate to your Worker's URL
2. You should be redirected to `/api/auth/login`
3. Click "Sign in with GitHub"
4. Complete GitHub OAuth flow
5. If successful, you'll see the release dashboard

## Troubleshooting

### Authentication fails with 500 error
- Verify all three GitHub secrets are set: `wrangler secret list --env production`
- Check that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` match your OAuth App

### OAuth redirect loop
- Verify GitHub OAuth App redirect URI matches your Worker URL: `https://YOUR_WORKER_URL/api/auth/callback`
- Check that callback route is accessible (no auth middleware blocking it)

### KV operations timeout
- Verify KV namespace IDs in `wrangler.toml` match created namespaces
- Check Cloudflare dashboard to ensure KV namespaces exist

## Local Development

1. Copy `.dev.vars.example` to `.dev.vars`
2. Fill in GitHub OAuth App credentials
3. Run `npm run dev`
4. Server will start on `http://localhost:3000`

Wrangler's `npm run dev` automatically emulates KV locally.
