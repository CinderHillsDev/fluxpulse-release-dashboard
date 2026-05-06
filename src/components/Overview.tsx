import { RepoStatus } from '../types';
import RepoCard from './RepoCard';

interface OverviewProps {
  repos: RepoStatus[];
}

export default function Overview({ repos }: OverviewProps) {
  const inSync = repos.filter((r) => r.syncState === 'in-sync').length;
  const outOfSync = repos.filter((r) => r.syncState === 'uat-ahead').length;
  const neverDeployed = repos.filter((r) => r.syncState === 'never-deployed').length;

  return (
    <div>
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-slate-700">
          <span className="font-semibold">{inSync}</span> in sync •{' '}
          <span className="font-semibold text-amber-600">{outOfSync}</span> UAT ahead •{' '}
          <span className="font-semibold text-slate-600">{neverDeployed}</span> never deployed
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {repos.map((repo) => (
          <RepoCard key={repo.name} repo={repo} />
        ))}
      </div>
    </div>
  );
}
