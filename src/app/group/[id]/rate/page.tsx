'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { getGroupById, getGroupRatings, getParticipantIdsRatedByUserInGroup, submitRating, isVotingClosed, GroupSession, getUserProfile } from "@/lib/firestore";

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
  const [ratings, setRatings] = useState<{[key: string]: number}>({});
  // const [reasons, setReasons] = useState<{[key: string]: string}>({});
  const POINTS_PER_PERSON = 10000;
  const [participantNames, setParticipantNames] = useState<{[key: string]: string}>({});

  // One person at a time, all questions visible
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0); // 0 = rating, 1 = review
  const [alreadyRatedIds, setAlreadyRatedIds] = useState<Set<string>>(new Set());

  // 5 core questions - enough to mean something, not a chore
  const auraQuestions = [
    {
      id: 'presence_energy',
      question: 'Presence',
      description: 'Do they fill a room or blend in?',
      positiveLabel: 'Lights up the room',
      negativeLabel: 'Fades into the background'
    },
    {
      id: 'authenticity_self_vibe',
      question: 'Authenticity',
      description: 'Real or trying too hard?',
      positiveLabel: 'Themselves',
      negativeLabel: 'Performing'
    },
    {
      id: 'social_pull',
      question: 'Vibe',
      description: 'Easy to be around?',
      positiveLabel: 'People gravitate',
      negativeLabel: 'Hard to connect'
    },
    {
      id: 'style_aesthetic',
      question: 'Style',
      description: 'Does their look match who they are?',
      positiveLabel: 'Owns it',
      negativeLabel: 'Generic'
    },
    {
      id: 'trustworthy',
      question: 'Trustworthy',
      description: 'Can you rely on them?',
      positiveLabel: 'Has your back',
      negativeLabel: 'Flaky'
    }
  ];

  // Quick-tap values - cohesive palette (darker in dark mode)
  const positivePoints = [
    { label: '+2000', value: 2000, color: 'bg-emerald-50 dark:bg-emerald-950/60 dark:border-emerald-900/60 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50' },
    { label: '+1000', value: 1000, color: 'bg-emerald-50 dark:bg-emerald-950/60 dark:border-emerald-900/60 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50' },
    { label: '+500', value: 500, color: 'bg-emerald-50 dark:bg-emerald-950/60 dark:border-emerald-900/60 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50' },
  ];
  const zeroPoint = { label: '0', value: 0, color: 'bg-gray-50 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/80' };
  const negativePoints = [
    { label: '-2000', value: -2000, color: 'bg-rose-50 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-400 border border-rose-100 dark:border-rose-800/60 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50' },
    { label: '-1000', value: -1000, color: 'bg-rose-50 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-400 border border-rose-100 dark:border-rose-800/60 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50' },
    { label: '-500', value: -500, color: 'bg-rose-50 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-400 border border-rose-100 dark:border-rose-800/60 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50' },
  ];
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user && id) {
      loadGroup();
    }
  }, [user, loading, id, router]);

  useEffect(() => {
    if (group) {
      loadParticipantNames();
    }
  }, [group]);

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
  }, [group, alreadyRatedIds, user?.uid, router]);

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
      console.error('Failed to load group:', err);
      setError('Failed to load group');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParticipantNames = async () => {
    if (!group) return;
    
    const names: {[key: string]: string} = {};
    
    // Load names for all participants
    for (const participantId of group.participants) {
      try {
        const userProfile = await getUserProfile(participantId);
        if (userProfile) {
          names[participantId] = userProfile.displayName;
        } else {
          names[participantId] = 'Anonymous User';
        }
      } catch (err) {
        console.error(`Failed to load profile for ${participantId}:`, err);
        names[participantId] = 'Anonymous User';
      }
    }
    
    setParticipantNames(names);
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
          
          return submitRating(
            group.id,
            user,
            participantId,
            participantName,
            points,
            // reasons[participantId] || undefined
          );
        }
        return Promise.resolve();
      });
      
      await Promise.all(ratingPromises);
      setSuccess('Appreciation shared!');
      
      // Redirect to group page after a short delay
      setTimeout(() => {
        if (group.id) {
          router.push(`/group/${group.id}/results`);
        }
      }, 1500);
      
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
        <main className="max-w-md mx-auto px-4 py-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Group Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">{error || 'The group you are looking for does not exist.'}</p>
          <Link href="/dashboard" className="inline-block px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-md hover:opacity-90">
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  const uniqueVoters = new Set(groupRatings.map((r: { fromUserId: string }) => r.fromUserId)).size;
  const votingClosed = isVotingClosed(group, uniqueVoters);
  const participants = group.participants.filter(pid => pid !== user.uid);

  if (votingClosed) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/my-groups" />
        <main className="max-w-md mx-auto px-4 py-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Voting is closed</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            This group&apos;s voting period has ended. Check out the results and share your ranking card.
          </p>
          <Link
            href={`/group/${group.id}/results`}
            className="inline-block px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-md hover:opacity-90"
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

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-900 dark:text-gray-100 mb-4">
            <h1 className="text-xl font-bold">Share what you appreciate</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">10,000 points per person</p>
          </div>

          {error && (
            <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>
          )}

          {success && (
            <p className="mb-4 text-green-600 dark:text-green-400 text-sm">{success}</p>
          )}

          <div className="border border-gray-200 dark:border-gray-800/60 dark:bg-gray-900/30 rounded-md p-4 mb-6">
            
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
                // Map -10000..+10000 to 0%..100% (50% = neutral)
                const barPosition = Math.max(0, Math.min(100, ((totalGiven + POINTS_PER_PERSON) / (POINTS_PER_PERSON * 2)) * 100));
                const isPositive = totalGiven >= 0;
                const fillWidth = Math.abs(barPosition - 50);
                
                const isParticipantRated = (pid: string) => alreadyRatedIds.has(pid) || getParticipantTotalRating(pid) !== 0;
                return (
                  <div className="max-w-lg mx-auto">
                    {/* Participant nav - dots for each person, rated = filled color */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {participants.map((pid, idx) => {
                        const name = pid === group.createdBy ? group.createdByDisplayName : participantNames[pid] || '...';
                        const rated = isParticipantRated(pid);
                        const isCurrent = idx === currentParticipantIndex;
                        return (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => setCurrentParticipantIndex(idx)}
                            className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isCurrent
                                ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-950'
                                : rated
                                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                            title={name}
                          >
                            {name.split(' ')[0].slice(0, 8)}
                          </button>
                        );
                      })}
                    </div>
                    {/* Who we're rating + total given */}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 text-center">{participantName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                      {totalGiven > 0 ? '+' : ''}{totalGiven.toLocaleString()} given
                    </p>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-6 relative">
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
                    
                    {/* All 5 questions - compact rows with quick-tap */}
                    <div className="space-y-4">
                      {auraQuestions.map((q) => {
                        const key = `${currentParticipant}_${q.id}`;
                        const val = ratings[key] ?? 0;
                        return (
                          <div key={q.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                            <div className="flex-shrink-0 sm:w-28">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{q.question}</span>
                            </div>
                            <div className="flex items-stretch gap-2">
                              <button
                                type="button"
                                onClick={() => handleQuestionRating(currentParticipant, q.id, zeroPoint.value)}
                                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center self-center ${
                                  val === zeroPoint.value ? 'ring-2 ring-blue-500 dark:ring-blue-600 dark:ring-offset-gray-950 ring-offset-1 ' + zeroPoint.color : zeroPoint.color + ' opacity-80 hover:opacity-100'
                                }`}
                              >
                                {zeroPoint.label}
                              </button>
                              <div className="flex flex-col gap-2">
                                <div className="flex gap-1.5 flex-wrap">
                                  {positivePoints.map((p) => (
                                    <button
                                      key={p.value}
                                      type="button"
                                      onClick={() => handleQuestionRating(currentParticipant, q.id, p.value)}
                                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                                        val === p.value ? 'ring-2 ring-blue-500 dark:ring-blue-600 dark:ring-offset-gray-950 ring-offset-1 ' + p.color : p.color + ' opacity-80 hover:opacity-100'
                                      }`}
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-1.5 flex-wrap">
                                  {negativePoints.map((p) => (
                                    <button
                                      key={p.value}
                                      type="button"
                                      onClick={() => handleQuestionRating(currentParticipant, q.id, p.value)}
                                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                                        val === p.value ? 'ring-2 ring-blue-500 dark:ring-blue-600 dark:ring-offset-gray-950 ring-offset-1 ' + p.color : p.color + ' opacity-80 hover:opacity-100'
                                      }`}
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
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
                        className="flex-1 py-3 px-4 rounded-md bg-gray-100 dark:bg-gray-800/80 dark:border dark:border-gray-700/50 text-gray-700 dark:text-gray-400 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handleSkipPerson}
                        className="py-3 px-4 rounded-md bg-gray-100 dark:bg-gray-800/80 dark:border dark:border-gray-700/50 text-gray-600 dark:text-gray-500 font-medium hover:bg-gray-200 dark:hover:bg-gray-700/80"
                      >
                        Skip
                      </button>
                      <button
                        onClick={handleNextPerson}
                        className="flex-1 py-3 px-4 rounded-md bg-gray-900 dark:bg-gray-600 dark:border dark:border-gray-500/50 text-white dark:text-gray-100 font-semibold hover:opacity-90 dark:hover:bg-gray-500"
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
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setCurrentStep(0)}
                className="py-3 px-6 rounded-md bg-gray-100 dark:bg-gray-800/80 dark:border dark:border-gray-700/50 text-gray-700 dark:text-gray-400 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700/80"
              >
                ← Edit
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || participants.length === 0}
                className="py-3 px-8 rounded-md bg-gray-900 dark:bg-gray-600 dark:border dark:border-gray-500/50 text-white dark:text-gray-100 font-semibold hover:opacity-90 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          )}
        </div>
      </main>
    </div>
  );
} 