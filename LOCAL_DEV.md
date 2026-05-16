# Local Development

## Prerequisites

1. **Create GitHub PAT token**:
   - Go to https://github.com/settings/tokens/new
   - Select `repo` scope (repo read access)
   - Copy the token

---

## Option 1: Docker (Recommended — Always Running)

**One-time setup:**

```bash
cd /Users/chris/coding/fluxpulse/fluxpulse-release-dashboard

# Copy the template and add your PAT
cp .env.example .env
# Edit .env and replace ghp_xxxx with your actual token
```

**Then start it:**

```bash
# Start the container (reads .env automatically)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

**In OrbStack:** The container will appear under the `fluxpulse-release-dashboard` group. You can see it in OrbStack's UI with the service labeled "Release Dashboard".

The dashboard will be available at `http://localhost:3000` and restart automatically if your machine reboots. Your `.env` file is git-ignored, so your token won't be committed.

---

## Option 2: Direct npm (Manual)

If you prefer to run it manually without Docker:

1. **Configure .dev.vars**:
   ```bash
   # Edit .dev.vars and fill in your token:
   CF_GH_PAT_FluxPulseReleaseDashboard=ghp_xxxxxxxxxxxxxxxxxxxx
   ```

2. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```

3. **Open dashboard**:
   - Navigate to `http://localhost:3000`

---

## Features

- **Refresh button (↻)** on each repo to fetch latest status
- **Click status dots** (CI, UAT, Prod) to view GitHub Actions runs
- No cloud costs, no authentication, full control

## Troubleshooting

- If repos show as grey/empty, check that your GitHub PAT has `repo` scope
- PAT must be able to read: workflow runs, deployments, tags, commit comparisons, PRs
- For Docker: ensure Docker Desktop is running
- For Docker: use `docker-compose logs` to see errors
