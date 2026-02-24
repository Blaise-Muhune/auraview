'use client';

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { use } from "react";
import { getUserProfile, submitRating, updateUserProfile, UserProfile } from "@/lib/firestore";
import { getScoreLegend } from "@/lib/rating-scale";
import { sendNotification } from "@/lib/notify";
import { Nav } from "@/components/Nav";
import { LeaderboardConsent } from "@/components/LeaderboardConsent";

const PENDING_RATING_KEY = 'aura_pending_direct_rating';

interface PendingDirectRating {
  targetId: string;
  targetDisplayName: string;
  totalPoints: number;
  questionScores?: { [key: string]: number };
}

interface RateUserPageProps {
  params: Promise<{
    id: string;
  }>;
}

const auraQuestions = [
  { id: 'presence_energy', question: 'Room presence', description: 'The energy and attention someone brings when they enter a room.' },
  { id: 'authenticity_self_vibe', question: 'Authenticity', description: 'How genuine and true to themselves they are. Being real rather than putting on a facade.' },
  { id: 'social_pull', question: 'Vibe', description: 'Their social magnetism—how they make people feel drawn to them and at ease in their presence.' },
  { id: 'style_aesthetic', question: 'Style', description: 'Their unique aesthetic and how they express themselves through appearance, taste, and presentation.' },
  { id: 'trustworthy', question: 'Trustworthy', description: 'How reliable and dependable they are. Someone you can count on and confide in.' },
];

const MAX_PER_QUESTION = 2000;

export default function RateUserPage({ params }: RateUserPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaderboardConsent, setShowLeaderboardConsent] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<{ key: string; label: string; id: number } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [profileImageError, setProfileImageError] = useState(false);
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest('[data-tooltip-trigger]') && !target.closest('[data-tooltip-content]')) {
        setOpenTooltipId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setProfileImageError(false);
  }, [targetUser?.id]);

  // Load target user: when signed in use Firestore; when guest use public API
  useEffect(() => {
    if (loading || !id) return;

    const loadTargetUser = async () => {
      try {
        if (user) {
          const userProfile = await getUserProfile(id);
          if (!userProfile) {
            setError('User not found. This user may not have created a profile yet.');
            return;
          }
          setTargetUser(userProfile);
        } else {
          const res = await fetch(`/api/users/${id}/profile-public`);
          if (!res.ok) {
            if (res.status === 404) setError('User not found. This user may not have created a profile yet.');
            else setError('Failed to load user profile. Please try again later.');
            return;
          }
          const data = await res.json() as { id: string; displayName: string; photoURL: string | null };
          setTargetUser({
            id: data.id,
            displayName: data.displayName,
            photoURL: data.photoURL ?? '',
            email: '',
            baseAura: 0,
            totalAura: 0,
            pointsToGive: 0,
            createdAt: {} as UserProfile['createdAt'],
            groupsJoined: [],
          } as UserProfile);
        }
      } catch {
        setError('Failed to load user profile. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTargetUser();
  }, [user, loading, id]);

  // After login: submit any pending rating stored before sign-in
  useEffect(() => {
    if (!user || loading || !id) return;
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem(PENDING_RATING_KEY) : null;
      if (!raw) return;
      const pending = JSON.parse(raw) as PendingDirectRating;
      if (pending.targetId !== id) return;
      sessionStorage.removeItem(PENDING_RATING_KEY);
      // Self-rate check
      if (user.uid === id) {
        setError('You cannot rate yourself.');
        return;
      }
      (async () => {
        setIsSubmitting(true);
        setError(null);
        try {
          await submitRating(
            'direct',
            user,
            pending.targetId,
            pending.targetDisplayName,
            pending.totalPoints,
            undefined,
            undefined,
            pending.questionScores && Object.keys(pending.questionScores).length > 0 ? pending.questionScores : undefined
          );
          const token = await user.getIdToken();
          sendNotification(pending.targetId, 'rating_received', {
            fromUserDisplayName: user.displayName || 'Someone',
            points: String(pending.totalPoints),
            groupName: 'a direct rating',
          }, { token, fromUserId: user.uid });
          setSuccess('Appreciation shared!');
          const profile = await getUserProfile(user.uid);
          const needsConsent = profile?.showOnLeaderboard === undefined || profile?.showOnGroupLeaderboard === undefined;
          if (needsConsent) setShowLeaderboardConsent(true);
          else setTimeout(() => router.push('/leaderboard'), 1500);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to submit rating');
        } finally {
          setIsSubmitting(false);
        }
      })();
    } catch {
      sessionStorage.removeItem(PENDING_RATING_KEY);
    }
    // Run only when user becomes available and we have the same id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, id]);

  const handleQuestionRating = (questionId: string, points: number) => {
    setRatings(prev => ({ ...prev, [questionId]: points }));
  };

  const handleAdd500 = (questionId: string) => {
    const val = ratings[questionId] ?? 0;
    const newVal = Math.min(val + 500, MAX_PER_QUESTION);
    if (newVal !== val) {
      handleQuestionRating(questionId, newVal);
      setFlash({ key: questionId, label: '+500', id: Date.now() });
      setTimeout(() => setFlash(null), 600);
    }
  };

  const handleRemove500 = (questionId: string) => {
    const val = ratings[questionId] ?? 0;
    const newVal = Math.max(val - 500, -MAX_PER_QUESTION);
    if (newVal !== val) {
      handleQuestionRating(questionId, newVal);
      setFlash({ key: questionId, label: '-500', id: Date.now() });
      setTimeout(() => setFlash(null), 600);
    }
  };

  const getTotalGiven = () => {
    return auraQuestions.reduce((sum, q) => sum + (ratings[q.id] ?? 0), 0);
  };

  const handleSubmit = async () => {
    if (!targetUser) return;

    const totalPoints = getTotalGiven();
    const questionScores: { [key: string]: number } = {};
    auraQuestions.forEach((q) => {
      const v = ratings[q.id] ?? 0;
      if (v !== 0) questionScores[q.id] = v;
    });

    // Guest: save rating and redirect to sign-in; after login we submit from sessionStorage
    if (!user) {
      const pending: PendingDirectRating = {
        targetId: targetUser.id,
        targetDisplayName: targetUser.displayName || 'Anonymous User',
        totalPoints,
        questionScores: Object.keys(questionScores).length > 0 ? questionScores : undefined,
      };
      sessionStorage.setItem(PENDING_RATING_KEY, JSON.stringify(pending));
      router.push(`/login?redirect=${encodeURIComponent(`/rate-user/${id}`)}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await submitRating(
        'direct',
        user,
        targetUser.id,
        targetUser.displayName || 'Anonymous User',
        totalPoints,
        undefined,
        undefined,
        Object.keys(questionScores).length > 0 ? questionScores : undefined
      );

      const token = await user.getIdToken();
      sendNotification(targetUser.id, 'rating_received', {
        fromUserDisplayName: user.displayName || 'Someone',
        points: String(totalPoints),
        groupName: 'a direct rating',
      }, { token, fromUserId: user.uid });

      setSuccess('Appreciation shared!');

      const profile = await getUserProfile(user.uid);
      const needsConsent = profile?.showOnLeaderboard === undefined || profile?.showOnGroupLeaderboard === undefined;
      if (needsConsent) {
        setShowLeaderboardConsent(true);
      } else {
        setTimeout(() => router.push('/leaderboard'), 1500);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Rating submission error:', err);
      }
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error || !targetUser) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/leaderboard" />
        <main className="max-w-xl mx-auto px-5 py-10 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">User Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">{error || 'The user you are looking for does not exist.'}</p>
          <Link href="/leaderboard" className="inline-block px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:opacity-90">
            Top auras
          </Link>
        </main>
      </div>
    );
  }

  if (showLeaderboardConsent && success && user) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/leaderboard" />
        <main className="max-w-xl mx-auto px-5 py-10">
          <p className="text-center text-green-600 dark:text-green-400 mb-6">{success}</p>
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <LeaderboardConsent
              displayName={user.displayName || 'Your name'}
              includeGroupLeaderboard
              onSave={async (choice) => {
                if (!user) return;
                setConsentSaving(true);
                try {
                  await updateUserProfile(user.uid, {
                    showOnLeaderboard: choice.show,
                    leaderboardAnonymous: choice.anonymous,
                    showOnGroupLeaderboard: choice.show,
                    groupLeaderboardAnonymous: choice.anonymous,
                  });
                  setShowLeaderboardConsent(false);
                  router.push('/leaderboard');
                } finally {
                  setConsentSaving(false);
                }
              }}
              isLoading={consentSaving}
            />
          </div>
        </main>
      </div>
    );
  }

  if (user && user.uid === targetUser.id) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/leaderboard" />
        <main className="max-w-xl mx-auto px-5 py-10 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Cannot Rate Yourself</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">You cannot rate your own aura. Try rating someone else!</p>
          <Link href="/leaderboard" className="inline-block px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:opacity-90">
            Top auras
          </Link>
        </main>
      </div>
    );
  }

  const totalGiven = getTotalGiven();
  const POINTS_PER_PERSON = 10000;
  const barPosition = Math.max(0, Math.min(100, ((totalGiven + POINTS_PER_PERSON) / (POINTS_PER_PERSON * 2)) * 100));
  const isPositive = totalGiven >= 0;
  const fillWidth = Math.abs(barPosition - 50);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/leaderboard" />

      <main className="max-w-xl mx-auto px-5 py-10">
        <div className="max-w-lg mx-auto relative">
          {/* Dropdown at top */}
          <div className="absolute right-0 top-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="More options"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-10">
                <Link
                  href={`/profile/${id}`}
                  onClick={() => setDropdownOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Profile
                </Link>
              </div>
            )}
          </div>

          {/* Target user avatar + name + total given */}
          <div className="flex flex-col items-center gap-3 pt-8 sm:pt-0">
            {targetUser.photoURL && !profileImageError ? (
              <Image
                src={targetUser.photoURL}
                alt=""
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover shrink-0"
                unoptimized
                onError={() => setProfileImageError(true)}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 text-2xl font-semibold text-gray-600 dark:text-gray-300">
                {(targetUser.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
              {targetUser.displayName || 'User'}
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
            {totalGiven > 0 ? '+' : ''}{totalGiven.toLocaleString()} given (±2,000 per question)
          </p>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-2 relative">
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400 dark:bg-gray-600 -translate-x-px z-10" />
            <div
              className="absolute top-0 h-full transition-all"
              style={{
                width: `${fillWidth}%`,
                left: isPositive ? '50%' : `${barPosition}%`,
                backgroundColor: isPositive ? 'rgb(34 197 94)' : 'rgb(239 68 68)',
                borderRadius: isPositive ? '0 9999px 9999px 0' : '9999px 0 0 9999px'
              }}
            />
          </div>

          {error && <p className="mb-4 text-red-600 dark:text-red-400 text-sm text-center">{error}</p>}
          {success && <p className="mb-4 text-green-600 dark:text-green-400 text-sm text-center">{success}</p>}

          {/* 5 rating categories */}
          <div className="space-y-4">
            {auraQuestions.map((q) => {
              const val = ratings[q.id] ?? 0;
              const legend = getScoreLegend(val);
              return (
                <div key={q.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 py-3 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                  <div className="relative flex-shrink-0 sm:w-28 text-center sm:text-left flex items-center justify-center sm:justify-start gap-1" data-tooltip-trigger>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{q.question}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenTooltipId(openTooltipId === q.id ? null : q.id); }}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium"
                      aria-label={`What does ${q.question} mean?`}
                    >
                      i
                    </button>
                    {openTooltipId === q.id && (
                      <div className="absolute left-0 sm:left-0 top-full mt-2 z-20 p-3 rounded-lg bg-gray-900 dark:bg-gray-800 text-gray-100 text-sm shadow-lg border border-gray-700 w-[calc(100vw-2rem)] sm:w-64 max-w-[280px]" data-tooltip-content>
                        {q.description}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center justify-center gap-2 relative">
                      <button
                        type="button"
                        onClick={() => handleRemove500(q.id)}
                        disabled={val <= -MAX_PER_QUESTION}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        −500
                      </button>
                      <span className={`min-w-[4rem] text-center text-sm font-semibold ${val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {val > 0 ? '+' : ''}{val}
                      </span>
                      {flash?.key === q.id && (
                        <span
                          key={flash.id}
                          className={`absolute left-1/2 -translate-x-1/2 -top-1 text-sm font-bold animate-[fadeUpOut_0.6s_ease-out_forwards] pointer-events-none ${
                            flash.label.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {flash.label}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAdd500(q.id)}
                        disabled={val >= MAX_PER_QUESTION}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        +500
                      </button>
                    </div>
                    <p className={`text-[11px] font-medium ${val < 0 ? 'text-rose-500 dark:text-rose-400' : val > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {legend}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit */}
          <div className="flex flex-col items-center gap-2 mt-8">
            {totalGiven === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You&apos;re submitting neutral (0) on all categories.
              </p>
            )}
            {!user && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You&apos;ll sign in with Google to submit your rating.
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="py-3 px-8 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-100 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : user ? (
                'Submit'
              ) : (
                'Sign in & submit'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
