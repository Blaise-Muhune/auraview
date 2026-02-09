'use client';

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { use } from "react";
import { getGroupById, getGroupRatings, getParticipantIdsRatedByUserInGroup, submitRating, isVotingClosed, GroupSession, getUserProfile, updateUserProfile } from "@/lib/firestore";
import { getScoreLegend } from "@/lib/rating-scale";
import { sendNotification } from "@/lib/notify";
import { LeaderboardConsent } from "@/components/LeaderboardConsent";

interface RatePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function RatePage({ params }: RatePageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [groupRatings, setGroupRatings] = useState<Array<{ fromUserId: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaderboardConsent, setShowLeaderboardConsent] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [ratings, setRatings] = useState<{[key: string]: number}>({});
  // const [reasons, setReasons] = useState<{[key: string]: string}>({});
  const POINTS_PER_PERSON = 10000;
  const [participantNames, setParticipantNames] = useState<{[key: string]: string}>({});
  const [participantPhotos, setParticipantPhotos] = useState<{[key: string]: string}>({});
  const [profileImageErrors, setProfileImageErrors] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // One person at a time, all questions visible
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0); // 0 = rating, 1 = review
  const [alreadyRatedIds, setAlreadyRatedIds] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<{ key: string; label: string; id: number } | null>(null);
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);

  // 5 core questions - enough to mean something, not a chore (descriptions match rate-user page)
  const auraQuestions = [
    {
      id: 'presence_energy',
      question: 'Room presence',
      description: 'The energy and attention someone brings when they enter a room. How present and engaged they feel.',
      positiveLabel: 'Lights up the room',
      negativeLabel: 'Fades into the background'
    },
    {
      id: 'authenticity_self_vibe',
      question: 'Authenticity',
      description: 'How genuine and true to themselves they are. Being real rather than putting on a facade.',
      positiveLabel: 'Themselves',
      negativeLabel: 'Performing'
    },
    {
      id: 'social_pull',
      question: 'Vibe',
      description: 'Their social magnetism—how they make people feel drawn to them and at ease in their presence.',
      positiveLabel: 'People gravitate',
      negativeLabel: 'Hard to connect'
    },
    {
      id: 'style_aesthetic',
      question: 'Style',
      description: 'Their unique aesthetic and how they express themselves through appearance, taste, and presentation.',
      positiveLabel: 'Owns it',
      negativeLabel: 'Generic'
    },
    {
      id: 'trustworthy',
      question: 'Trustworthy',
      description: 'How reliable and dependable they are. Someone you can count on and confide in.',
      positiveLabel: 'Has your back',
      negativeLabel: 'Flaky'
    }
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user && id) {
      loadGroup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadGroup runs on auth/group change
  }, [user, loading, id, router]);

  useEffect(() => {
    if (group) {
      loadParticipantNames();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadParticipantNames runs when group loads
  }, [group]);

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

  // Set initial participant index to first unrated when data loads; redirect to results if all rated
  useEffect(() => {
    if (!group || !user) return;
    const participantsToRate = group.participants.filter((p) => p !== user.uid);
    const firstUnratedIdx = participantsToRate.findIndex((p) => !alreadyRatedIds.has(p));
    if (firstUnratedIdx >= 0) {
      setCurrentParticipantIndex(firstUnratedIdx);
    } else if (participantsToRate.length > 0) {
      router.replace(`/group/${group.id}/results`);
    } else {
      setCurrentParticipantIndex(0);
    }
  }, [group, alreadyRatedIds, user, router]);

  const loadGroup = async () => {
    if (!user) return;
    try {
      const [groupData, ratingsData, ratedIds] = await Promise.all([
        getGroupById(id),
        getGroupRatings(id),
        getParticipantIdsRatedByUserInGroup(id, user.uid),
      ]);
      if (!groupData) {
        setError('Group not found');
        return;
      }
      setGroup(groupData);
      setGroupRatings(ratingsData);
      setAlreadyRatedIds(new Set(ratedIds));
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load group:', err);
      }
      setError('Failed to load group');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParticipantNames = async () => {
    if (!group) return;

    const names: {[key: string]: string} = {};
    const photos: {[key: string]: string} = {};

    for (const participantId of group.participants) {
      try {
        const userProfile = await getUserProfile(participantId);
        if (userProfile) {
          names[participantId] = userProfile.displayName;
          if (userProfile.photoURL) photos[participantId] = userProfile.photoURL;
        } else {
          names[participantId] = 'Anonymous User';
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to load profile:', err);
        }
        names[participantId] = 'Anonymous User';
      }
    }

    setParticipantNames(names);
    setParticipantPhotos(photos);
  };

  // const handleRatingChange = (participantId: string, points: number) => {
  //   // Allow negative points (no minimum limit)
  //   if (points > remainingGlobalPoints) points = remainingGlobalPoints;
    
  //   setRatings(prev => ({
  //     ...prev,
  //     [participantId]: points
  //   }));
  // };

  // const handleReasonChange = (participantId: string, reason: string) => {
  //   setReasons(prev => ({
  //     ...prev,
  //     [participantId]: reason
  //   }));
  // };

  const handleQuestionRating = (participantId: string, questionId: string, points: number) => {
    const questionKey = `${participantId}_${questionId}`;
    setRatings(prev => ({
      ...prev,
      [questionKey]: points
    }));
  };

  const MAX_PER_QUESTION = 2000;

  const handleAdd500 = (participantId: string, questionId: string) => {
    const key = `${participantId}_${questionId}`;
    const val = ratings[key] ?? 0;
    const newVal = Math.min(val + 500, MAX_PER_QUESTION);
    if (newVal !== val) {
      handleQuestionRating(participantId, questionId, newVal);
      setFlash({ key, label: '+500', id: Date.now() });
      setTimeout(() => setFlash(null), 600);
    }
  };

  const handleRemove500 = (participantId: string, questionId: string) => {
    const key = `${participantId}_${questionId}`;
    const val = ratings[key] ?? 0;
    const newVal = Math.max(val - 500, -MAX_PER_QUESTION);
    if (newVal !== val) {
      handleQuestionRating(participantId, questionId, newVal);
      setFlash({ key, label: '-500', id: Date.now() });
      setTimeout(() => setFlash(null), 600);
    }
  };

  const getCurrentParticipant = () => {
    return participants[currentParticipantIndex];
  };

  const getNextUnratedIndex = () => {
    const isRated = (pid: string) => alreadyRatedIds.has(pid) || getParticipantTotalRating(pid) !== 0;
    for (let i = currentParticipantIndex + 1; i < participants.length; i++) {
      if (!isRated(participants[i])) return i;
    }
    return -1;
  };

  const handleNextPerson = () => {
    const nextUnrated = getNextUnratedIndex();
    if (nextUnrated >= 0) {
      setCurrentParticipantIndex(nextUnrated);
    } else {
      setCurrentStep(1);
    }
  };

  const handlePrevPerson = () => {
    if (currentParticipantIndex > 0) {
      setCurrentParticipantIndex(currentParticipantIndex - 1);
    }
  };

  const handleSkipPerson = () => {
    handleNextPerson();
  };

  const getParticipantTotalRating = (participantId: string) => {
    return auraQuestions.reduce((total, question) => {
      const questionKey = `${participantId}_${question.id}`;
      return total + (ratings[questionKey] || 0);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!user || !group) return;

    setIsSubmitting(true);
    
    try {
      // Convert question-based ratings to participant-based ratings
      const participantRatings: {[key: string]: number} = {};
      
      participants.forEach(participantId => {
        const totalRating = getParticipantTotalRating(participantId);
        participantRatings[participantId] = totalRating;
      });
      
      // Submit ratings for each participant
      const ratingPromises = Object.entries(participantRatings).map(([participantId, points]) => {
        if (points !== 0 && group.id) {
          const participantName = participantId === group.createdBy 
            ? group.createdByDisplayName 
            : participantNames[participantId] || 'Anonymous User';
          const questionScores: { [key: string]: number } = {};
          auraQuestions.forEach((q) => {
            const v = ratings[`${participantId}_${q.id}`] ?? 0;
            if (v !== 0) questionScores[q.id] = v;
          });
          return submitRating(
            group.id,
            user,
            participantId,
            participantName,
            points,
            undefined,
            undefined,
            Object.keys(questionScores).length > 0 ? questionScores : undefined
          );
        }
        return Promise.resolve();
      });
      
      await Promise.all(ratingPromises);
      // Notify recipients (non-blocking)
      const fromName = user.displayName || 'Someone';
      const token = await user.getIdToken();
      Object.entries(participantRatings).forEach(([participantId, points]) => {
        if (points !== 0 && participantId !== user.uid) {
          sendNotification(participantId, 'rating_received', {
            fromUserDisplayName: fromName,
            points: String(points),
            groupName: group.name,
          }, { token, fromUserId: user.uid });
        }
      });
      setSuccess('Appreciation shared!');
      
      const profile = await getUserProfile(user.uid);
      const needsConsent = profile?.showOnLeaderboard === undefined || profile?.showOnGroupLeaderboard === undefined;
      if (needsConsent) {
        setShowLeaderboardConsent(true);
      } else {
        setTimeout(() => {
          if (group.id) router.push(`/group/${group.id}/results`);
        }, 1500);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ratings');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading group...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/dashboard" />
        <main className="max-w-xl mx-auto px-5 py-10 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Group Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">{error || 'The group you are looking for does not exist.'}</p>
          <Link href="/dashboard" className="inline-block px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90">
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  if (showLeaderboardConsent && success) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/my-groups" />
        <main className="max-w-xl mx-auto px-5 py-10">
          <p className="text-center text-green-600 dark:text-green-400 mb-6">{success}</p>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <LeaderboardConsent
              displayName={user.displayName || 'Your name'}
              includeGroupLeaderboard
              onSave={async (global, groupChoice) => {
                if (!user) return;
                setConsentSaving(true);
                try {
                  await updateUserProfile(user.uid, {
                    showOnLeaderboard: global.show,
                    leaderboardAnonymous: global.anonymous,
                    ...(groupChoice && {
                      showOnGroupLeaderboard: groupChoice.show,
                      groupLeaderboardAnonymous: groupChoice.anonymous,
                    }),
                  });
                  setShowLeaderboardConsent(false);
                  router.push(`/group/${group.id}/results`);
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

  const uniqueVoters = new Set(groupRatings.map((r: { fromUserId: string }) => r.fromUserId)).size;
  const votingClosed = isVotingClosed(group, uniqueVoters);
  const participants = group.participants.filter(pid => pid !== user.uid);

  if (votingClosed) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/my-groups" />
        <main className="max-w-xl mx-auto px-5 py-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Voting is closed</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            This group&apos;s voting period has ended. Check out the results and share your ranking card.
          </p>
          <Link
            href={`/group/${group.id}/results`}
            className="inline-block px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90"
          >
            See results
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/my-groups" />

      <main className="max-w-xl mx-auto px-5 py-6">
        <div className="max-w-4xl mx-auto relative">
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
                  href={currentStep === 0 && participants[currentParticipantIndex] ? `/profile/${participants[currentParticipantIndex]}` : `/group/${group.id}/results`}
                  onClick={() => setDropdownOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {currentStep === 0 ? 'Profile' : 'Results'}
                </Link>
              </div>
            )}
          </div>
          <div className="text-center text-gray-900 dark:text-gray-100 mb-3">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">Share what you appreciate</h1>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">10,000 pts per person</p>
          </div>

          {error && (
            <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>
          )}

          {success && (
            <p className="mb-4 text-green-600 dark:text-green-400 text-sm">{success}</p>
          )}

          <div className="border border-gray-200 dark:border-gray-800/60 dark:bg-gray-900/30 rounded-xl p-4 mb-4">
            
            {participants.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-sm sm:text-base">No other members to rate yet.</p>
                <p className="text-xs sm:text-sm mt-2">Share the group code to invite friends!</p>
              </div>
            ) : currentStep === 0 ? (
              // One person, all 5 questions - tap to vote fast
              (() => {
                const currentParticipant = getCurrentParticipant();
                if (!currentParticipant) return null;
                
                const participantName = currentParticipant === group.createdBy 
                  ? group.createdByDisplayName 
                  : participantNames[currentParticipant] || '...';
                
                const totalGiven = auraQuestions.reduce((sum, q) => {
                  const key = `${currentParticipant}_${q.id}`;
                  return sum + (ratings[key] ?? 0);
                }, 0);

                const isParticipantRated = (pid: string) => alreadyRatedIds.has(pid) || getParticipantTotalRating(pid) !== 0;
                // Progress ring: -10000..+10000 maps to 0..100% of circumference
                const circum = 2 * Math.PI * 18;
                const progRatio = (totalGiven + POINTS_PER_PERSON) / (POINTS_PER_PERSON * 2);
                const strokeDash = circum * Math.max(0, Math.min(1, progRatio));
                const progressColor = totalGiven >= 0 ? 'rgb(34 197 94)' : 'rgb(239 68 68)';

                return (
                  <div className="max-w-lg mx-auto">
                    {/* Participant nav - avatars with progress ring on radius */}
                    <div className="flex flex-wrap justify-center items-center gap-2 mb-3">
                      {participants.map((pid, idx) => {
                        const name = pid === group.createdBy ? group.createdByDisplayName : participantNames[pid] || '...';
                        const rated = isParticipantRated(pid);
                        const isCurrent = idx === currentParticipantIndex;
                        const pidTotal = getParticipantTotalRating(pid);
                        const pidCircum = isCurrent ? circum : 2 * Math.PI * 14;
                        const pidProgRatio = (pidTotal + POINTS_PER_PERSON) / (POINTS_PER_PERSON * 2);
                        const pidStrokeDash = pidCircum * Math.max(0, Math.min(1, pidProgRatio));
                        const pidColor = pidTotal >= 0 ? 'rgb(34 197 94)' : 'rgb(239 68 68)';

                        return (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => setCurrentParticipantIndex(idx)}
                            className={`rounded-full shrink-0 transition-all focus:outline-none ${
                              isCurrent ? 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-gray-950' : ''
                            }`}
                            title={name}
                            aria-label={name}
                          >
                            <div className={`relative flex items-center justify-center ${isCurrent ? 'w-11 h-11' : 'w-9 h-9'}`}>
                              {/* Progress ring around avatar */}
                              {isCurrent ? (
                                <svg className="absolute inset-0 w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                                  <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
                                  <circle cx="22" cy="22" r="18" fill="none" stroke={progressColor} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${strokeDash} ${circum}`} className="transition-all duration-300" />
                                </svg>
                              ) : pidTotal !== 0 ? (
                                <svg className="absolute inset-0 w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                                  <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-200 dark:text-gray-700" />
                                  <circle cx="18" cy="18" r="14" fill="none" stroke={pidColor} strokeWidth="2" strokeLinecap="round" strokeDasharray={`${pidStrokeDash} ${pidCircum}`} className="transition-all" />
                                </svg>
                              ) : null}
                              {participantPhotos[pid] && !profileImageErrors.has(pid) ? (
                                <Image
                                  src={participantPhotos[pid]}
                                  alt=""
                                  width={isCurrent ? 40 : 32}
                                  height={isCurrent ? 40 : 32}
                                  className={`rounded-full object-cover relative z-10 ${isCurrent ? 'w-10 h-10' : 'w-8 h-8'}`}
                                  unoptimized
                                  onError={() => setProfileImageErrors((prev) => new Set(prev).add(pid))}
                                />
                              ) : (
                                <div className={`rounded-full flex items-center justify-center relative z-10 ${
                                  isCurrent ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
                                } font-semibold ${
                                  isCurrent ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                    : rated ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                }`}>
                                  {(name || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Name + points */}
                    <div className="text-center mb-3">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{participantName}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {totalGiven > 0 ? '+' : ''}{totalGiven.toLocaleString()} given (±2,000 per question)
                      </p>
                    </div>

                    {/* All 5 questions - +500 / -500 per section */}
                    <div className="space-y-4">
                      {auraQuestions.map((q) => {
                        const key = `${currentParticipant}_${q.id}`;
                        const val = ratings[key] ?? 0;
                        const legend = getScoreLegend(val);
                        return (
                          <div key={q.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 py-3 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                            <div className="relative flex-shrink-0 sm:w-28 text-center sm:text-left flex items-center justify-center sm:justify-start gap-1" data-tooltip-trigger>
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{q.question}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setOpenTooltipId(openTooltipId === key ? null : key); }}
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium"
                                aria-label={`What does ${q.question} mean?`}
                              >
                                i
                              </button>
                              {openTooltipId === key && (
                                <div className="absolute left-0 sm:left-0 top-full mt-2 z-20 p-3 rounded-lg bg-gray-900 dark:bg-gray-800 text-gray-100 text-sm shadow-lg border border-gray-700 w-[calc(100vw-2rem)] sm:w-64 max-w-[280px]" data-tooltip-content>
                                  {q.description}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center justify-center gap-2 relative">
                                <button
                                  type="button"
                                  onClick={() => handleRemove500(currentParticipant, q.id)}
                                  disabled={val <= -MAX_PER_QUESTION}
                                  className="px-3 py-2 text-sm font-medium rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  −500
                                </button>
                                <span className={`min-w-[4rem] text-center text-sm font-semibold ${val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {val > 0 ? '+' : ''}{val}
                                </span>
                                {flash?.key === key && (
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
                                  onClick={() => handleAdd500(currentParticipant, q.id)}
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
                    
                    {/* Nav - big tap targets */}
                    <div className="flex gap-3 mt-8">
                      <button
                        onClick={handlePrevPerson}
                        disabled={currentParticipantIndex === 0}
                        className="flex-1 py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-800/80 dark:border dark:border-gray-700/50 text-gray-700 dark:text-gray-400 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handleSkipPerson}
                        className="py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-800/80 dark:border dark:border-gray-700/50 text-gray-600 dark:text-gray-500 font-medium hover:bg-gray-200 dark:hover:bg-gray-700/80"
                      >
                        Skip
                      </button>
                      <button
                        onClick={handleNextPerson}
                        className="flex-1 py-3 px-4 rounded-xl bg-gray-900 dark:bg-gray-600 dark:border dark:border-gray-500/50 text-white dark:text-gray-100 font-semibold hover:opacity-90 dark:hover:bg-gray-500"
                      >
                        {getNextUnratedIndex() === -1 ? 'Done →' : 'Next →'}
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              // Quick review + submit
              <div className="max-w-md mx-auto">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Ready to submit</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Summary of what you shared</p>
                </div>
                <div className="space-y-2 mb-6">
                  {participants.map((participantId) => {
                    const name = participantId === group.createdBy 
                      ? group.createdByDisplayName 
                      : participantNames[participantId] || '...';
                    const total = getParticipantTotalRating(participantId);
                    return (
                      <div key={participantId} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700/60">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
                        <span className={`font-semibold ${total >= 0 ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}`}>
                          {total > 0 ? '+' : ''}{total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          {currentStep === 1 && (
            <div className="flex flex-col items-center gap-3">
              {!participants.some((pid) => getParticipantTotalRating(pid) !== 0) && participants.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You&apos;re submitting neutral (0) on all categories.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setCurrentStep(0)}
                  className="py-3 px-6 rounded-xl bg-gray-100 dark:bg-gray-800/80 dark:border dark:border-gray-700/50 text-gray-700 dark:text-gray-400 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700/80"
                >
                  ← Edit
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || participants.length === 0}
                  className="py-3 px-8 rounded-xl bg-gray-900 dark:bg-gray-600 dark:border dark:border-gray-500/50 text-white dark:text-gray-100 font-semibold hover:opacity-90 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-100 border-t-transparent dark:border-gray-500 dark:border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </div>
          )}
        </div>
      </main>
    </div>
  );
} 