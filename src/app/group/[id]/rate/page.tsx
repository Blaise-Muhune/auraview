'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { getGroupById, submitRating, GroupSession, getUserRemainingPoints, getUserProfile } from "@/lib/firestore";

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ratings, setRatings] = useState<{[key: string]: number}>({});
  // const [reasons, setReasons] = useState<{[key: string]: string}>({});
  const [remainingGlobalPoints, setRemainingGlobalPoints] = useState(10000);
  const [participantNames, setParticipantNames] = useState<{[key: string]: string}>({});

  // Step-by-step rating system
  const [currentStep, setCurrentStep] = useState(0);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Aura rating questions
  const auraQuestions = [
    {
      id: 'presence_energy',
      question: 'Presence & Energy',
      description: 'The natural force they give off when they enter a space—do they command attention or subtly shift the mood?',
      positiveLabel: 'Strong commanding presence',
      negativeLabel: 'Weak or draining presence'
    },
    {
      id: 'authenticity_self_vibe',
      question: 'Authenticity & Self-Vibe',
      description: 'How real and comfortable they are in their own skin—do they stay true to who they are?',
      positiveLabel: 'Very authentic and comfortable',
      negativeLabel: 'Seems inauthentic or uncomfortable'
    },
    {
      id: 'style_aesthetic',
      question: 'Style & Aesthetic',
      description: 'Their personal visual expression—how well their appearance reflects their inner energy or uniqueness.',
      positiveLabel: 'Unique and expressive style',
      negativeLabel: 'Generic or mismatched style'
    },
    {
      id: 'social_pull',
      question: 'Social Pull',
      description: 'How naturally people are drawn to them—do others want to talk to, follow, or be around them effortlessly?',
      positiveLabel: 'Naturally magnetic and attractive',
      negativeLabel: 'Repels or pushes people away'
    },
    {
      id: 'emotional_impact_depth',
      question: 'Emotional Impact & Depth',
      description: 'The lasting feelings they leave behind—do they inspire, calm, or energize others on an emotional level?',
      positiveLabel: 'Deeply inspiring and impactful',
      negativeLabel: 'Emotionally draining or shallow'
    },
    {
      id: 'confidence_composure',
      question: 'Confidence & Composure',
      description: 'Their inner steadiness—do they carry themselves with quiet strength, even under pressure?',
      positiveLabel: 'Steady and confident under pressure',
      negativeLabel: 'Unsteady or easily rattled'
    },
    {
      id: 'voice_communication',
      question: 'Voice & Communication Style',
      description: 'How they speak and express themselves—does their voice, tone, or choice of words amplify their presence?',
      positiveLabel: 'Compelling and clear communicator',
      negativeLabel: 'Weak or unclear communication'
    },
    {
      id: 'mystery_intrigue',
      question: 'Mystery & Intrigue',
      description: 'The sense of fascination they spark—do they leave others curious, interested, or drawn in?',
      positiveLabel: 'Fascinating and intriguing',
      negativeLabel: 'Predictable or boring'
    },
    {
      id: 'intentionality_purpose',
      question: 'Intentionality & Purpose',
      description: 'The clarity in how they move through life—do they seem to act with meaning, not just reaction?',
      positiveLabel: 'Clear purpose and intentional',
      negativeLabel: 'Reactive or aimless'
    },
    {
      id: 'consistency_alignment',
      question: 'Consistency & Alignment',
      description: 'How aligned their actions, values, and image are—does everything about them feel cohesive and genuine?',
      positiveLabel: 'Highly aligned and cohesive',
      negativeLabel: 'Inconsistent or misaligned'
    }
  ];

  // Preset aura point values
  const presetPoints = [
    { label: '+1000', value: 1000, color: 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' },
    { label: '+500', value: 500, color: 'bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200' },
    { label: '+200', value: 200, color: 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200' },
    { label: '+100', value: 100, color: 'bg-cyan-100 border-cyan-300 text-cyan-700 hover:bg-cyan-200' },
    { label: '+50', value: 50, color: 'bg-teal-100 border-teal-300 text-teal-700 hover:bg-teal-200' },
    { label: '0', value: 0, color: 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200' },
    { label: '-50', value: -50, color: 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200' },
    { label: '-100', value: -100, color: 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' },
    { label: '-200', value: -200, color: 'bg-red-200 border-red-400 text-red-800 hover:bg-red-300' },
    { label: '-500', value: -500, color: 'bg-red-300 border-red-500 text-red-900 hover:bg-red-400' },
    { label: '-1000', value: -1000, color: 'bg-red-400 border-red-600 text-red-950 hover:bg-red-500' },
  ];

  // const usedPoints = Object.values(ratings).reduce((sum, points) => sum + points, 0);
  const absolutePointsUsed = Object.values(ratings).reduce((sum, points) => sum + Math.abs(points), 0);
  // const positivePointsUsed = Object.values(ratings).reduce((sum, points) => sum + Math.max(0, points), 0);
  const negativePointsUsed = Object.values(ratings).reduce((sum, points) => sum + Math.min(0, points), 0);
  const remainingPoints = remainingGlobalPoints - absolutePointsUsed;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user && id) {
      loadGroup();
      loadUserPoints();
    }
  }, [user, loading, id, router]);

  useEffect(() => {
    if (group) {
      loadParticipantNames();
    }
  }, [group]);

  const loadGroup = async () => {
    try {
      const groupData = await getGroupById(id);
      if (!groupData) {
        setError('Group not found');
        return;
      }
      setGroup(groupData);
    } catch (err) {
      console.error('Failed to load group:', err);
      setError('Failed to load group');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPoints = async () => {
    if (!user) return;
    try {
      const remaining = await getUserRemainingPoints(user.uid);
      setRemainingGlobalPoints(remaining);
    } catch (err) {
      console.error('Failed to load user points:', err);
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

  const getCurrentQuestion = () => {
    return auraQuestions[currentQuestionIndex];
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < auraQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentParticipantIndex < participants.length - 1) {
      setCurrentQuestionIndex(0);
      setCurrentParticipantIndex(currentParticipantIndex + 1);
    } else {
      setCurrentStep(1); // Move to review step
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentParticipantIndex > 0) {
      setCurrentQuestionIndex(auraQuestions.length - 1);
      setCurrentParticipantIndex(currentParticipantIndex - 1);
    }
  };

  const handleSkipParticipant = () => {
    if (currentParticipantIndex < participants.length - 1) {
      setCurrentQuestionIndex(0);
      setCurrentParticipantIndex(currentParticipantIndex + 1);
    } else {
      setCurrentStep(1); // Move to review step
    }
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
      setSuccess('Ratings submitted successfully!');
      
      // Redirect to group page after a short delay
      setTimeout(() => {
        if (group.id) {
          router.push(`/group/${group.id}`);
        }
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ratings');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-base sm:text-lg">Loading group...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/dashboard" className="text-xl sm:text-2xl font-bold text-gray-900">Aura</Link>
              <div className="flex gap-2 sm:gap-4">
                <Link href="/dashboard" className="px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700 text-sm">
                  Dashboard
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Group Not Found</h2>
              <p className="text-gray-600 mb-6 text-sm sm:text-base">{error || 'The group you are looking for does not exist.'}</p>
              <Link href="/dashboard" className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm text-sm sm:text-base">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  const participants = group.participants.filter(id => id !== user.uid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/group/${group.id}`} className="text-xl sm:text-2xl font-bold text-gray-900">Aura</Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href={`/group/${group.id}`} className="px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700 text-sm">
                Back to Group
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Rating Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-900 mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">Rate Your Friends</h1>
            <p className="text-base sm:text-lg text-gray-600">Distribute your 10,000 aura points among group members</p>
          </div>

          {/* Compact Points Summary - Moved to be less prominent */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-base sm:text-lg font-bold text-blue-600">{remainingGlobalPoints.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Available</div>
                </div>
                <div className="text-center">
                  <div className={`text-base sm:text-lg font-bold ${remainingPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {remainingPoints.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">Remaining</div>
                </div>
                <div className="text-center">
                  <div className={`text-base sm:text-lg font-bold ${absolutePointsUsed >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                    {absolutePointsUsed.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">Used</div>
                </div>
              </div>
              <div className="flex-1 sm:ml-6">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      absolutePointsUsed >= 0 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600' 
                        : 'bg-gradient-to-r from-red-500 to-orange-500'
                    }`}
                    style={{ width: `${Math.min(Math.abs(absolutePointsUsed) / remainingGlobalPoints * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-center">
                  {Math.round((Math.abs(absolutePointsUsed) / remainingGlobalPoints) * 100)}% of points used
                </div>
              </div>
            </div>
            {negativePointsUsed < 0 && (
              <div className="mt-3 text-center text-red-600 text-xs bg-red-50 rounded-lg p-2 border border-red-200">
                ⚠️ Using negative points (reduces aura) - Counts against limit
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
              {success}
            </div>
          )}

          {/* Participants Rating - Main Focus */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8 mb-4 sm:mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">Rate Your Friends</h3>
            
            {participants.length === 0 ? (
              <div className="text-center text-gray-500 py-6 sm:py-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-sm sm:text-base">No other members to rate yet.</p>
                <p className="text-xs sm:text-sm mt-2">Share the group code to invite friends!</p>
              </div>
            ) : currentStep === 0 ? (
              // Step-by-step rating interface
              <div className="max-w-2xl mx-auto">
                {(() => {
                  const currentParticipant = getCurrentParticipant();
                  const currentQuestion = getCurrentQuestion();
                  
                  if (!currentParticipant || !currentQuestion) return null;
                  
                  const participantName = currentParticipant === group.createdBy 
                    ? `${group.createdByDisplayName} (Creator)` 
                    : participantNames[currentParticipant] || 'Loading...';
                  
                  const questionKey = `${currentParticipant}_${currentQuestion.id}`;
                  const currentRating = ratings[questionKey] || 0;
                  
                  return (
                    <div className="text-center">
                      {/* Progress */}
                      <div className="mb-6 sm:mb-8">
                        <div className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                          Rating {currentParticipantIndex + 1} of {participants.length} • 
                          Question {currentQuestionIndex + 1} of {auraQuestions.length}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 sm:h-3 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${((currentParticipantIndex * auraQuestions.length + currentQuestionIndex + 1) / (participants.length * auraQuestions.length)) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Current Participant */}
                      <div className="mb-6 sm:mb-8">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xl sm:text-2xl mx-auto mb-3 sm:mb-4">
                          {currentParticipantIndex + 1}
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">{participantName}</h3>
                        <Link 
                          href={`/profile/${currentParticipant}`}
                          className="inline-block px-3 sm:px-4 py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          View Profile
                        </Link>
                      </div>

                      {/* Current Question */}
                      <div className="mb-6 sm:mb-8">
                        <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">{currentQuestion.question}</h4>
                        <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">{currentQuestion.description}</p>
                        
                        {/* Rating Input */}
                        <div className="mb-4 sm:mb-6">
                          <input
                            type="number"
                            min="-1000"
                            max="1000"
                            value={currentRating || ''}
                            onChange={(e) => handleQuestionRating(currentParticipant, currentQuestion.id, parseInt(e.target.value) || 0)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors text-center text-base sm:text-lg"
                            placeholder="0"
                          />
                        </div>

                        {/* Preset Points */}
                        <div className="mb-4 sm:mb-6">
                          <div className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">Quick Select:</div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
                            {presetPoints.map((preset) => {
                              const isSelected = currentRating === preset.value;
                              const isDisabled = Math.abs(preset.value) > remainingPoints + Math.abs(currentRating);
                              
                              return (
                                <button
                                  key={preset.value}
                                  type="button"
                                  onClick={() => handleQuestionRating(currentParticipant, currentQuestion.id, preset.value)}
                                  disabled={isDisabled}
                                  className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg border transition-all ${
                                    isSelected 
                                      ? 'ring-2 ring-blue-500 ring-offset-2' 
                                      : preset.color
                                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Question Labels */}
                        <div className="flex justify-between text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
                          <span className="text-left max-w-[40%]">{currentQuestion.negativeLabel}</span>
                          <span className="text-right max-w-[40%]">{currentQuestion.positiveLabel}</span>
                        </div>
                      </div>

                      {/* Navigation */}
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between sm:items-center">
                        <button
                          onClick={handlePreviousQuestion}
                          disabled={currentParticipantIndex === 0 && currentQuestionIndex === 0}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm sm:text-base order-2 sm:order-1"
                        >
                          Previous
                        </button>
                        
                        <button
                          onClick={handleSkipParticipant}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-orange-100 border border-orange-300 rounded-lg text-orange-700 font-semibold hover:bg-orange-200 transition-colors shadow-sm text-sm sm:text-base order-1 sm:order-2"
                        >
                          Skip Participant
                        </button>
                        
                        <button
                          onClick={handleNextQuestion}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm text-sm sm:text-base order-3"
                        >
                          {currentQuestionIndex === auraQuestions.length - 1 && currentParticipantIndex === participants.length - 1 
                            ? 'Finish Rating' 
                            : 'Next'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              // Review step
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6 sm:mb-8">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Review Your Ratings</h3>
                  <p className="text-gray-600 text-sm sm:text-base">Review your aura ratings before submitting</p>
                </div>
                
                <div className="space-y-4 sm:space-y-6">
                  {participants.map((participantId, index) => {
                    const participantName = participantId === group.createdBy 
                      ? `${group.createdByDisplayName} (Creator)` 
                      : participantNames[participantId] || 'Loading...';
                    
                    const totalRating = getParticipantTotalRating(participantId);
                    
                    return (
                      <div key={participantId} className="border border-gray-200 rounded-lg p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3 sm:gap-0">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-lg">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="text-base sm:text-lg font-semibold text-gray-900">{participantName}</h4>
                              <div className={`text-base sm:text-lg font-bold ${totalRating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Total: {totalRating > 0 ? '+' : ''}{totalRating} aura points
                              </div>
                            </div>
                          </div>
                          <Link 
                            href={`/profile/${participantId}`}
                            className="px-3 py-1 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm self-start sm:self-auto"
                          >
                            View Profile
                          </Link>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {auraQuestions.map(question => {
                            const questionKey = `${participantId}_${question.id}`;
                            const questionRating = ratings[questionKey] || 0;
                            
                            return (
                              <div key={question.id} className="bg-gray-50 rounded-lg p-2 sm:p-3">
                                <div className="text-xs sm:text-sm font-medium text-gray-900 mb-1">{question.question}</div>
                                <div className={`text-xs sm:text-sm ${questionRating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {questionRating > 0 ? '+' : ''}{questionRating} points
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="text-center">
            {currentStep === 1 ? (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <button
                  onClick={() => setCurrentStep(0)}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold text-base sm:text-lg hover:bg-gray-200 transition-colors shadow-sm"
                >
                  Back to Rating
                </button>
                
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || participants.length === 0}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 rounded-lg text-white font-semibold text-base sm:text-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting Ratings...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Submit All Ratings
                    </span>
                  )}
                </button>
              </div>
            ) : null}
            
            {negativePointsUsed < 0 && (
              <p className="text-orange-600 text-xs sm:text-sm mt-2 bg-orange-50 rounded-lg p-2 sm:p-3 border border-orange-200">
                ⚠️ You are using negative points. This will reduce the aura of the people you rate negatively.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 