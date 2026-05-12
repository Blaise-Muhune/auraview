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

type ContactMessage = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userDisplayName?: string | null;
};

type AdminUserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  emailVerified: boolean;
};

const DEFAULT_BUILD_SUBJECT = 'New Aura build';
const DEFAULT_BUILD_BODY = `Hi —

We just shipped an update to Aura. Open the app to try it out.

Thanks for being here.

— Aura`;

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [buildSubject, setBuildSubject] = useState(DEFAULT_BUILD_SUBJECT);
  const [buildBody, setBuildBody] = useState(DEFAULT_BUILD_BODY);
  const [sendingBuild, setSendingBuild] = useState(false);
  const [sendBuildMessage, setSendBuildMessage] = useState<string | null>(null);
  const [sendBuildError, setSendBuildError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/leaderboard');
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
    loadContactMessages();
    loadAdminUsers();
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

  const loadAdminUsers = async () => {
    if (!user) return;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to load users');
      }
      const data = await res.json();
      setAdminUsers((data as { users?: AdminUserRow[] }).users ?? []);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadContactMessages = async () => {
    if (!user) return;
    setContactLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/contact-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setContactMessages((data as { messages?: ContactMessage[] }).messages ?? []);
    } catch {
      // ignore
    } finally {
      setContactLoading(false);
    }
  };

  const markMessageRead = async (messageId: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/contact-mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, messageId }),
      });
      if (!res.ok) return;
      setContactMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, read: true } : m))
      );
      window.dispatchEvent(new Event('contact-count-updated'));
    } catch {
      // ignore
    }
  };

  const sendBuildEmail = async () => {
    if (!user) return;
    const withEmail = adminUsers.filter((u) => u.email);
    if (withEmail.length === 0) {
      setSendBuildError('No users with an email address.');
      return;
    }
    if (
      !window.confirm(
        `Send this email to ${withEmail.length} user(s) with addresses on file? They are BCC'd; mail is sent from Aura <${ADMIN_EMAIL}> via Gmail.`
      )
    ) {
      return;
    }
    setSendingBuild(true);
    setSendBuildError(null);
    setSendBuildMessage(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/send-build-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: token,
          subject: buildSubject.trim(),
          text: buildBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Send failed');
      }
      const recipientCount = (data as { recipientCount?: number }).recipientCount ?? 0;
      const batches = (data as { batches?: number }).batches ?? 0;
      setSendBuildMessage(`Sent to ${recipientCount} recipient(s) in ${batches} batch(es).`);
    } catch (err) {
      setSendBuildError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSendingBuild(false);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/contact-mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, markAll: true }),
      });
      if (!res.ok) return;
      setContactMessages((prev) => prev.map((m) => ({ ...m, read: true })));
      window.dispatchEvent(new Event('contact-count-updated'));
    } catch {
      // ignore
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
            onClick={() => { loadStats(); loadContactMessages(); loadAdminUsers(); }}
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

        {/* Users + build email */}
        <div className="mb-8 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Users</h2>
            <button
              type="button"
              onClick={() => void loadAdminUsers()}
              disabled={usersLoading}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
            >
              {usersLoading ? 'Loading…' : 'Reload list'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
            Listed from Firebase Auth. To send mail from {ADMIN_EMAIL}, set{' '}
            <code className="text-gray-700 dark:text-gray-400">GMAIL_APP_PASSWORD</code> (Google App Password) on the
            server; optional <code className="text-gray-700 dark:text-gray-400">GMAIL_USER</code> defaults to this
            address.
          </p>
          {usersError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{usersError}</p>
          )}
          {usersLoading && adminUsers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading users…</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, or UID…"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 shrink-0 self-center">
                  {adminUsers.length} account(s) · {adminUsers.filter((u) => u.email).length} with email
                </p>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950/50">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Name</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Email</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 hidden sm:table-cell">UID</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 hidden md:table-cell">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers
                      .filter((u) => {
                        const q = userSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          (u.email?.toLowerCase().includes(q) ?? false) ||
                          (u.displayName?.toLowerCase().includes(q) ?? false) ||
                          u.uid.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => (
                        <tr key={u.uid} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            {u.displayName || '—'}
                            {!u.emailVerified && u.email && (
                              <span className="ml-1 text-xs text-amber-600 dark:text-amber-500" title="Email not verified">
                                (unverified)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                            {u.email ? (
                              <a href={`mailto:${u.email}`} className="hover:underline break-all">
                                {u.email}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 font-mono hidden sm:table-cell break-all max-w-[8rem]">
                            {u.uid}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-500 text-xs hidden md:table-cell whitespace-nowrap">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Build announcement email</h3>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                  Plain text only. Recipients are BCC&apos;d in batches (max 400 per SMTP message). The same message is
                  sent to every Firebase Auth user who has an email.
                </p>
                <label className="block mb-3">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Subject</span>
                  <input
                    type="text"
                    value={buildSubject}
                    onChange={(e) => setBuildSubject(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
                    maxLength={200}
                  />
                </label>
                <label className="block mb-4">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Message</span>
                  <textarea
                    value={buildBody}
                    onChange={(e) => setBuildBody(e.target.value)}
                    rows={8}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm font-mono"
                    maxLength={20000}
                  />
                </label>
                {sendBuildError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3">{sendBuildError}</p>
                )}
                {sendBuildMessage && (
                  <p className="text-sm text-green-700 dark:text-green-400 mb-3">{sendBuildMessage}</p>
                )}
                <button
                  type="button"
                  onClick={() => void sendBuildEmail()}
                  disabled={sendingBuild || adminUsers.filter((u) => u.email).length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {sendingBuild ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 dark:border-gray-400 border-t-white dark:border-t-gray-900 rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send to all with email ({adminUsers.filter((u) => u.email).length})
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

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

        {/* Contact messages */}
        <div className="mb-8 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Contact messages</h2>
            {contactMessages.some((m) => !m.read) && (
              <button
                onClick={markAllRead}
                className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
              >
                Mark all as read
              </button>
            )}
          </div>
          {contactLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading messages...</p>
          ) : contactMessages.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No contact messages yet.</p>
          ) : (
            <ul className="space-y-3">
              {contactMessages.map((msg) => (
                <li
                  key={msg.id}
                  className={`p-4 rounded-lg border ${
                    msg.read
                      ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950/50'
                      : 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {(msg.userDisplayName || msg.userEmail) && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-0.5">
                          {msg.userDisplayName ?? 'Unknown'}
                          {msg.userEmail && (
                            <span className="text-gray-500 dark:text-gray-500">
                              {' · '}
                              <a href={`mailto:${msg.userEmail}`} className="hover:underline">{msg.userEmail}</a>
                            </span>
                          )}
                        </p>
                      )}
                      {!msg.userDisplayName && !msg.userEmail && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-0.5 italic">Unknown sender</p>
                      )}
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{msg.title}</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">{msg.message}</p>
                      {msg.createdAt && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                          {new Date(msg.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {!msg.read && (
                      <button
                        onClick={() => markMessageRead(msg.id)}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

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
