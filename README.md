# FluxPulse Release Dashboard

A Cloudflare Pages-hosted dashboard for managing releases across the FluxPulse multi-repo workspace.

## Features

- **Release Status Overview**: See the current version in UAT vs prod for all 13 repos
- **Sync Detection**: Alerts when UAT is ahead of prod (commits not yet released)
- **Pull Request Tracking**: View all open PRs across the workspace
- **Unreleased Commits**: See commits waiting to be released
- **One-Click Release**: Trigger semantic version bumps and prod deployments

## Setup

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g @cloudflare/wrangler`)
- GitHub Personal Access Token (fine-grained: `repo:read`, `actions:write` on all repos)
- Cloudflare Pages project + KV namespace

### Local Development

```bash
npm install
wrangler pages dev
```

Runs at `http://localhost:8788`.

### Deployment

```bash
npm run build
npm run deploy
```

Or use GitHub Actions (see `.github/workflows/deploy.yml`).

## Configuration

### Cloudflare Secrets

Set these via `wrangler secret put`:

```bash
wrangler secret put GITHUB_TOKEN          # Fine-grained PAT
wrangler secret put DASHBOARD_TOKEN       # Any random string (e.g., openssl rand -base64 32)
```

### wrangler.toml

Update the KV namespace IDs:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_KV_NAMESPACE_ID_HERE"
preview_id = "YOUR_KV_PREVIEW_NAMESPACE_ID_HERE"
```

## Architecture

- **Frontend**: React + TypeScript + Vite (SPA)
- **Backend**: Cloudflare Pages Functions (TypeScript)
- **Cache**: Cloudflare KV (5-minute TTL for status, 2-minute for PRs)
- **Auth**: Bearer token in sessionStorage (not persisted)

## API Endpoints

All endpoints require `Authorization: Bearer {DASHBOARD_TOKEN}` header.

- `GET /api/status` — Repo versions and sync state (cached 5 min)
- `GET /api/prs` — All open PRs (cached 2 min)
- `GET /api/unreleased` — Commits since last tag per repo
- `POST /api/dispatch` — Trigger a release workflow
- `DELETE /api/cache` — Invalidate the KV cache

## Future Enhancements

- [ ] Full implementation of `/api/prs` and `/api/unreleased`
- [ ] CI status check (showing if latest commit on main has green CI)
- [ ] Dispatch workflow full implementation
- [ ] Optional: GitHub OAuth for authentication
- [ ] Optional: Slack notifications on deploy events
