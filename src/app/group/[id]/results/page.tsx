'use client';

import Link from "next/link";
import { useRef } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { getGroupById, getGroupRatings, getUserProfilesByIds, getUserDisplayName, isVotingClosed, Rating, GroupSession, UserProfile } from "@/lib/firestore";
import { generateRankCard } from "@/lib/insights";
import { ShareableCard } from "@/components/ShareableCard";

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
  const [expandedRatings, setExpandedRatings] = useState<string[]>([]);
  const [ratingPages, setRatingPages] = useState<{[key: string]: number}>({});
  const [sharedCardUserId, setSharedCardUserId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const toggleRatings = (userId: string) => {
    setExpandedRatings(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
    // Reset to page 1 when expanding
    if (!expandedRatings.includes(userId)) {
      setRatingPages(prev => ({ ...prev, [userId]: 1 }));
    }
  };

  const getCurrentPage = (userId: string) => {
    return ratingPages[userId] || 1;
  };

  const changePage = (userId: string, direction: number) => {
    const currentPage = getCurrentPage(userId);
    const newPage = currentPage + direction;
    if (newPage >= 1) {
      setRatingPages(prev => ({ ...prev, [userId]: newPage }));
    }
  };

  const getPaginatedRatings = (ratings: Rating[], userId: string) => {
    const currentPage = getCurrentPage(userId);
    const startIndex = (currentPage - 1) * 10;
    const endIndex = startIndex + 10;
    return ratings.slice(startIndex, endIndex);
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
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg">
          1st
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg">
          2nd
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg">
          3rd
        </div>
      );
    }
    return (
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-xs sm:text-sm">
        {rank}
      </div>
    );
  };

  const captureAndShareCard = async (ranking: UserRanking, rank: number, card: { headline: string; subline: string }) => {
    const el = cardRefs.current[ranking.userId];
    if (!el) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsCapturing(false);
          return;
        }
        const file = new File([blob], `aura-${ranking.displayName.replace(/\s/g, '-')}-rank-${rank}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `${ranking.displayName}'s Aura`,
            text: card.headline,
            files: [file],
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        }
        setSharedCardUserId(ranking.userId);
        setTimeout(() => setSharedCardUserId(null), 2000);
      }, 'image/png', 1);
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const getAuraLevel = (totalAura: number) => {
    if (totalAura >= 5000) return { level: 'Deeply appreciated', color: 'text-purple-600', bgColor: 'bg-purple-50' };
    if (totalAura >= 3000) return { level: 'Really valued', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (totalAura >= 1500) return { level: 'Well seen', color: 'text-green-600', bgColor: 'bg-green-50' };
    if (totalAura >= 800) return { level: 'Noticed', color: 'text-gray-600', bgColor: 'bg-gray-50' };
    return { level: 'Getting started', color: 'text-gray-500', bgColor: 'bg-gray-50' };
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading results...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !group) {
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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/my-groups" />

      <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center text-gray-900 dark:text-gray-100 mb-6">
            <h1 className="text-2xl font-bold mb-2">What Friends Appreciate</h1>
            <p className="text-gray-600 dark:text-gray-400">Insights from {group.name}</p>
            {(() => {
              const uniqueVoters = new Set(ratings.map(r => r.fromUserId)).size;
              const votingClosed = isVotingClosed(group, uniqueVoters);
              if (!votingClosed) {
                return (
                  <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                    Voting is still open. Shareable cards will appear when voting closes.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{rankings.length}</div>
                <div className="text-gray-600 dark:text-gray-400 text-xs">Participants</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{ratings.length}</div>
                <div className="text-gray-600 dark:text-gray-400 text-xs">Ratings</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {rankings.reduce((sum, rank) => sum + rank.totalPoints, 0).toLocaleString()}
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-xs">Points</div>
              </div>
            </div>
          </div>

          {/* Shareable rank cards - only when voting is closed */}
          {(() => {
            const uniqueVoters = new Set(ratings.map(r => r.fromUserId)).size;
            const votingClosed = isVotingClosed(group, uniqueVoters);
            if (!votingClosed) return null;

            return (
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Share your ranking</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Voting is closed. Share your card with friends.</p>
                {rankings.map((ranking, index) => {
              const rank = index + 1;
              const card = generateRankCard({
                rank,
                totalInGroup: rankings.length,
                groupName: group.name,
                displayName: ranking.displayName,
                totalAura: ranking.totalAura,
              });
              const auraLevel = getAuraLevel(ranking.totalAura);
              const isCurrentUser = ranking.userId === user.uid;
              const isShared = sharedCardUserId === ranking.userId;

              return (
                <div
                  key={ranking.userId}
                  className={`relative border rounded-lg p-5 mb-4 ${
                    isCurrentUser
                      ? 'border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-900 ring-2 ring-gray-300 dark:ring-gray-600'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {/* Off-screen card for image capture - fixed position outside viewport */}
                  <div
                    ref={(el) => { cardRefs.current[ranking.userId] = el; }}
                    className="absolute left-[-9999px] top-0"
                    style={{ width: 360, height: 450 }}
                  >
                    <ShareableCard
                      displayName={ranking.displayName}
                      rank={rank}
                      totalInGroup={rankings.length}
                      groupName={group.name}
                      totalAura={ranking.totalAura}
                      auraLevel={auraLevel.level}
                      headline={card.headline}
                      subline={card.subline}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        {ranking.displayName} {isCurrentUser && '(You)'}
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{card.headline}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{card.subline}</p>
                    </div>
                    <button
                      onClick={() => captureAndShareCard(ranking, rank, card)}
                      disabled={isCapturing}
                      className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-medium text-sm"
                    >
                      {isCapturing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {isShared ? 'Saved!' : 'Share image'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
              </div>
            );
          })()}

          <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 mb-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">What friends appreciate</h3>
            
            {rankings.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-900 dark:text-gray-100 font-medium text-sm">No appreciation shared yet.</p>
                <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">Be the first to share!</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {rankings.map((ranking, index) => {
                  const rank = index + 1;
                  const auraLevel = getAuraLevel(ranking.totalAura);
                  
                  return (
                    <div key={ranking.userId} className={`border rounded-md p-4 mb-3 ${
                      ranking.userId === user.uid 
                        ? 'border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-900' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-2 sm:gap-4">
                          {getRankBadge(rank)}
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                            {ranking.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-900 dark:text-gray-100 font-medium flex flex-wrap items-center gap-2 text-sm">
                              <span className="truncate">{ranking.displayName}</span>
                              {ranking.isCreator && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium whitespace-nowrap">
                                  Creator
                                </span>
                              )}
                              {ranking.userId === user.uid && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium whitespace-nowrap">
                                  You
                                </span>
                              )}
                            </div>
                            <div className={`text-xs sm:text-sm font-medium ${auraLevel.color}`}>
                              {auraLevel.level}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right sm:text-left">
                          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {ranking.totalAura.toLocaleString()}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs">
                            {ranking.totalPoints.toLocaleString()} + {ranking.baseAura} base
                          </div>
                        </div>
                      </div>

                      {/* Rating Details - Collapsible with Pagination */}
                      {ranking.ratingsReceived.length > 0 && (
                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                          <button
                            onClick={() => toggleRatings(ranking.userId)}
                            className="flex items-center justify-between w-full text-xs text-gray-600 dark:text-gray-400 mb-2 hover:text-gray-900 dark:hover:text-gray-200"
                          >
                            <span>
                              {ranking.ratingsReceived.length} friend{ranking.ratingsReceived.length !== 1 ? 's' : ''} shared what they appreciate
                            </span>
                            <svg 
                              className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform ${expandedRatings.includes(ranking.userId) ? 'rotate-180' : ''}`} 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {expandedRatings.includes(ranking.userId) && (
                            <div className="space-y-2">
                              {/* Paginated Ratings */}
                              {getPaginatedRatings(ranking.ratingsReceived, ranking.userId).map((rating, ratingIndex) => (
                                <div key={ratingIndex} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded p-3 gap-2">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <svg className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{rating.points} points</span>
                                    {rating.reason && (
                                      <span className="text-gray-500 dark:text-gray-400 truncate">- {rating.reason}</span>
                                    )}
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400 text-right sm:text-left">
                                    from {rating.fromUserDisplayName}
                                  </div>
                                </div>
                              ))}
                              
                              {/* Pagination Controls */}
                              {ranking.ratingsReceived.length > 10 && (
                                <div className="flex items-center justify-center gap-2 pt-2">
                                  <button
                                    onClick={() => changePage(ranking.userId, -1)}
                                    disabled={getCurrentPage(ranking.userId) === 1}
                                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700"
                                  >
                                    Previous
                                  </button>
                                  <span className="text-xs text-gray-600 dark:text-gray-400">
                                    Page {getCurrentPage(ranking.userId)} of {Math.ceil(ranking.ratingsReceived.length / 10)}
                                  </span>
                                  <button
                                    onClick={() => changePage(ranking.userId, 1)}
                                    disabled={getCurrentPage(ranking.userId) >= Math.ceil(ranking.ratingsReceived.length / 10)}
                                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700"
                                  >
                                    Next
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isVotingClosed(group, new Set(ratings.map(r => r.fromUserId)).size) && (
              <Link 
                href={`/group/${group.id}/rate`}
                className="px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-md hover:opacity-90 text-center text-sm"
              >
                Share Appreciation
              </Link>
            )}
            <Link 
              href="/my-groups"
              className="px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 text-center text-sm"
            >
              My Groups
            </Link>
          </div>
      </main>
    </div>
  );
} 