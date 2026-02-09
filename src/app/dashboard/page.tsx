'use client';

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserGroups, getUserRatersCount, getUserTotalAura } from "@/lib/firestore";
import { Nav } from "@/components/Nav";

const Plus = () => <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
const Key = () => <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>;
const Chart = () => <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
const RectangleStack = () => <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" /></svg>;
export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [groupsCount, setGroupsCount] = useState(0);
  const [ratersCount, setRatersCount] = useState(0);
  const [totalAura, setTotalAura] = useState(500);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) loadUserStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadUserStats runs on mount/auth change
  }, [user, loading, router]);

  const loadUserStats = async () => {
    if (!user) return;
    try {
      const [groups, raters, aura] = await Promise.all([
        getUserGroups(user.uid),
        getUserRatersCount(user.uid),
        getUserTotalAura(user.uid)
      ]);
      setGroupsCount(groups.length);
      setRatersCount(raters);
      setTotalAura(aura);
    } catch (err) {
      console.error('Failed to load user stats:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav />

      <main className="max-w-xl mx-auto px-5 py-10">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Get aura</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Choose how you want to get rated</p>
        </header>

        {/* Aura points at top */}
        <div className="flex items-center justify-between py-4 px-5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 dark:text-amber-400"><Chart /></span>
            <span className="text-sm text-gray-500 dark:text-gray-400">My aura</span>
          </div>
          <span className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">{totalAura.toLocaleString()}</span>
        </div>

        {/* Primary choice: create/join group OR share link */}
        <div className="space-y-3 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <Link href="/create-group" className="flex gap-3 p-4 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <span className="text-gray-500 dark:text-gray-400 mt-0.5"><Plus /></span>
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">Create group</span>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Name it, get a code</p>
              </div>
            </Link>
            <Link href="/join-group" className="flex gap-3 p-4 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <span className="text-gray-500 dark:text-gray-400 mt-0.5"><Key /></span>
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">Join group</span>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Enter code</p>
              </div>
            </Link>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">or</p>
          <Link href={`/profile/${user.uid}`} className="flex items-center gap-3 p-4 border-2 border-amber-500/50 dark:border-amber-400/50 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
            {user.photoURL && !avatarError ? (
              <Image src={user.photoURL} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover shrink-0" unoptimized onError={() => setAvatarError(true)} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm font-medium">
                {(user.displayName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-900 dark:text-gray-100">Share your link to get rated</span>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.displayName || 'User'}</p>
            </div>
            <span className="text-amber-600 dark:text-amber-400 font-medium text-sm shrink-0">Get rated →</span>
          </Link>
        </div>

        {/* Secondary: the rest */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Quick links</p>
          <div className="flex gap-3 mb-4">
            <Link href="/leaderboard" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium hover:opacity-90 transition-colors">
              <Chart />
              Global rankings
            </Link>
            <Link href="/my-groups" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[13px] font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <RectangleStack />
              My groups
            </Link>
          </div>
          <div className="flex gap-3">
            <Link href="/profile" className="flex-1 py-2.5 text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              Edit profile
            </Link>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span className="flex-1 py-2.5 text-center text-sm text-gray-500 dark:text-gray-400">
              {groupsCount} groups · {ratersCount} rated by
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
