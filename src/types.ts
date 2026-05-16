export interface DeployInfo {
  version: string | null;
  runAt: string;
  runUrl: string;
  conclusion: 'success' | 'failure' | 'in_progress';
}

export interface RepoStatus {
  name: string;
  latestTag: string | null;
  uatDeploy: DeployInfo | null;
  prodDeploy: DeployInfo | null;
  syncState: 'in-sync' | 'uat-ahead' | 'never-deployed' | 'unknown';
  openPrCount: number;
  unreleasedCommits: number;
  /**
   * Commits on main but not yet deployed to UAT.
   * Each commit may be enriched with the PR it landed via (PR title +
   * number) when one is detected from the commit message; otherwise the
   * raw commit message is shown. Direct pushes to main therefore stay
   * visible even when no PR flow was used.
   */
  pendingUatItems: QueuedItem[];
  /**
   * Same shape, but for commits in UAT and not yet promoted to prod.
   */
  pendingProdItems: QueuedItem[];
  ciFailing: boolean;
  ciRunUrl: string | null;
  ciConclusion: string | null;  // success | failure | cancelled | null (when in_progress)
  ciStatus: string | null;      // queued | in_progress | completed
}

/**
 * A single row in the Pending UAT / Pending Prod buckets. Always backed
 * by a commit; optionally enriched with PR info when the commit is the
 * tip of a merged PR (squash, rebase, or merge-commit strategies).
 */
export interface QueuedItem {
  sha: string;            // commit SHA (full)
  shortSha: string;       // first 8 chars
  title: string;          // PR title if available, else first line of commit msg
  author: string;         // GitHub login (PR.user) or commit.author.name fallback
  date: string;           // PR merged_at or commit.committer.date
  url: string;            // PR URL if linked, else commit URL on GitHub
  prNumber: number | null;
  labels: string[];       // PR labels (empty for direct commits)
}

export interface PR {
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  createdAt: string;
  labels: string[];
}

export interface UnreleasedCommit {
  repo: string;
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface DashboardStatus {
  repos: RepoStatus[];
  prs: PR[];
  unreleased: UnreleasedCommit[];
  lastUpdated: string;
}
