'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { submitFamousPersonRating, getUserRemainingPoints, checkUserPoints, getFamousPersonStats, FamousPerson } from "@/lib/firestore";

interface RateFamousPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface TMDBPerson {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  popularity: number;
}

export default function RateFamousPage({ params }: RateFamousPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const [famousPerson, setFamousPerson] = useState<FamousPerson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [points, setPoints] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [remainingGlobalPoints, setRemainingGlobalPoints] = useState(10000);

  // TMDB API configuration
  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || 'demo_key'; // Get free API key from https://www.themoviedb.org/settings/api
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w200';

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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user && id) {
      loadFamousPerson();
      loadUserPoints();
    }
  }, [user, loading, id, router]);

  const loadFamousPerson = async () => {
    try {
      // Fetch from TMDB API
      const response = await fetch(`${TMDB_BASE_URL}/person/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch from TMDB API');
      }
      
      const personData: TMDBPerson = await response.json();
      
      // Get Firestore stats for this famous person
      const stats = await getFamousPersonStats(id);
      
      const person: FamousPerson = {
        id: personData.id.toString(),
        name: personData.name,
        profession: personData.known_for_department || 'Actor',
        imageUrl: personData.profile_path ? `${TMDB_IMAGE_BASE_URL}${personData.profile_path}` : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        totalAura: stats.totalAura,
        ratingsReceived: stats.ratingsReceived,
        averageRating: stats.averageRating
      };
      
      setFamousPerson(person);
    } catch (err) {
      console.error('Error loading famous person data:', err);
      setError('Failed to load famous person data. Please check if the ID is valid.');
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
    
    const newPoints = parseInt(value);
    if (isNaN(newPoints)) return;
    
    if (Math.abs(newPoints) <= remainingGlobalPoints) {
      setPoints(newPoints);
    } else {
      const maxPossible = remainingGlobalPoints;
      setPoints(newPoints > 0 ? maxPossible : -maxPossible);
    }
  };

  const handlePresetPointSelect = (selectedPoints: number) => {
    if (Math.abs(selectedPoints) <= remainingGlobalPoints) {
      setPoints(selectedPoints);
    } else {
      const maxPossible = remainingGlobalPoints;
      setPoints(selectedPoints > 0 ? maxPossible : -maxPossible);
    }
  };

  const handleSubmit = async () => {
    if (!user || !famousPerson) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if user has enough points
      const hasEnoughPoints = await checkUserPoints(user.uid, Math.abs(points));
      
      if (!hasEnoughPoints) {
        setError('You don\'t have enough points to submit this rating. You have used some points in other groups.');
        return;
      }

      // Submit rating to Firestore
      await submitFamousPersonRating(
        user,
        famousPerson.id,
        famousPerson.name,
        points,
        reason || undefined
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
          <div className="text-gray-600 text-lg">Loading famous person...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !famousPerson) {
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Famous Person Not Found</h2>
              <p className="text-gray-600 mb-6">{error || 'The famous person you are looking for does not exist.'}</p>
              <Link href="/leaderboard" className="inline-block px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                Back to Leaderboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
            <h1 className="text-4xl font-bold mb-4">Rate Famous Person</h1>
            <p className="text-xl text-gray-600">Share your aura points with this famous person</p>
          </div>

          {/* Famous Person Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{famousPerson.name}</h2>
              <p className="text-gray-600 mb-4">{famousPerson.profession}</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{famousPerson.totalAura.toLocaleString()}</div>
                  <div className="text-gray-600 text-sm">Total Aura</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{famousPerson.ratingsReceived}</div>
                  <div className="text-gray-600 text-sm">Ratings</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{famousPerson.averageRating}</div>
                  <div className="text-gray-600 text-sm">Avg Rating</div>
                </div>
              </div>
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
                <div className={`text-2xl font-bold ${(remainingGlobalPoints - Math.abs(points)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(remainingGlobalPoints - Math.abs(points)).toLocaleString()}
                </div>
                <div className="text-gray-600 text-sm">Remaining</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${Math.abs(points) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {Math.abs(points).toLocaleString()}
                </div>
                <div className="text-gray-600 text-sm">Points Used</div>
              </div>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  Math.abs(points) >= 0 
                    ? 'bg-blue-600' 
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(Math.abs(points) / remainingGlobalPoints * 100, 100)}%` }}
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
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Rate {famousPerson.name}</h3>
            
            <div className="space-y-6">
              {/* Points Input */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
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
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors resize-none"
                  placeholder="Why are you giving this rating? (optional)"
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
                ⚠️ You are using negative points. This will reduce the aura of {famousPerson.name}.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 