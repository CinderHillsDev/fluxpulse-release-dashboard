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
   * Merged PRs that are on main but not yet deployed to UAT.
   * Each row of the "Pending UAT" bucket on the release-queue page.
   */
  pendingUatPrs: MergedPr[];
  /**
   * Merged PRs in UAT but not yet in prod.
   * Each row of the "Pending Prod" bucket on the release-queue page.
   */
  pendingProdPrs: MergedPr[];
  ciFailing: boolean;
}

export interface MergedPr {
  number: number;
  title: string;
  author: string;
  mergedAt: string;
  url: string;
  labels: string[];
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
