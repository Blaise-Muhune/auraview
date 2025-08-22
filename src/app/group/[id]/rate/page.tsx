'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { getGroupById, submitRating, GroupSession, getUserRemainingPoints, checkUserPoints, getUserProfile } from "@/lib/firestore";

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
  const [reasons, setReasons] = useState<{[key: string]: string}>({});
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

  const usedPoints = Object.values(ratings).reduce((sum, points) => sum + points, 0);
  const absolutePointsUsed = Object.values(ratings).reduce((sum, points) => sum + Math.abs(points), 0);
  const positivePointsUsed = Object.values(ratings).reduce((sum, points) => sum + Math.max(0, points), 0);
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

  const handleRatingChange = (participantId: string, points: number) => {
    // Allow negative points (no minimum limit)
    if (points > remainingGlobalPoints) points = remainingGlobalPoints;
    
    setRatings(prev => ({
      ...prev,
      [participantId]: points
    }));
  };

  const handleRatingInputChange = (participantId: string, value: string) => {
    // Handle empty string or invalid input
    if (value === '' || value === '-') {
      setRatings(prev => ({
        ...prev,
        [participantId]: 0
      }));
      return;
    }
    
    const points = parseInt(value);
    if (isNaN(points)) return; // Invalid number
    
    // Allow negative points (no minimum limit)
    if (points > remainingGlobalPoints) {
      handleRatingChange(participantId, remainingGlobalPoints);
    } else {
      handleRatingChange(participantId, points);
    }
  };

  const handleReasonChange = (participantId: string, reason: string) => {
    setReasons(prev => ({
      ...prev,
      [participantId]: reason
    }));
  };

  const handlePresetPointSelect = (participantId: string, points: number) => {
    // Check if user has enough points for this selection
    const currentRating = ratings[participantId] || 0;
    const newTotalUsed = absolutePointsUsed - Math.abs(currentRating) + Math.abs(points);
    
    if (newTotalUsed <= remainingGlobalPoints) {
      handleRatingChange(participantId, points);
    } else {
      // If not enough points, set to maximum possible
      const maxPossible = remainingGlobalPoints - (absolutePointsUsed - Math.abs(currentRating));
      handleRatingChange(participantId, maxPossible);
    }
  };

  const handleQuestionRating = (participantId: string, questionId: string, points: number) => {
    // Store rating for this specific question
    const questionKey = `${participantId}_${questionId}`;
    setRatings(prev => ({
      ...prev,
      [questionKey]: points
    }));
  };

  const getCurrentParticipant = () => {
    if (!group || participants.length === 0) return null;
    return participants[currentParticipantIndex];
  };

  const getCurrentQuestion = () => {
    return auraQuestions[currentQuestionIndex];
  };

  const getParticipantTotalRating = (participantId: string) => {
    let total = 0;
    auraQuestions.forEach(question => {
      const questionKey = `${participantId}_${question.id}`;
      total += ratings[questionKey] || 0;
    });
    return total;
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < auraQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Move to next participant
      if (currentParticipantIndex < participants.length - 1) {
        setCurrentParticipantIndex(currentParticipantIndex + 1);
        setCurrentQuestionIndex(0);
      } else {
        // All participants rated
        setCurrentStep(1); // Move to review step
      }
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else {
      // Move to previous participant
      if (currentParticipantIndex > 0) {
        setCurrentParticipantIndex(currentParticipantIndex - 1);
        setCurrentQuestionIndex(auraQuestions.length - 1);
      }
    }
  };

  const handleSkipParticipant = () => {
    if (currentParticipantIndex < participants.length - 1) {
      setCurrentParticipantIndex(currentParticipantIndex + 1);
      setCurrentQuestionIndex(0);
    } else {
      setCurrentStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!user || !group) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Calculate total points for each participant
      const participantRatings: {[key: string]: number} = {};
      participants.forEach(participantId => {
        participantRatings[participantId] = getParticipantTotalRating(participantId);
      });

      // Calculate absolute points for validation
      const absolutePointsUsed = Object.values(participantRatings).reduce((sum, points) => sum + Math.abs(points), 0);
      const hasEnoughPoints = await checkUserPoints(user.uid, absolutePointsUsed);
      
      if (!hasEnoughPoints) {
        setError('You don\'t have enough points to submit these ratings. You have used some points in other groups.');
        return;
      }

      // Submit ratings for each participant
      const ratingPromises = Object.entries(participantRatings).map(([participantId, points]) => {
        if (points !== 0) { // Allow 0 and negative values
          // Create a combined reason from all questions
          const questionReasons: string[] = [];
          auraQuestions.forEach(question => {
            const questionKey = `${participantId}_${question.id}`;
            const questionPoints = ratings[questionKey] || 0;
            if (questionPoints !== 0) {
              const label = questionPoints > 0 ? question.positiveLabel : question.negativeLabel;
              questionReasons.push(`${question.question}: ${label} (${questionPoints > 0 ? '+' : ''}${questionPoints})`);
            }
          });
          
          const combinedReason = questionReasons.join('; ');
          
          return submitRating(
            group.id!,
            user,
            participantId,
            'Anonymous User', // In a real app, you'd get the actual display name
            points, // Can be negative
            combinedReason || undefined
          );
        }
        return Promise.resolve();
      });

      await Promise.all(ratingPromises);
      
      setSuccess('Ratings submitted successfully!');
      
      // Redirect immediately after successful submission
      router.push(`/group/${group.id}/results`);

    } catch (err) {
      console.error('Rating submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit ratings');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg">Loading rating interface...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900">Aura</Link>
              <div className="flex items-center gap-4">
                <Link href="/dashboard" className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700">
                  Dashboard
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Group Not Found</h2>
              <p className="text-gray-600 mb-6">{error || 'The group you are looking for does not exist.'}</p>
              <Link href="/dashboard" className="px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const participants = group.participants.filter(id => id !== user.uid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/group/${group.id}`} className="text-2xl font-bold text-gray-900">Aura</Link>
            <div className="flex items-center gap-4">
              <Link href={`/group/${group.id}`} className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700">
                Back to Group
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Rating Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-900 mb-12">
            <h1 className="text-4xl font-bold mb-4">Rate Your Friends</h1>
            <p className="text-xl text-gray-600">Distribute your 10,000 aura points among group members</p>
          </div>

          {/* Points Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div className="bg-white rounded-xl p-6 text-center text-gray-900 shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">{remainingGlobalPoints.toLocaleString()}</div>
                <div className="text-gray-500 text-sm">Available Points</div>
              </div>
              <div className="bg-white rounded-xl p-6 text-center text-gray-900 shadow-sm border border-gray-200">
                <div className={`text-3xl font-bold ${remainingPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {remainingPoints.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Remaining</div>
              </div>
              <div className="bg-white rounded-xl p-6 text-center text-gray-900 shadow-sm border border-gray-200">
                <div className={`text-3xl font-bold ${absolutePointsUsed >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  {absolutePointsUsed.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Points Used</div>
              </div>
            </div>
            <div className="mt-6 w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  absolutePointsUsed >= 0 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600' 
                    : 'bg-gradient-to-r from-red-500 to-orange-500'
                }`}
                style={{ width: `${Math.min(Math.abs(absolutePointsUsed) / remainingGlobalPoints * 100, 100)}%` }}
              ></div>
            </div>
            {negativePointsUsed < 0 && (
              <div className="mt-3 text-center text-red-600 text-sm bg-red-50 rounded-lg p-3 border border-red-200">
                ⚠️ You are using negative points (reducing aura) - These count against your limit
              </div>
            )}
            <div className="mt-4 text-center text-gray-500 text-sm bg-gray-50 rounded-lg p-3 border border-gray-200">
              💡 Both positive and negative points count against your 10,000 point limit.
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
              {success}
            </div>
          )}

          {/* Participants Rating */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Rate Your Friends</h3>
            
            {participants.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p>No other members to rate yet.</p>
                <p className="text-sm mt-2">Share the group code to invite friends!</p>
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
                      <div className="mb-8">
                        <div className="text-sm text-gray-500 mb-3">
                          Rating {currentParticipantIndex + 1} of {participants.length} • 
                          Question {currentQuestionIndex + 1} of {auraQuestions.length}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${((currentParticipantIndex * auraQuestions.length + currentQuestionIndex + 1) / (participants.length * auraQuestions.length)) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Current Participant */}
                      <div className="mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-2xl mx-auto mb-4">
                          {currentParticipantIndex + 1}
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">{participantName}</h3>
                        <Link 
                          href={`/profile/${currentParticipant}`}
                          className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          View Profile
                        </Link>
                      </div>

                      {/* Current Question */}
                      <div className="mb-8">
                        <h4 className="text-xl font-semibold text-gray-900 mb-3">{currentQuestion.question}</h4>
                        <p className="text-gray-600 mb-6">{currentQuestion.description}</p>
                        
                        {/* Rating Input */}
                        <div className="mb-6">
                          <input
                            type="number"
                            min="-1000"
                            max="1000"
                            value={currentRating || ''}
                            onChange={(e) => handleQuestionRating(currentParticipant, currentQuestion.id, parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors text-center text-lg"
                            placeholder="0"
                          />
                        </div>

                        {/* Preset Points */}
                        <div className="mb-6">
                          <div className="text-sm text-gray-600 mb-3">Quick Select:</div>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {presetPoints.map((preset) => {
                              const isSelected = currentRating === preset.value;
                              const isDisabled = Math.abs(preset.value) > remainingPoints + Math.abs(currentRating);
                              
                              return (
                                <button
                                  key={preset.value}
                                  type="button"
                                  onClick={() => handleQuestionRating(currentParticipant, currentQuestion.id, preset.value)}
                                  disabled={isDisabled}
                                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
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
                        <div className="flex justify-between text-sm text-gray-500 mb-6">
                          <span>{currentQuestion.negativeLabel}</span>
                          <span>{currentQuestion.positiveLabel}</span>
                        </div>
                      </div>

                      {/* Navigation */}
                      <div className="flex justify-between items-center">
                        <button
                          onClick={handlePreviousQuestion}
                          disabled={currentParticipantIndex === 0 && currentQuestionIndex === 0}
                          className="px-6 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          Previous
                        </button>
                        
                        <button
                          onClick={handleSkipParticipant}
                          className="px-6 py-3 bg-orange-100 border border-orange-300 rounded-lg text-orange-700 font-semibold hover:bg-orange-200 transition-colors shadow-sm"
                        >
                          Skip Participant
                        </button>
                        
                        <button
                          onClick={handleNextQuestion}
                          className="px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
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
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Review Your Ratings</h3>
                  <p className="text-gray-600">Review your aura ratings before submitting</p>
                </div>
                
                <div className="space-y-6">
                  {participants.map((participantId, index) => {
                    const participantName = participantId === group.createdBy 
                      ? `${group.createdByDisplayName} (Creator)` 
                      : participantNames[participantId] || 'Loading...';
                    
                    const totalRating = getParticipantTotalRating(participantId);
                    
                    return (
                      <div key={participantId} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900">{participantName}</h4>
                              <div className={`text-lg font-bold ${totalRating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Total: {totalRating > 0 ? '+' : ''}{totalRating} aura points
                              </div>
                            </div>
                          </div>
                          <Link 
                            href={`/profile/${participantId}`}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                          >
                            View Profile
                          </Link>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          {auraQuestions.map(question => {
                            const questionKey = `${participantId}_${question.id}`;
                            const questionRating = ratings[questionKey] || 0;
                            
                            return (
                              <div key={question.id} className="bg-gray-50 rounded-lg p-3">
                                <div className="text-sm font-medium text-gray-900 mb-1">{question.question}</div>
                                <div className={`text-sm ${questionRating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setCurrentStep(0)}
                  className="px-8 py-4 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold text-lg hover:bg-gray-200 transition-colors shadow-sm"
                >
                  Back to Rating
                </button>
                
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || participants.length === 0}
                  className="px-8 py-4 bg-blue-600 rounded-lg text-white font-semibold text-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
              <p className="text-orange-600 text-sm mt-2 bg-orange-50 rounded-lg p-3 border border-orange-200">
                ⚠️ You are using negative points. This will reduce the aura of the people you rate negatively.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 