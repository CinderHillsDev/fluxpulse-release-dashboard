# Deployment Guide

## Overview

The release dashboard is a Node.js/Astro application deployed as a Docker container via GitHub Actions.

## Prerequisites

- Docker
- GitHub Personal Access Token (fine-grained: `repo:read`, `actions:write` on all repos)

## Local Deployment

### Setup

1. Create `.env.local`:
   ```
   CF_GH_PAT_FluxPulseReleaseDashboard=ghp_xxxxxxxxxxxx
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

   Opens at `http://localhost:3000`

### Build and Test

```bash
npm run build
npm run preview
```

## Production Deployment

The app is automatically deployed via GitHub Actions when you push to the main branch.

### Manual Docker Build

```bash
docker build -t fluxpulse-release-dashboard:latest .
docker run -p 3000:3000 \
  -e CF_GH_PAT_FluxPulseReleaseDashboard=ghp_xxxxxxxxxxxx \
  fluxpulse-release-dashboard:latest
```

## Environment Variables

- `CF_GH_PAT_FluxPulseReleaseDashboard` — GitHub PAT with `repo:read` and `actions:write` scope

## Troubleshooting

### "Failed to dispatch the workflow"
- Check that the GitHub PAT has `actions:write` permission
- Verify the target workflow exists and has `workflow_dispatch` enabled
- Check server logs for detailed error messages

### "Check server logs for details"
- Review the application logs in the Docker container or deployment platform
- Verify the GitHub API is accessible from your environment
