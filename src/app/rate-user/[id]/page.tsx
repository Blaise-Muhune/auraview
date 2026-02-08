'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { getUserProfile, submitRating, getUserRemainingPoints, checkUserPoints, UserProfile } from "@/lib/firestore";

interface RateUserPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function RateUserPage({ params }: RateUserPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [points, setPoints] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [remainingGlobalPoints, setRemainingGlobalPoints] = useState(10000);

  // Preset aura point values
  const presetPoints = [
    { label: '+1000', value: 1000, color: 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' },
    { label: '+500', value: 500, color: 'bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200' },
    { label: '+100', value: 100, color: 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200' },
    { label: '+50', value: 50, color: 'bg-cyan-100 border-cyan-300 text-cyan-700 hover:bg-cyan-200' },
    { label: '0', value: 0, color: 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200' },
    { label: '-50', value: -50, color: 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200' },
    { label: '-100', value: -100, color: 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' },
    { label: '-500', value: -500, color: 'bg-red-200 border-red-400 text-red-800 hover:bg-red-300' },
    { label: '-1000', value: -1000, color: 'bg-red-300 border-red-500 text-red-900 hover:bg-red-400' },
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(`/rate-user/${id}`)}`);
      return;
    }

    if (user && id) {
      loadTargetUser();
      loadUserPoints();
    }
  }, [user, loading, id, router]);

  const loadTargetUser = async () => {
    try {
      const userProfile = await getUserProfile(id);
      if (!userProfile) {
        setError('User not found. This user may not have created a profile yet.');
        return;
      }
      setTargetUser(userProfile);
    } catch (err) {
      setError('Failed to load user profile. Please try again later.');
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

  const handlePointsChange = (value: string) => {
    if (value === '' || value === '-') {
      setPoints(0);
      return;
    }
    
    const numValue = parseInt(value);
    if (isNaN(numValue)) return;
    
    // Allow negative points (no minimum limit)
    if (numValue > remainingGlobalPoints) {
      setPoints(remainingGlobalPoints);
    } else {
      setPoints(numValue);
    }
  };

  const handlePresetPointSelect = (selectedPoints: number) => {
    // Check if user has enough points for this selection
    if (Math.abs(selectedPoints) <= remainingGlobalPoints) {
      setPoints(selectedPoints);
    } else {
      // If not enough points, set to maximum possible
      const maxPossible = remainingGlobalPoints;
      setPoints(maxPossible);
    }
  };

  const handleSubmit = async () => {
    if (!user || !targetUser) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Calculate absolute points for validation
      const absolutePointsUsed = Math.abs(points);
      const hasEnoughPoints = await checkUserPoints(user.uid, absolutePointsUsed);
      
      if (!hasEnoughPoints) {
        setError('You don\'t have enough points to submit this rating. You have used some points in other groups.');
        return;
      }

      // Create a temporary group ID for direct ratings
      const tempGroupId = `direct-rating-${Date.now()}`;

      await submitRating(
        tempGroupId,
        user,
        targetUser.id,
        targetUser.displayName || 'Anonymous User',
        points,
        reason && reason.trim() ? reason.trim() : undefined
      );
      
      setSuccess('Rating submitted successfully!');
      
      // Redirect to leaderboard after successful submission
      setTimeout(() => {
        router.push('/leaderboard');
      }, 2000);

    } catch (err) {
      console.error('Rating submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg">Loading user profile...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !targetUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/leaderboard" className="text-2xl font-bold text-gray-900">Aura</Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">User Not Found</h2>
              <p className="text-gray-600 mb-6">{error || 'The user you are looking for does not exist.'}</p>
              <Link href="/leaderboard" className="inline-block px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                Back to Leaderboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Don't allow users to rate themselves
  if (user.uid === targetUser.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/leaderboard" className="text-2xl font-bold text-gray-900">Aura</Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Cannot Rate Yourself</h2>
              <p className="text-gray-600 mb-6">You cannot rate your own aura. Try rating someone else!</p>
              <Link href="/leaderboard" className="inline-block px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                Back to Leaderboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const absolutePointsUsed = Math.abs(points);
  const remainingPoints = remainingGlobalPoints - absolutePointsUsed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/leaderboard" className="text-2xl font-bold text-gray-900">Aura</Link>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-600">
                    {user.displayName || 'User'}
                  </span>
                </div>
              )}
              <Link href="/leaderboard" className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700">
                Back to Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Rating Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center text-gray-900 mb-12">
            <h1 className="text-4xl font-bold mb-4">Rate User</h1>
            <p className="text-xl text-gray-600">Give aura points to this user</p>
          </div>

          {/* Target User Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex items-center gap-4 mb-6">
              {targetUser.photoURL && (
                <img 
                  src={targetUser.photoURL} 
                  alt={targetUser.displayName || 'User'} 
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{targetUser.displayName || 'User'}</h2>
                <p className="text-gray-600">{targetUser.email}</p>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-blue-600">{targetUser.totalAura?.toLocaleString() || '0'}</span>
                  <span className="text-gray-600 text-sm ml-2">Total Aura</span>
                </div>
              </div>
            </div>
            
            {/* Quick Profile Link */}
            <div className="text-center">
              <Link 
                href={`/profile/${targetUser.id}`}
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                View Full Profile
              </Link>
            </div>
          </div>

          {/* Points Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{remainingGlobalPoints.toLocaleString()}</div>
                <div className="text-gray-600 text-sm">Available Points</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${remainingPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {remainingPoints.toLocaleString()}
                </div>
                <div className="text-gray-600 text-sm">Remaining</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${absolutePointsUsed >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {absolutePointsUsed.toLocaleString()}
                </div>
                <div className="text-gray-600 text-sm">Points Used</div>
              </div>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  absolutePointsUsed >= 0 
                    ? 'bg-blue-600' 
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(Math.abs(absolutePointsUsed) / remainingGlobalPoints * 100, 100)}%` }}
              ></div>
            </div>
            <div className="mt-3 text-center text-gray-500 text-xs">
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

          {/* Rating Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Rate This User</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  Aura Points
                </label>
                <input
                  type="number"
                  min="-10000"
                  max={remainingGlobalPoints}
                  value={points || ''}
                  onChange={(e) => handlePointsChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="0 (or negative to reduce aura)"
                />
                
                {/* Preset Points */}
                <div className="mt-3">
                  <div className="text-sm text-gray-600 mb-2">Quick Select:</div>
                  <div className="flex flex-wrap gap-2">
                    {presetPoints.map((preset) => {
                      const isSelected = points === preset.value;
                      const isDisabled = Math.abs(preset.value) > remainingGlobalPoints;
                      
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => handlePresetPointSelect(preset.value)}
                          disabled={isDisabled}
                          className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
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
                
                <p className="text-sm text-gray-500 mt-1">
                  Positive points increase their aura, negative points decrease it
                </p>
              </div>
              
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  rows={3}
                  placeholder="Why are you giving these points? (Optional)"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || points === 0}
              className="px-8 py-4 bg-blue-600 rounded-lg text-white font-semibold text-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting Rating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Submit Rating
                </span>
              )}
            </button>
            
            {points < 0 && (
              <p className="text-orange-600 text-sm mt-2">
                ⚠️ You are using negative points. This will reduce the user&apos;s aura.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 