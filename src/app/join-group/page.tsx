'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { getGroupByCode, joinGroup } from "@/lib/firestore";
import { sendNotification } from "@/lib/notify";

function JoinGroupContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState('');
  const autoJoinAttempted = useRef(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Check for code in URL parameters
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      const code = codeFromUrl.toUpperCase();
      setGroupCode(code);
      localStorage.setItem('pendingGroupCode', code);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !user) {
      const code = searchParams.get('code')?.toUpperCase() || groupCode;
      const loginUrl = code ? `/login?code=${encodeURIComponent(code)}` : '/login';
      router.push(loginUrl);
    }
  }, [user, loading, router, searchParams, groupCode]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { ensureUserProfile } = await import('@/lib/firestore');
      await ensureUserProfile(user);
      setProfileLoading(false);
    })();
  }, [user]);

  const performJoin = useCallback(async () => {
    if (!user || !groupCode?.trim()) return;
    const code = groupCode.trim().toUpperCase();
    const group = await getGroupByCode(code);
    if (!group) {
      setError('Group not found. Please check the code.');
      return;
    }
    if (!group.isActive) {
      setError('This group session is no longer active.');
      return;
    }
    setIsJoining(true);
    setError(null);
    try {
      await joinGroup(group.id!, user);
      if (group.createdBy) {
        const token = await user.getIdToken();
        sendNotification(group.createdBy, 'group_join', {
          joinerName: user.displayName || 'Someone',
          groupName: group.name,
        }, { token, fromUserId: user.uid });
      }
      localStorage.removeItem('pendingGroupCode');
      setSuccess("You're in! Redirecting...");
      setTimeout(() => router.push('/my-groups'), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join group');
    } finally {
      setIsJoining(false);
    }
  }, [user, groupCode, router]);

  // Auto-join when logged-in user lands with a valid code
  useEffect(() => {
    if (!user || loading || profileLoading || !groupCode?.trim() || isJoining || success || autoJoinAttempted.current) return;
    autoJoinAttempted.current = true;
    performJoin();
  }, [user, loading, profileLoading, groupCode, isJoining, success, performJoin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsJoining(true);
    setError(null);
    setSuccess(null);

    try {
      if (!groupCode.trim()) {
        throw new Error('Group code is required');
      }

      const code = groupCode.trim().toUpperCase();
      const group = await getGroupByCode(code);

      if (!group) {
        throw new Error('Group not found. Please check the code.');
      }

      if (!group.isActive) {
        throw new Error('This group session is no longer active.');
      }

      await joinGroup(group.id!, user);
      if (group.createdBy) {
        const token = await user.getIdToken();
        sendNotification(group.createdBy, 'group_join', {
          joinerName: user.displayName || 'Someone',
          groupName: group.name,
        }, { token, fromUserId: user.uid });
      }
      localStorage.removeItem('pendingGroupCode');
      setSuccess(`You&apos;re in! Redirecting...`);
      setTimeout(() => router.push('/my-groups'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setIsJoining(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setGroupCode(value);
    // Store the group code for redirect after authentication
    if (value.trim()) {
      localStorage.setItem('pendingGroupCode', value);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/dashboard" />

      <main className="max-w-xl mx-auto px-5 py-10">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Join group</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Enter the 6-character code</p>
        </header>

          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            {error && (
              <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>
            )}

            {success && (
              <p className="mb-4 text-green-600 dark:text-green-400 text-sm">{success}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="groupCode" className="block text-gray-900 dark:text-gray-100 font-medium mb-2 text-sm">
                  Group Code
                </label>
                <input
                  type="text"
                  id="groupCode"
                  value={groupCode}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-center text-lg font-mono tracking-widest"
                  placeholder="ABC123"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Enter the 6-character code shared with you
                </p>
              </div>

              <button
                type="submit"
                disabled={isJoining || !groupCode.trim()}
                className="w-full px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 disabled:opacity-50 text-[13px]"
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Joining Group...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Join
                  </span>
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              <Link href="/create-group" className="underline">Create a group</Link> instead
            </p>
          </div>
      </main>
    </div>
  );
}

export default function JoinGroup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    }>
      <JoinGroupContent />
    </Suspense>
  );
} 