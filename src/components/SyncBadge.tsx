interface SyncBadgeProps {
  state: 'in-sync' | 'uat-ahead' | 'never-deployed' | 'unknown';
}

export default function SyncBadge({ state }: SyncBadgeProps) {
  const styles = {
    'in-sync': 'bg-green-100 text-green-800 border-green-300',
    'uat-ahead': 'bg-amber-100 text-amber-800 border-amber-300',
    'never-deployed': 'bg-slate-100 text-slate-800 border-slate-300',
    'unknown': 'bg-gray-100 text-gray-800 border-gray-300',
  };

  const labels = {
    'in-sync': '● IN SYNC',
    'uat-ahead': '▲ UAT AHEAD',
    'never-deployed': '✗ NEVER DEPLOYED',
    'unknown': '? UNKNOWN',
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}
