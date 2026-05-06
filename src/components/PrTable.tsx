import { PR } from '../types';

interface PrTableProps {
  prs: PR[];
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

export default function PrTable({ prs }: PrTableProps) {
  if (prs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No open pull requests 🎉</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Repo</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">PR</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Title</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Author</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Age</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Labels</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {prs.map((pr) => (
            <tr key={`${pr.repo}-${pr.number}`} className="hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-medium text-slate-900">{pr.repo}</td>
              <td className="px-6 py-4 text-sm">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  #{pr.number}
                </a>
              </td>
              <td className="px-6 py-4 text-sm text-slate-700 max-w-xs truncate">{pr.title}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{pr.author}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{formatDate(pr.createdAt)}</td>
              <td className="px-6 py-4 text-sm">
                {pr.labels.length > 0 ? (
                  <div className="flex gap-1">
                    {pr.labels.map((label) => (
                      <span
                        key={label}
                        className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
