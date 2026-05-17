# FluxPulse Release Dashboard

A Node.js/Astro dashboard for managing releases across the FluxPulse multi-repo workspace.

## Features

- **Release Status Overview**: See the current version in UAT vs prod for all 13 repos
- **Sync Detection**: Alerts when UAT is ahead of prod (commits not yet released)
- **Pull Request Tracking**: View all open PRs across the workspace
- **Unreleased Commits**: See commits waiting to be released
- **One-Click Release**: Trigger semantic version bumps and prod deployments

## Setup

### Prerequisites

- Node.js 18+
- GitHub Personal Access Token (fine-grained: `repo:read`, `actions:write` on all repos)

### Local Development

```bash
npm install
npm run dev
```

Runs at `http://localhost:3000` (or the configured dev port).

### Deployment

The app is containerized and deployed via GitHub Actions. See `.github/workflows/deploy.yml` for the deployment pipeline.

## Configuration

### Environment Variables

Set these in your `.env.local` or deployment environment:

- `CF_GH_PAT_FluxPulseReleaseDashboard` — GitHub Personal Access Token (fine-grained: repo:read, actions:read)

## Architecture

- **Framework**: Astro (SSR + Island components)
- **Frontend**: TypeScript + Tailwind CSS
- **Backend**: Astro API routes (Node.js)
- **Container**: Docker (deployed to production)

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
