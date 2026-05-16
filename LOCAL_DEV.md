# Local Development

## Setup

1. **Create GitHub PAT token**:
   - Go to https://github.com/settings/tokens/new
   - Select `repo` scope (repo read access)
   - Copy the token

2. **Configure .dev.vars**:
   ```bash
   # Edit .dev.vars and fill in your token:
   CF_GH_PAT_FluxPulseReleaseDashboard=ghp_xxxxxxxxxxxxxxxxxxxx
   ```

3. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```

4. **Open dashboard**:
   - Navigate to `http://localhost:3000`
   - No login required for local development
   - All 13 repos will load and display their CI/deployment status

## Features

- **Refresh button (↻)** on each repo to fetch latest status
- **Click status dots** (CI, UAT, Prod) to view GitHub Actions runs
- No cloud costs, no authentication, full control

## Troubleshooting

- If repos show as grey/empty, check that your GitHub PAT has `repo` scope
- PAT must be able to read: workflow runs, deployments, tags, commit comparisons, PRs
