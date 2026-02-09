'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getUserGroups, leaveGroup, closeGroupVoting, getParticipantIdsRatedByUserInGroup, GroupSession } from "@/lib/firestore";
import { collection, query, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MyGroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const [closingGroupId, setClosingGroupId] = useState<string | null>(null);
  const [visibleCodes, setVisibleCodes] = useState<{[key: string]: boolean}>({});
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [unratedCountByGroupId, setUnratedCountByGroupId] = useState<Record<string, number>>({});

  const loadUserGroups = useCallback(async () => {
    try {
      console.log('Loading user groups for user:', user?.uid);
      
      // Test Firestore connection first
      console.log('Testing Firestore connection...');
      const testQuery = query(collection(db, 'groups'), limit(1));
      const testSnapshot = await getDocs(testQuery);
      console.log('Firestore connection test successful, found', testSnapshot.size, 'documents');
      
      const userGroups = await getUserGroups(user!.uid);
      console.log('Loaded groups:', userGroups);
      setGroups(userGroups);
    } catch (error) {
      console.error('Error loading user groups:', error);
      setError('Failed to load your groups');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadUserGroups();
    }
  }, [user, loading, router, loadUserGroups]);

  useEffect(() => {
    if (!user || groups.length === 0) return;
    const fetchUnratedCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        groups.map(async (g) => {
          if (!g.id) return;
          const rated = await getParticipantIdsRatedByUserInGroup(g.id, user.uid);
          const participantsToRate = g.participants.filter((p) => p !== user.uid);
          const unrated = participantsToRate.filter((p) => !rated.includes(p));
          counts[g.id] = unrated.length;
        })
      );
      setUnratedCountByGroupId((prev) => ({ ...prev, ...counts }));
    };
    fetchUnratedCounts();
  }, [user, groups]);

  const handleCloseVoting = async (groupId: string) => {
    setClosingGroupId(groupId);
    try {
      await closeGroupVoting(groupId);
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, votingClosed: true } : g));
    } catch {
      setError('Failed to close voting');
    } finally {
      setClosingGroupId(null);
    }
  };

  const copyGroupLink = async (group: GroupSession) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/join-group?code=${group.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedGroupId(group.id!);
      setTimeout(() => setCopiedGroupId(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedGroupId(group.id!);
      setTimeout(() => setCopiedGroupId(null), 2000);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return;

    setLeavingGroupId(groupId);
    try {
      await leaveGroup(groupId, user.uid);
      // Remove the group from the local state
      setGroups(prev => prev.filter(group => group.id !== groupId));
    } catch {
      setError('Failed to leave group');
    } finally {
      setLeavingGroupId(null);
    }
  };

  const shareGroupLink = async (group: GroupSession) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/join-group?code=${group.code}`;
    const title = `Join ${group.name} on Aura`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url, text: `Join my group "${group.name}" on Aura` });
        setCopiedGroupId(group.id!);
        setTimeout(() => setCopiedGroupId(null), 2000);
        return;
      } catch {
        // User cancelled or share failed
      }
    }
    copyGroupLink(group);
  };

  const toggleCodeVisibility = (groupId: string) => {
    setVisibleCodes(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading groups...</span>
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
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">My Groups</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{groups.length} {groups.length === 1 ? 'group' : 'groups'}</p>
        </header>

        {error && (
          <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>
        )}

        {groups.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">No groups yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Create or join to get started</p>
            <div className="flex gap-3 justify-center">
              <Link 
                href="/create-group"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-[13px] hover:opacity-90 transition-colors"
                title="Create group"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create
              </Link>
              <Link 
                href="/join-group"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-[13px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Join with code"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
                Join
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group, i) => {
              const isCreator = group.createdBy === user.uid;
              const initial = group.name.charAt(0).toUpperCase();
              
              return (
                <div 
                  key={group.id} 
                  className="aura-card relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/30 transition-all duration-300"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                  
                  <div className="flex items-start justify-between gap-4 p-4 pl-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-semibold text-sm shrink-0">
                          {initial}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{group.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {group.participants.length} {group.participants.length === 1 ? 'person' : 'people'}
                            {isCreator && ' · You'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ml-[52px]">
                        <span className="font-mono">{visibleCodes[group.id!] ? group.code : '••••••'}</span>
                        <button onClick={() => toggleCodeVisibility(group.id!)} className="p-1 hover:text-amber-600 dark:hover:text-amber-400 rounded" title={visibleCodes[group.id!] ? 'Hide code' : 'Show code'}>
                          {visibleCodes[group.id!] ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                        <button onClick={() => copyGroupLink(group)} className="p-1 hover:text-amber-600 dark:hover:text-amber-400 rounded" title="Copy link">
                          {copiedGroupId === group.id ? (
                            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                          )}
                        </button>
                        <button onClick={() => shareGroupLink(group)} className="p-1 hover:text-amber-600 dark:hover:text-amber-400 rounded" title="Share invite link">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        </button>
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-1 ml-[52px]">{group.description}</p>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {(() => {
                        const participantsToRate = group.participants.filter((p) => p !== user.uid);
                        const unratedCount = unratedCountByGroupId[group.id!] ?? participantsToRate.length;
                        const allRated = participantsToRate.length > 0 && unratedCount === 0;
                        const showRate = !group.votingClosed && !allRated && participantsToRate.length > 0;
                        return (
                      <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-0.5">
                        {group.votingClosed || allRated ? (
                          <Link
                            href={`/group/${group.id}/results`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:opacity-90 transition-colors"
                            title="View results"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Results
                          </Link>
                        ) : (
                          <>
                            {showRate && (
                              <Link
                                href={`/group/${group.id}/rate`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:opacity-90 transition-colors"
                                title="Rate members"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                                Rate({unratedCount})
                              </Link>
                            )}
                            <Link
                              href={`/group/${group.id}/results`}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                                showRate ? 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90'
                              }`}
                              title="View results"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              Results
                            </Link>
                          </>
                        )}
                      </div>
                        );
                      })()}
                      <div className="flex items-center gap-1">
                        {isCreator && !group.votingClosed && (
                          <button
                            onClick={() => handleCloseVoting(group.id!)}
                            disabled={closingGroupId === group.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-gray-500 dark:text-gray-400 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
                            title="Close voting"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {closingGroupId === group.id ? 'Closing…' : 'Close voting'}
                          </button>
                        )}
                        {!isCreator && (
                          <button
                            onClick={() => handleLeaveGroup(group.id!)}
                            disabled={leavingGroupId === group.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-gray-500 dark:text-gray-400 text-xs hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                            title="Leave group"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            {leavingGroupId === group.id ? 'Leaving…' : 'Leave'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {groups.length > 0 && (
          <div className="mt-8 flex gap-2 justify-center">
            <Link 
              href="/create-group"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-[13px] hover:border-amber-400/50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Create group"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create
            </Link>
            <Link 
              href="/join-group"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-[13px] hover:border-amber-400/50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Join with code"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
              Join
            </Link>
          </div>
        )}
      </main>
    </div>
  );
} 