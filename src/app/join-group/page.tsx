'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { getGroupByCode, joinGroup, GroupSession } from "@/lib/firestore";
import { sendNotification } from "@/lib/notify";

type Step = 'enter_code' | 'pick_name' | 'enter_name' | 'joining';

function JoinGroupContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('enter_code');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState('');
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const fetchedForCode = useRef<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setGroupCode(codeFromUrl.toUpperCase());
      localStorage.setItem('pendingGroupCode', codeFromUrl.toUpperCase());
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

  const fetchAndAdvance = useCallback(async () => {
    if (!user || !groupCode?.trim()) return;
    const code = groupCode.trim().toUpperCase();
    if (fetchedForCode.current === code) return;
    fetchedForCode.current = code;
    setError(null);
    const g = await getGroupByCode(code);
    if (!g) {
      setError('Group not found. Please check the code.');
      fetchedForCode.current = null;
      return;
    }
    if (!g.isActive) {
      setError('This group session is no longer active.');
      fetchedForCode.current = null;
      return;
    }
    const max = g.maxParticipants ?? 50;
    const isMember = g.participants.includes(user.uid);
    if (isMember) {
      localStorage.removeItem('pendingGroupCode');
      router.push('/my-groups');
      return;
    }
    if (g.participants.length >= max) {
      router.push('/dashboard');
      return;
    }
    setGroup(g);
    if (g.slots && g.slots.length > 0) {
      const available = g.slots.findIndex((s) => !s.userId);
      if (available >= 0) {
        setSelectedSlotIndex(available);
        setDisplayName(g.slots[available]?.label ?? '');
      }
      setStep('pick_name');
    } else {
      setDisplayName(user.displayName || '');
      setStep('enter_name');
    }
  }, [user, groupCode, router]);

  // When user has code from URL and is ready, fetch and show pick/enter name (don't auto-join)
  useEffect(() => {
    if (!user || loading || profileLoading || !groupCode?.trim() || step !== 'enter_code') return;
    fetchAndAdvance();
  }, [user, loading, profileLoading, groupCode, step, fetchAndAdvance]);

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupCode.trim()) return;
    await fetchAndAdvance();
  };

  const handleJoinWithSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !group || selectedSlotIndex == null) return;
    const name = (displayName || group.slots?.[selectedSlotIndex]?.label || user.displayName || 'Someone').trim();
    setIsJoining(true);
    setError(null);
    try {
      await joinGroup(group.id!, user, { slotIndex: selectedSlotIndex, displayName: name || undefined });
      if (group.createdBy) {
        const token = await user.getIdToken();
        sendNotification(group.createdBy, 'group_join', {
          joinerName: name || 'Someone',
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
  };

  const handleJoinWithoutSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !group) return;
    setIsJoining(true);
    setError(null);
    try {
      await joinGroup(group.id!, user, { displayName: displayName.trim() || undefined });
      if (group.createdBy) {
        const token = await user.getIdToken();
        sendNotification(group.createdBy, 'group_join', {
          joinerName: displayName.trim() || user.displayName || 'Someone',
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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setGroupCode(value);
    if (value.trim()) localStorage.setItem('pendingGroupCode', value);
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/dashboard" />

      <main className="max-w-xl mx-auto px-5 py-10">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Join group</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {step === 'enter_code' && 'Enter the 6-character code'}
            {step === 'pick_name' && 'Pick your name (you can edit it)'}
            {step === 'enter_name' && 'Your name for this group'}
          </p>
        </header>

        <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          {error && (
            <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>
          )}
          {success && (
            <p className="mb-4 text-green-600 dark:text-green-400 text-sm">{success}</p>
          )}

          {step === 'enter_code' && (
            <form onSubmit={handleSubmitCode} className="space-y-4">
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
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Enter the 6-character code shared with you
                </p>
              </div>
              <button
                type="submit"
                disabled={!groupCode.trim()}
                className="w-full px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 disabled:opacity-50 text-[13px]"
              >
                Continue
              </button>
            </form>
          )}

          {step === 'pick_name' && group?.slots && (
            <form onSubmit={handleJoinWithSlot} className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Join as: <strong className="text-gray-900 dark:text-gray-100">{group.name}</strong>
              </p>
              <div>
                <label className="block text-gray-900 dark:text-gray-100 font-medium mb-2 text-sm">
                  Pick your name
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {group.slots.map((slot, i) => {
                    const taken = !!slot.userId;
                    const selected = selectedSlotIndex === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (!taken) {
                            setSelectedSlotIndex(i);
                            setDisplayName(slot.label);
                          }
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                          taken
                            ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-gray-400 cursor-not-allowed'
                            : selected
                              ? 'border-amber-500 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-gray-900 dark:text-gray-100'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {taken ? `${slot.displayName ?? slot.label} (taken)` : slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedSlotIndex != null && !group.slots[selectedSlotIndex]?.userId && (
                <div>
                  <label htmlFor="displayName" className="block text-gray-900 dark:text-gray-100 font-medium mb-2 text-sm">
                    You can edit your name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
                    placeholder="Your name"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={isJoining || selectedSlotIndex == null}
                className="w-full px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 disabled:opacity-50 text-[13px]"
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white dark:border-gray-900 border-t-transparent rounded-full animate-spin" />
                    Joining...
                  </span>
                ) : (
                  'Join group'
                )}
              </button>
            </form>
          )}

          {step === 'enter_name' && group && (
            <form onSubmit={handleJoinWithoutSlot} className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Join: <strong className="text-gray-900 dark:text-gray-100">{group.name}</strong>
              </p>
              <div>
                <label htmlFor="displayName" className="block text-gray-900 dark:text-gray-100 font-medium mb-2 text-sm">
                  Your name for this group (optional)
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
                  placeholder={user.displayName || 'Your name'}
                />
              </div>
              <button
                type="submit"
                disabled={isJoining}
                className="w-full px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 disabled:opacity-50 text-[13px]"
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white dark:border-gray-900 border-t-transparent rounded-full animate-spin" />
                    Joining...
                  </span>
                ) : (
                  'Join group'
                )}
              </button>
            </form>
          )}

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
