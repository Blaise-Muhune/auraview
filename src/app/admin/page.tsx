'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const ADMIN_EMAIL = 'blaisemu007@gmail.com';

type AdminStats = {
  users: number;
  groups: number;
  ratings: number;
  ratingsByDay: { date: string; ratings: number; fullDate: string }[];
  overview: { name: string; value: number; fill: string }[];
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const email = user.email?.toLowerCase();
    if (email !== ADMIN_EMAIL.toLowerCase()) {
      router.push('/dashboard');
      return;
    }
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadStats depends on user, runs on mount
  }, [user, router]);

  const loadStats = async () => {
    if (!user) return;
    setRefreshing(true);
    setStatsError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to load stats');
      }
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-900 dark:border-t-white rounded-full animate-spin" />
          <span className="text-gray-500 dark:text-gray-400 text-sm">Loading admin...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const email = user.email?.toLowerCase();
  if (email !== ADMIN_EMAIL.toLowerCase()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/dashboard" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}`
                : 'App overview and analytics'}
            </p>
          </div>
          <button
            onClick={loadStats}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {refreshing ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>

        {statsError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {statsError}
          </div>
        )}

        {stats && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="relative overflow-hidden p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-950">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -translate-y-8 translate-x-8" />
                <div className="relative">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Users</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.users.toLocaleString()}</p>
                </div>
              </div>
              <div className="relative overflow-hidden p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-gray-950">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -translate-y-8 translate-x-8" />
                <div className="relative">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Groups</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.groups.toLocaleString()}</p>
                </div>
              </div>
              <div className="relative overflow-hidden p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-gray-950">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -translate-y-8 translate-x-8" />
                <div className="relative">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">Ratings</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.ratings.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Bar chart - Overview */}
            <div className="mb-8 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Overview</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.overview} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgb(255 255 255 / 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), '']}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {stats.overview.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Area chart - Ratings last 7 days */}
            <div className="mb-8 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Ratings (last 7 days)</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.ratingsByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ratingsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgb(255 255 255 / 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number | undefined) => [value ?? 0, 'Ratings']}
                    />
                    <Area
                      type="monotone"
                      dataKey="ratings"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#ratingsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie chart - Distribution */}
            <div className="mb-8 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Distribution</h2>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.overview}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {stats.overview.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgb(255 255 255 / 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {!stats && !statsError && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-900 dark:border-t-white rounded-full animate-spin mb-4" />
            <p className="text-sm">Loading stats...</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
