import { RepoStatus } from '../types';
import SyncBadge from './SyncBadge';

interface RepoCardProps {
  repo: RepoStatus;
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

export default function RepoCard({ repo }: RepoCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{repo.name}</h3>
        <SyncBadge state={repo.syncState} />
      </div>

      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Latest</p>
            <p className="font-mono font-semibold text-slate-900">{repo.latestTag || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">UAT</p>
            <p className="font-mono font-semibold text-blue-600">
              {repo.uatDeploy?.version || '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Prod</p>
            <p className="font-mono font-semibold text-green-600">
              {repo.prodDeploy?.version || '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          {repo.uatDeploy && (
            <div>
              <p className="text-slate-500 mb-1">Last UAT</p>
              <a
                href={repo.uatDeploy.runUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {formatDate(repo.uatDeploy.runAt)} {repo.uatDeploy.conclusion === 'success' && '✓'}
              </a>
            </div>
          )}
          {repo.prodDeploy && (
            <div>
              <p className="text-slate-500 mb-1">Last Prod</p>
              <a
                href={repo.prodDeploy.runUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {formatDate(repo.prodDeploy.runAt)} {repo.prodDeploy.conclusion === 'success' && '✓'}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        {repo.openPrCount > 0 && (
          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
            {repo.openPrCount} open PR{repo.openPrCount !== 1 ? 's' : ''}
          </span>
        )}
        {repo.unreleasedCommits > 0 && (
          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
            {repo.unreleasedCommits} unreleased
          </span>
        )}
        {repo.ciFailing && (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
            CI failing
          </span>
        )}
      </div>
    </div>
  );
}
