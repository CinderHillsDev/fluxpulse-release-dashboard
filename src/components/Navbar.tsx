interface NavbarProps {
  currentTab: 'overview' | 'prs' | 'unreleased';
  onTabChange: (tab: 'overview' | 'prs' | 'unreleased') => void;
  onRefresh: () => void;
  lastUpdated: string;
  onLogout: () => void;
}

export default function Navbar({
  currentTab,
  onTabChange,
  onRefresh,
  lastUpdated,
  onLogout,
}: NavbarProps) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'prs', label: 'Pull Requests' },
    { id: 'unreleased', label: 'Unreleased' },
  ] as const;

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">FluxPulse Release Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={onRefresh}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="Refresh data"
            >
              🔄 Refresh
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 font-medium rounded-lg transition ${
                  currentTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {lastUpdated && (
            <p className="text-sm text-slate-500">Updated: {lastUpdated}</p>
          )}
        </div>
      </div>
    </nav>
  );
}
