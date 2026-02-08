'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserGroups, getUserDistributedPoints, getUserTotalAura } from "@/lib/firestore";
import { Nav } from "@/components/Nav";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [groupsCount, setGroupsCount] = useState(0);
  const [given, setGiven] = useState(0);
  const [totalAura, setTotalAura] = useState(500);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) loadUserStats();
  }, [user, loading, router]);

  const loadUserStats = async () => {
    if (!user) return;
    try {
      const [groups, distributed, aura] = await Promise.all([
        getUserGroups(user.uid),
        getUserDistributedPoints(user.uid),
        getUserTotalAura(user.uid)
      ]);
      setGroupsCount(groups.length);
      setGiven(distributed);
      setTotalAura(aura);
    } catch (err) {
      console.error('Failed to load user stats:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
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
      <Nav rightContent={
        <>
          <Link href="/leaderboard" className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            Top auras
          </Link>
          <button onClick={handleSignOut} className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:underline">
            Sign out
          </button>
        </>
      } />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Discover what friends think</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Create or join a group—share appreciation in seconds</p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link href="/create-group" className="p-4 border border-gray-200 dark:border-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900">
            <span className="font-medium text-gray-900 dark:text-gray-100">Create group</span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Name it, get a code</p>
          </Link>
          <Link href="/join-group" className="p-4 border border-gray-200 dark:border-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900">
            <span className="font-medium text-gray-900 dark:text-gray-100">Join group</span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter code</p>
          </Link>
        </div>

        <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            {user.photoURL && <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{user.displayName || 'User'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Link href={`/profile/${user.uid}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Share profile
              </Link>
              <Link href="/onboarding" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
                Edit
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{totalAura.toLocaleString()}</p>
              <p className="text-gray-500 dark:text-gray-400">How people see you</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{groupsCount}</p>
              <p className="text-gray-500 dark:text-gray-400">Groups</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{given.toLocaleString()}</p>
              <p className="text-gray-500 dark:text-gray-400">Given</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/leaderboard" className="flex-1 p-4 border border-gray-200 dark:border-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 text-center text-sm">
            Top auras
          </Link>
          <Link href="/my-groups" className="flex-1 p-4 border border-gray-200 dark:border-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 text-center text-sm">
            My groups
          </Link>
        </div>
      </main>
    </div>
  );
}
