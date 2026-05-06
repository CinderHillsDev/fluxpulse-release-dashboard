import { DashboardStatus, PR, UnreleasedCommit, RepoStatus } from './types';

const API_BASE = '/api';

function getAuthToken(): string | null {
  return sessionStorage.getItem('dashboard_token');
}

function getHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getStatus(): Promise<RepoStatus[]> {
  const res = await fetch(`${API_BASE}/status`, {
    headers: getHeaders(),
  });

  if (res.status === 401) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Failed to fetch status: ${res.statusText}`);
  }

  return res.json();
}

export async function getPrs(): Promise<PR[]> {
  const res = await fetch(`${API_BASE}/prs`, {
    headers: getHeaders(),
  });

  if (res.status === 401) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Failed to fetch PRs: ${res.statusText}`);
  }

  return res.json();
}

export async function getUnreleased(): Promise<UnreleasedCommit[]> {
  const res = await fetch(`${API_BASE}/unreleased`, {
    headers: getHeaders(),
  });

  if (res.status === 401) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Failed to fetch unreleased: ${res.statusText}`);
  }

  return res.json();
}

export async function dispatchRelease(
  repo: string,
  bumpType: 'patch' | 'minor' | 'major'
): Promise<void> {
  const res = await fetch(`${API_BASE}/dispatch`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      repo,
      workflow: 'deploy-prod.yml',
      bump_type: bumpType,
    }),
  });

  if (res.status === 401) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Failed to dispatch release: ${res.statusText}`);
  }
}

export async function invalidateCache(): Promise<void> {
  const res = await fetch(`${API_BASE}/cache`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (res.status === 401) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Failed to invalidate cache: ${res.statusText}`);
  }
}
