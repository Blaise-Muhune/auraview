'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getUserGroups, leaveGroup, closeGroupVoting, getParticipantIdsRatedByUserInGroup, GroupSession, getSlotId } from "@/lib/firestore";
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
  const [sharedGroupId, setSharedGroupId] = useState<string | null>(null);
  const [unratedCountByGroupId, setUnratedCountByGroupId] = useState<Record<string, number>>({});
  const [resultsLinkModal, setResultsLinkModal] = useState<{ groupId: string; groupName: string } | null>(null);
  const [resultsLinkCopied, setResultsLinkCopied] = useState(false);

  const loadUserGroups = useCallback(async () => {
    try {
      const testQuery = query(collection(db, 'groups'), limit(1));
      await getDocs(testQuery);
      const userGroups = await getUserGroups(user!.uid);
      setGroups(userGroups);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading user groups:', error);
      }
      setError('Failed to load your groups');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/leaderboard');
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
          const participantsToRate =
            g.slots && g.slots.length > 0
              ? g.slots
                  .map((s, i) => (s.userId ? s.userId : getSlotId(g.id!, i)))
                  .filter((_, i) => g.slots![i]?.userId !== user.uid)
              : g.participants.filter((p) => p !== user.uid);
          const unrated = participantsToRate.filter((id) => !rated.includes(id));
          counts[g.id] = unrated.length;
        })
      );
      setUnratedCountByGroupId((prev) => ({ ...prev, ...counts }));
    };
    fetchUnratedCounts();
  }, [user, groups]);

  const handleCloseVoting = async (group: GroupSession) => {
    const groupId = group.id!;
    setClosingGroupId(groupId);
    try {
      await closeGroupVoting(groupId);
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, votingClosed: true } : g));
      setResultsLinkModal({ groupId, groupName: group.name });
    } catch {
      setError('Failed to close session');
    } finally {
      setClosingGroupId(null);
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
    const message = `We're rating each other on Aura — a quick app to give and get feedback from friends. Join our group "${group.name}" and add your ratings: ${url}`;
    const title = `Join ${group.name} on Aura`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url, text: message });
        setSharedGroupId(group.id!);
        setTimeout(() => setSharedGroupId(null), 2000);
        return;
      } catch {
        // User cancelled or share failed
      }
    }
    // Fallback: copy message with link so they can paste in group chat etc.
    try {
      await navigator.clipboard.writeText(message);
      setSharedGroupId(group.id!);
      setTimeout(() => setSharedGroupId(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = message;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setSharedGroupId(group.id!);
      setTimeout(() => setSharedGroupId(null), 2000);
    }
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
                  
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Header: avatar + name + people — single aligned row */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-semibold text-sm shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{group.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {group.participants.length} {group.participants.length === 1 ? 'person' : 'people'}
                          {isCreator && ' · You'}
                        </p>
                      </div>
                    </div>

                    {group.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{group.description}</p>
                    )}

                    {/* Actions: one row, same alignment — Share + Rate + Results */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => shareGroupLink(group)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors shrink-0"
                        title="Share invite link"
                      >
                        {sharedGroupId === group.id ? (
                          <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        )}
                        Share
                      </button>
                      {(() => {
                        const participantsToRate =
                          group.slots && group.slots.length > 0
                            ? group.slots
                                .map((s, i) => (s.userId ? s.userId : getSlotId(group.id!, i)))
                                .filter((_, i) => group.slots![i]?.userId !== user.uid)
                            : group.participants.filter((p) => p !== user.uid);
                        const unratedCount = unratedCountByGroupId[group.id!] ?? participantsToRate.length;
                        const allRated = participantsToRate.length > 0 && unratedCount === 0;
                        const showRate = !group.votingClosed && !allRated && participantsToRate.length > 0;
                        return (
                          <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-0.5 shrink-0">
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
                    </div>

                    {/* Secondary: Close session / Leave — subtle, aligned */}
                    <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
                      {isCreator && !group.votingClosed && (
                        <button
                          onClick={() => handleCloseVoting(group)}
                          disabled={closingGroupId === group.id}
                          className="inline-flex items-center gap-1.5 px-0 py-1 text-gray-500 dark:text-gray-400 text-xs hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
                          title="Close session"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          {closingGroupId === group.id ? 'Closing…' : 'Close session'}
                        </button>
                      )}
                      {!isCreator && (
                        <button
                          onClick={() => handleLeaveGroup(group.id!)}
                          disabled={leavingGroupId === group.id}
                          className="inline-flex items-center gap-1.5 px-0 py-1 text-gray-500 dark:text-gray-400 text-xs hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
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

      {/* Results link modal after closing session */}
      {resultsLinkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60"
          onClick={() => { setResultsLinkModal(null); setResultsLinkCopied(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-link-modal-title"
        >
          <div
            className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 id="results-link-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Session closed
              </h2>
              <button
                type="button"
                onClick={() => { setResultsLinkModal(null); setResultsLinkCopied(false); }}
                className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Copy the message below and paste it in your group chat so everyone can open the results:
              </p>
              {(() => {
                const url = typeof window !== 'undefined' ? `${window.location.origin}/group/${resultsLinkModal.groupId}/results` : '';
                const message = `We just finished rating each other on Aura! See our group "${resultsLinkModal.groupName}" results here: ${url}`;
                return (
                  <>
                    <textarea
                      readOnly
                      rows={3}
                      value={message}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm resize-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(message);
                          setResultsLinkCopied(true);
                          setTimeout(() => setResultsLinkCopied(false), 2000);
                        } catch {
                          const ta = document.createElement('textarea');
                          ta.value = message;
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                          setResultsLinkCopied(true);
                          setTimeout(() => setResultsLinkCopied(false), 2000);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 transition-colors"
                    >
                      {resultsLinkCopied ? 'Copied!' : 'Copy message'}
                    </button>
                  </>
                );
              })()}
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Paste this message anywhere you share the link (group chat, WhatsApp, etc.).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 