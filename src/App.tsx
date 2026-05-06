import { useState, useEffect } from 'react';
import { RepoStatus, PR, UnreleasedCommit } from './types';
import { getStatus, getPrs, getUnreleased, ApiError, invalidateCache } from './api';
import LoginScreen from './components/LoginScreen';
import Navbar from './components/Navbar';
import Overview from './components/Overview';
import PrTable from './components/PrTable';
import UnreleasedList from './components/UnreleasedList';

type Tab = 'overview' | 'prs' | 'unreleased';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('dashboard_token');
  });
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('overview');
  const [repos, setRepos] = useState<RepoStatus[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  const [unreleased, setUnreleased] = useState<UnreleasedCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Handle OAuth redirect parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const sessionId = params.get('session');
    const errorParam = params.get('auth_error');

    if (sessionId) {
      sessionStorage.setItem('dashboard_token', sessionId);
      // Strip session param from URL so it doesn't linger in browser history
      history.replaceState(null, '', window.location.pathname);
      setIsAuthenticated(true);
      setAuthError(null);
    } else if (errorParam) {
      history.replaceState(null, '', window.location.pathname);
      setAuthError(errorParam);
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [reposData, prsData, unreleasedData] = await Promise.all([
        getStatus(),
        getPrs(),
        getUnreleased(),
      ]);

      setRepos(reposData);
      setPrs(prsData);
      setUnreleased(unreleasedData);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setIsAuthenticated(false);
          sessionStorage.removeItem('dashboard_token');
        } else {
          setError(err.message);
        }
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      const interval = setInterval(loadData, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginScreen onAuthenticate={() => setIsAuthenticated(true)} authError={authError} />;
  }

  const handleRefresh = async () => {
    await invalidateCache();
    await loadData();
  };

  const handleLogout = async () => {
    // Fire-and-forget server-side session deletion
    const token = sessionStorage.getItem('dashboard_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => {}); // ignore errors — local clear is what matters
    }
    sessionStorage.removeItem('dashboard_token');
    setIsAuthenticated(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        currentTab={tab}
        onTabChange={setTab}
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-900">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Loading...</p>
          </div>
        )}

        {!loading && (
          <>
            {tab === 'overview' && <Overview repos={repos} />}
            {tab === 'prs' && <PrTable prs={prs} />}
            {tab === 'unreleased' && <UnreleasedList unreleased={unreleased} repos={repos} />}
          </>
        )}
      </main>
    </div>
  );
}
