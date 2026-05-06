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
  ciFailing: boolean;
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
