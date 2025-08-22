'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { getGroupById, getGroupRatings, getUserProfilesByIds, getUserDisplayName, Rating, GroupSession, UserProfile } from "@/lib/firestore";

interface ResultsPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface UserRanking {
  userId: string;
  displayName: string;
  totalPoints: number;
  baseAura: number;
  totalAura: number;
  ratingsReceived: Rating[];
  isCreator: boolean;
}

export default function ResultsPage({ params }: ResultsPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user && id) {
      loadData();
    }
  }, [user, loading, id, router]);

  const loadData = async () => {
    try {
      console.log('Loading data for group ID:', id);
      
      const [groupData, ratingsData] = await Promise.all([
        getGroupById(id),
        getGroupRatings(id)
      ]);

      console.log('Group data:', groupData);
      console.log('Ratings data:', ratingsData);

      if (!groupData) {
        setError('Group not found');
        return;
      }

      setGroup(groupData);
      setRatings(ratingsData);
      
      // Get user profiles for all participants
      const userProfiles = await getUserProfilesByIds(groupData.participants);
      await calculateRankings(groupData, ratingsData, userProfiles);
    } catch (err) {
      console.error('Error loading group data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load group data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRankings = async (groupData: GroupSession, ratingsData: Rating[], userProfiles: UserProfile[]) => {
    // Create a map of user totals
    const userTotals = new Map<string, { points: number; ratings: Rating[] }>();

    // Initialize all participants with 0 points
    groupData.participants.forEach(participantId => {
      userTotals.set(participantId, { points: 0, ratings: [] });
    });

    // Calculate totals from ratings
    ratingsData.forEach(rating => {
      const current = userTotals.get(rating.toUserId);
      if (current) {
        current.points += rating.points;
        current.ratings.push(rating);
      }
    });

    // Create a map of user profiles for easy lookup
    const userProfileMap = new Map<string, UserProfile>();
    userProfiles.forEach(profile => {
      userProfileMap.set(profile.id, profile);
    });

    // Convert to rankings array with async display name resolution
    const rankingsPromises = Array.from(userTotals.entries()).map(async ([userId, data]) => {
      let displayName: string;
      
      if (userId === groupData.createdBy) {
        // Use the creator's display name from group data
        displayName = groupData.createdByDisplayName;
      } else {
        // Get display name with fallback logic
        displayName = await getUserDisplayName(userId);
      }

      return {
        userId,
        displayName,
        totalPoints: data.points,
        baseAura: 500,
        totalAura: 500 + data.points,
        ratingsReceived: data.ratings,
        isCreator: userId === groupData.createdBy
      };
    });

    // Wait for all display names to be resolved
    const rankingsArray = await Promise.all(rankingsPromises);

    // Sort by total aura (descending)
    rankingsArray.sort((a, b) => b.totalAura - a.totalAura);

    setRankings(rankingsArray);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          1st
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          2nd
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          3rd
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm">
        {rank}
      </div>
    );
  };

  const getAuraLevel = (totalAura: number) => {
    if (totalAura >= 5000) return { level: 'Legendary', color: 'text-purple-600', bgColor: 'bg-purple-50' };
    if (totalAura >= 3000) return { level: 'Epic', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (totalAura >= 1500) return { level: 'Rare', color: 'text-green-600', bgColor: 'bg-green-50' };
    if (totalAura >= 800) return { level: 'Common', color: 'text-gray-600', bgColor: 'bg-gray-50' };
    return { level: 'Basic', color: 'text-gray-500', bgColor: 'bg-gray-50' };
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg">Loading group results...</div>
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
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/group/${group.id}`} className="text-2xl font-bold text-gray-900">Aura</Link>
            <div className="flex gap-4">
              <Link href={`/group/${group.id}`} className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700">
                Back to Group
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Results Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-900 mb-8">
            <h1 className="text-4xl font-bold mb-4">Group Results</h1>
            <p className="text-xl text-gray-600">See how everyone ranked in {group.name}</p>
          </div>

          {/* Group Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{rankings.length}</div>
                <div className="text-gray-600 text-sm">Participants</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{ratings.length}</div>
                <div className="text-gray-600 text-sm">Ratings Given</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {rankings.reduce((sum, rank) => sum + rank.totalPoints, 0).toLocaleString()}
                </div>
                <div className="text-gray-600 text-sm">Total Points</div>
              </div>
            </div>
          </div>

          {/* Rankings */}
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Aura Rankings</h3>
            
            {rankings.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium">No ratings submitted yet.</p>
                <p className="text-sm mt-2 text-gray-600">Be the first to rate your friends!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rankings.map((ranking, index) => {
                  const rank = index + 1;
                  const auraLevel = getAuraLevel(ranking.totalAura);
                  
                  return (
                    <div key={ranking.userId} className={`border rounded-lg p-6 transition-all ${
                      ranking.userId === user.uid 
                        ? 'border-blue-300 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {getRankBadge(rank)}
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {ranking.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-gray-900 font-medium flex items-center gap-2">
                              {ranking.displayName}
                              {ranking.isCreator && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                                  Creator
                                </span>
                              )}
                              {ranking.userId === user.uid && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <div className={`text-sm font-medium ${auraLevel.color}`}>
                              {auraLevel.level} Aura
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {ranking.totalAura.toLocaleString()}
                          </div>
                          <div className="text-gray-500 text-sm">
                            {ranking.totalPoints.toLocaleString()} + {ranking.baseAura} base
                          </div>
                        </div>
                      </div>

                      {/* Rating Details */}
                      {ranking.ratingsReceived.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="text-sm text-gray-600 mb-2">
                            Received {ranking.ratingsReceived.length} rating{ranking.ratingsReceived.length !== 1 ? 's' : ''}:
                          </div>
                          <div className="space-y-2">
                            {ranking.ratingsReceived.map((rating, ratingIndex) => (
                              <div key={ratingIndex} className="flex items-center justify-between text-sm bg-gray-50 rounded p-3">
                                <div className="flex items-center gap-2">
                                  <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                  <span className="text-gray-700 font-medium">{rating.points} points</span>
                                  {rating.reason && (
                                    <span className="text-gray-500">- {rating.reason}</span>
                                  )}
                                </div>
                                <div className="text-gray-500">
                                  from {rating.fromUserDisplayName}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href={`/group/${group.id}/rate`}
              className="px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm text-center"
            >
              Rate Friends
            </Link>
            <Link 
              href={`/group/${group.id}`}
              className="px-6 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-200 transition-colors text-center"
            >
              Back to Group
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
} 