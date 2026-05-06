import { useState } from 'react';
import { UnreleasedCommit, RepoStatus } from '../types';
import { dispatchRelease } from '../api';

interface UnreleasedListProps {
  unreleased: UnreleasedCommit[];
  repos: RepoStatus[];
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 30) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch {
    return 'unknown';
  }
}

export default function UnreleasedList({ unreleased, repos }: UnreleasedListProps) {
  const [dispatchingRepo, setDispatching] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const reposByName = new Map(repos.map((r) => [r.name, r]));
  const commitsByRepo = new Map<string, UnreleasedCommit[]>();

  unreleased.forEach((commit) => {
    if (!commitsByRepo.has(commit.repo)) {
      commitsByRepo.set(commit.repo, []);
    }
    commitsByRepo.get(commit.repo)!.push(commit);
  });

  const handleRelease = async (repo: string, bumpType: 'patch' | 'minor' | 'major') => {
    try {
      setDispatching(repo);
      setDispatchError(null);
      await dispatchRelease(repo, bumpType);
      alert(`Release ${bumpType} triggered for ${repo}. Check GitHub Actions.`);
    } catch (err) {
      setDispatchError(String(err));
    } finally {
      setDispatching(null);
    }
  };

  if (unreleased.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">All repos are released 🚀</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dispatchError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-900">
          {dispatchError}
        </div>
      )}

      {Array.from(commitsByRepo.entries()).map(([repoName, commits]) => (
        <div key={repoName} className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{repoName}</h3>
              <p className="text-sm text-slate-600">
                {commits.length} commit{commits.length !== 1 ? 's' : ''} since{' '}
                <span className="font-mono">{reposByName.get(repoName)?.latestTag || 'initial'}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRelease(repoName, 'patch')}
                disabled={dispatchingRepo === repoName}
                className="px-3 py-2 text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded disabled:opacity-50"
              >
                Patch
              </button>
              <button
                onClick={() => handleRelease(repoName, 'minor')}
                disabled={dispatchingRepo === repoName}
                className="px-3 py-2 text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded disabled:opacity-50"
              >
                Minor
              </button>
              <button
                onClick={() => handleRelease(repoName, 'major')}
                disabled={dispatchingRepo === repoName}
                className="px-3 py-2 text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 rounded disabled:opacity-50"
              >
                Major
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {commits.map((commit) => (
              <div key={commit.sha} className="flex items-start gap-3 text-sm p-2 hover:bg-slate-50 rounded">
                <a
                  href={commit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 hover:underline flex-shrink-0"
                  title={commit.sha}
                >
                  {commit.sha.slice(0, 7)}
                </a>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 truncate">{commit.message}</p>
                  <p className="text-slate-600 text-xs">
                    {commit.author} · {formatDate(commit.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
