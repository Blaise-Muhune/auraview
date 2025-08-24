'use client';

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { getGlobalRankings, getGlobalStats, getAllFamousPeopleStats, FamousPerson } from "@/lib/firestore";

interface UserRanking {
  userId: string;
  displayName: string;
  totalAura: number;
  groupsJoined: number;
  ratingsReceived: number;
  isUnrated?: boolean;
}

interface GlobalStats {
  totalUsers: number;
  totalRatings: number;
  averageAura: number;
  highestAura: number;
}

interface TMDBPerson {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  popularity: number;
}

export default function Leaderboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [famousPeople, setFamousPeople] = useState<FamousPerson[]>([]);
  const [filteredFamousPeople, setFilteredFamousPeople] = useState<FamousPerson[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'famous'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [filteredRankings, setFilteredRankings] = useState<UserRanking[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const famousPeopleRef = useRef<FamousPerson[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus function
  const focusSearchInput = useCallback(() => {
    if (searchInputRef.current) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, []);

  // TMDB API configuration
  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || 'demo_key';
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w200';

  // Check if we have a valid API key
  const hasValidApiKey = TMDB_API_KEY && TMDB_API_KEY !== 'demo_key';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadLeaderboardData();
      loadFamousPeople();
    }
  }, [user, loading, router]);

  // Update ref when famousPeople changes
  useEffect(() => {
    famousPeopleRef.current = famousPeople;
  }, [famousPeople]);

  // Handle user search filtering
  useEffect(() => {
    if (userSearchQuery.trim()) {
      const filtered = rankings.filter(user => 
        user.displayName.toLowerCase().includes(userSearchQuery.toLowerCase())
      );
      
      setFilteredRankings(filtered);
      
      // Update current user rank in filtered results
      if (user) {
        const userRank = filtered.findIndex(ranking => ranking.userId === user.uid);
        setCurrentUserRank(userRank >= 0 ? userRank + 1 : null);
      }
    } else {
      setFilteredRankings(rankings);
      
      // Update current user rank in full results
      if (user) {
        const userRank = rankings.findIndex(ranking => ranking.userId === user.uid);
        setCurrentUserRank(userRank >= 0 ? userRank + 1 : null);
      }
    }
  }, [userSearchQuery, rankings, user]);

  const loadLeaderboardData = async () => {
    try {
      setIsLoading(true);
      const [rankingsData, statsData] = await Promise.all([
        getGlobalRankings(),
        getGlobalStats()
      ]);
      
      setRankings(rankingsData);
      setFilteredRankings(rankingsData);
      setStats(statsData);
      
      // Find current user's rank
      if (user) {
        const userRank = rankingsData.findIndex(ranking => ranking.userId === user.uid);
        setCurrentUserRank(userRank >= 0 ? userRank + 1 : null);
      }
    } catch (err) {
      console.error('Error loading leaderboard data:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFamousPeople = async () => {
    if (!hasValidApiKey) return;
    
    try {
      const famousPeopleData = await getAllFamousPeopleStats();
      
      // Fetch names for all famous people from TMDB
      const famousPeopleArray = await Promise.all(
        Object.entries(famousPeopleData)
          .filter(([_, data]) => data !== null)
          .map(async ([id, data]) => {
            try {
              // Fetch person details from TMDB
              const response = await fetch(`${TMDB_BASE_URL}/person/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
              if (response.ok) {
                const personData: TMDBPerson = await response.json();
                return {
                  id,
                  name: personData.name,
                  profession: personData.known_for_department || 'Celebrity',
                  imageUrl: personData.profile_path ? `${TMDB_IMAGE_BASE_URL}${personData.profile_path}` : '',
                  totalAura: data!.totalAura,
                  ratingsReceived: data!.ratingsReceived,
                  averageRating: data!.averageRating
                };
              } else {
                // Fallback if TMDB fetch fails
                return {
                  id,
                  name: `Person ${id}`,
                  profession: 'Celebrity',
                  imageUrl: '',
                  totalAura: data!.totalAura,
                  ratingsReceived: data!.ratingsReceived,
                  averageRating: data!.averageRating
                };
              }
            } catch (err) {
              console.error(`Error fetching person ${id}:`, err);
              // Fallback if TMDB fetch fails
              return {
                id,
                name: `Person ${id}`,
                profession: 'Celebrity',
                imageUrl: '',
                totalAura: data!.totalAura,
                ratingsReceived: data!.ratingsReceived,
                averageRating: data!.averageRating
              };
            }
          })
      );
      
      const sortedArray = famousPeopleArray.sort((a, b) => b.totalAura - a.totalAura);
      setFamousPeople(sortedArray);
      setFilteredFamousPeople(sortedArray);
    } catch (err) {
      console.error('Error loading famous people:', err);
    }
  };

  const sortFamousPeople = (people: FamousPerson[]) => {
    return [...people].sort((a, b) => b.totalAura - a.totalAura);
  };

  const searchFamousPeople = async (query: string) => {
    if (!query.trim() || !hasValidApiKey) {
      setFilteredFamousPeople(famousPeople);
      setError(null);
      setIsSearching(false);
      return;
    }

    setError(null);

    try {
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          setIsSearching(true);
          const response = await fetch(
            `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const searchResults = data.results.slice(0, 10).map((person: TMDBPerson) => ({
              id: person.id.toString(),
              name: person.name,
              profession: person.known_for_department || 'Actor',
              imageUrl: person.profile_path ? `${TMDB_IMAGE_BASE_URL}${person.profile_path}` : '',
              totalAura: 0,
              ratingsReceived: 0,
              averageRating: 0
            }));

            // Merge with existing famous people data and preserve actual rankings
            const mergedResults = searchResults.map((searchResult: FamousPerson) => {
              const existing = famousPeople.find(fp => fp.name.toLowerCase() === searchResult.name.toLowerCase());
              if (existing) {
                // Person exists in rankings, use their actual data
                return existing;
              } else {
                // New person not yet rated, mark them as unrated
                return {
                  ...searchResult,
                  totalAura: 0,
                  ratingsReceived: 0,
                  averageRating: 0,
                  isUnrated: true // Flag to indicate they haven't been rated yet
                };
              }
            });

            // Sort by actual aura score (unrated people go to the bottom)
            mergedResults.sort((a: FamousPerson, b: FamousPerson) => {
              if (a.isUnrated && !b.isUnrated) return 1; // Unrated people go last
              if (!a.isUnrated && b.isUnrated) return -1;
              return b.totalAura - a.totalAura; // Sort by aura score
            });

            setFilteredFamousPeople(mergedResults);
          } else {
            setFilteredFamousPeople([]);
          }
        } catch (error) {
          console.error('Error searching famous people:', error);
          setError('Failed to search famous people. Please try again.');
          setFilteredFamousPeople([]);
        } finally {
          setIsSearching(false);
        }
      }, 300); // 300ms debounce for better responsiveness
    } catch (error) {
      console.error('Error in search function:', error);
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchFamousPeople(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredFamousPeople(famousPeople);
    setError(null);
  };

  const clearUserSearch = () => {
    setUserSearchQuery('');
  };

  const handleTabChange = (tab: 'users' | 'famous') => {
    setActiveTab(tab);
    if (tab === 'famous') {
      focusSearchInput();
    }
  };

  const getAuraLevel = (totalAura: number) => {
    if (totalAura >= 5000) return { level: 'Legendary', color: 'text-purple-600', bgColor: 'bg-purple-50' };
    if (totalAura >= 3000) return { level: 'Epic', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (totalAura >= 1500) return { level: 'Rare', color: 'text-green-600', bgColor: 'bg-green-50' };
    if (totalAura >= 800) return { level: 'Common', color: 'text-gray-600', bgColor: 'bg-gray-50' };
    return { level: 'Basic', color: 'text-gray-500', bgColor: 'bg-gray-50' };
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          1st
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          2nd
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          3rd
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm">
        {rank}
      </div>
    );
  };

  const handleSignOut = async () => {
    try {
      // Assuming signOut is available from useAuth
      // You might need to add this to your useAuth hook
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center h-auto sm:h-16 py-4 sm:py-0 gap-4 sm:gap-0">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="Aura Logo" 
                width={32} 
                height={32} 
                className="rounded-lg"
              />
              <span className="text-xl sm:text-2xl font-bold text-gray-900">Aura</span>
            </Link>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
              {user && (
                <div className="flex items-center gap-3 order-1 sm:order-none">
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
              <div className="flex gap-2 w-full sm:w-auto">
                <Link href="/dashboard" className="flex-1 sm:flex-none px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700 text-center text-sm">
                  Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-red-300 text-red-600 text-center text-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Leaderboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="text-center text-gray-900 mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Global Rankings</h1>
          <p className="text-lg sm:text-xl text-gray-600">See who has the highest aura scores worldwide</p>
          {currentUserRank && (
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200 inline-block">
              <span className="text-blue-700 font-semibold text-sm sm:text-base">
                {userSearchQuery && currentUserRank > 20 
                  ? `Your Rank: #${currentUserRank} (not in top 20)`
                  : `Your Rank: #${currentUserRank}`
                }
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center text-gray-900 shadow-sm border border-gray-200">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">{stats.highestAura.toLocaleString()}</div>
              <div className="text-gray-500 text-xs sm:text-sm">Highest Score</div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center text-gray-900 shadow-sm border border-gray-200">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">{stats.averageAura.toLocaleString()}</div>
              <div className="text-gray-500 text-xs sm:text-sm">Average Score</div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center text-gray-900 shadow-sm border border-gray-200">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-2">{stats.totalUsers.toLocaleString()}</div>
              <div className="text-gray-500 text-xs sm:text-sm">Active Users</div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center text-gray-900 shadow-sm border border-gray-200">
              <div className="text-2xl sm:text-3xl font-bold text-orange-600 mb-2">{stats.totalRatings.toLocaleString()}</div>
              <div className="text-gray-500 text-xs sm:text-sm">Total Ratings</div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Global Rankings</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => handleTabChange('users')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'users' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Users
                </button>
                <button 
                  onClick={() => handleTabChange('famous')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'famous' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Famous People
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'users' ? (
            // Users Leaderboard
            <>
              {/* Search Bar for Users */}
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-200">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search users by name..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear search"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {userSearchQuery && (
                  <div className="mt-2 text-sm text-gray-500">
                    {filteredRankings.length === 0 
                      ? 'No users found' 
                      : `${filteredRankings.length} user${filteredRankings.length === 1 ? '' : 's'} found`
                    } for &quot;{userSearchQuery}&quot;
                  </div>
                )}
              </div>

              {filteredRankings.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Rankings Yet</h3>
                  <p className="text-gray-600 mb-6">Be the first to join and start building your aura!</p>
                  <Link href="/signup" className="inline-block px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                    Join the Rankings
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-4 px-3 sm:px-6 text-gray-700 font-semibold text-sm">Rank</th>
                        <th className="text-left py-4 px-3 sm:px-6 text-gray-700 font-semibold text-sm">User</th>
                        <th className="text-left py-4 px-3 sm:px-6 text-gray-700 font-semibold text-sm">Aura Score</th>
                        <th className="hidden sm:table-cell text-left py-4 px-6 text-gray-700 font-semibold text-sm">Groups</th>
                        <th className="hidden sm:table-cell text-left py-4 px-6 text-gray-700 font-semibold text-sm">Ratings</th>
                        <th className="text-left py-4 px-3 sm:px-6 text-gray-700 font-semibold text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRankings.slice(0, 20).map((userRanking, index) => {
                        // Calculate actual ranking based on global leaderboard position
                        const actualRank = rankings.findIndex(ranking => ranking.userId === userRanking.userId) + 1;
                        // If user is not found in global rankings (shouldn't happen with current logic, but safety check)
                        if (actualRank === 0) {
                          console.warn(`User ${userRanking.displayName} not found in global rankings`);
                        }
                        const auraLevel = getAuraLevel(userRanking.totalAura);
                        const isCurrentUser = user && userRanking.userId === user.uid;
                        
                        return (
                          <tr key={userRanking.userId} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            isCurrentUser ? 'bg-blue-50 border-blue-200' : ''
                          }`}>
                            <td className="py-4 px-3 sm:px-6">
                              {getRankBadge(actualRank)}
                            </td>
                            <td className="py-4 px-3 sm:px-6">
                              <div className="flex items-center gap-2 sm:gap-4">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                                  {userRanking.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-gray-900 font-medium flex items-center gap-2 text-sm sm:text-base">
                                    {userRanking.displayName}
                                    {isCurrentUser && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-xs sm:text-sm font-medium ${auraLevel.color}`}>
                                    {auraLevel.level} Aura
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-3 sm:px-6">
                              <div className="text-gray-900 font-bold text-base sm:text-lg">{userRanking.totalAura.toLocaleString()}</div>
                            </td>
                            <td className="hidden sm:table-cell py-4 px-6">
                              <div className="text-gray-600 text-sm">{userRanking.groupsJoined} groups</div>
                            </td>
                            <td className="hidden sm:table-cell py-4 px-6">
                              <div className="text-gray-600 text-sm">{userRanking.ratingsReceived} ratings</div>
                            </td>
                            <td className="py-4 px-3 sm:px-6">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Link 
                                  href={`/profile/${userRanking.userId}`}
                                  className="px-2 sm:px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs sm:text-sm hover:bg-gray-200 transition-colors font-medium text-center"
                                >
                                  View Profile
                                </Link>
                                {user && userRanking.userId !== user.uid && (
                                  <Link 
                                    href={`/rate-user/${userRanking.userId}`}
                                    className="px-2 sm:px-3 py-1.5 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors font-medium text-center"
                                  >
                                    Rate User
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            // Famous People Leaderboard
            <div className="px-4 sm:px-8 py-4 sm:py-6">
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search famous people..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {searchQuery && !isSearching && (
                      <button
                        onClick={clearSearch}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        title="Clear search"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {isSearching && (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>
                </div>
                {searchQuery && (
                  <div className="mt-2 text-sm text-gray-500">
                    {isSearching ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        Searching for &quot;{searchQuery}&quot;...
                      </span>
                    ) : (
                      <span>
                        {filteredFamousPeople.length === 0 
                          ? 'No results found' 
                          : `${filteredFamousPeople.length} result${filteredFamousPeople.length === 1 ? '' : 's'} found`
                        } for &quot;{searchQuery}&quot;
                      </span>
                    )}
                  </div>
                )}
                {error && (
                  <div className="mt-2 text-sm text-red-500">
                    {error}
                  </div>
                )}
              </div>

              {filteredFamousPeople.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {searchQuery ? 'No Results Found' : 'No Famous People Rankings Yet'}
                  </h3>
                  <p className="text-gray-600 mb-6 text-sm sm:text-base">
                    {searchQuery 
                      ? `No famous people found matching "${searchQuery}". Try a different search term.`
                      : !hasValidApiKey 
                        ? 'TMDB API key not configured. Please add NEXT_PUBLIC_TMDB_API_KEY to your environment variables to enable famous people search.'
                        : 'Stay tuned for the first famous person rankings!'
                    }
                  </p>
                  {!searchQuery && hasValidApiKey && (
                    <Link href="/signup" className="inline-block px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                      Join the Rankings
                    </Link>
                  )}
                  {!hasValidApiKey && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-800 text-sm">
                        <strong>Setup Required:</strong> Get a free API key from{' '}
                        <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">
                          The Movie Database
                        </a>
                        {' '}and add it to your .env.local file as NEXT_PUBLIC_TMDB_API_KEY
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-4 px-3 sm:px-6 text-gray-700 font-semibold text-sm">Rank</th>
                        <th className="text-left py-4 px-3 sm:px-6 text-gray-700 font-semibold text-sm">Famous Person</th>
                        <th className="text-left py-4 px-3 sm:px-6 text-gray-700 font-semibold text-sm">Aura Score</th>
                        <th className="hidden sm:table-cell text-left py-4 px-6 text-gray-700 font-semibold text-sm">Ratings</th>
                        <th className="text-left py-4 px-3 sm:px-6 text-gray-700 font-semibold text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFamousPeople.slice(0, 20).map((famousPerson, index) => {
                        // Calculate actual ranking based on global leaderboard position
                        let actualRank: number;
                        if (famousPerson.isUnrated) {
                          actualRank = -1; // -1 indicates unrated
                        } else {
                          // Find the actual rank in the global famous people list
                          const globalRank = famousPeople.findIndex(fp => fp.id === famousPerson.id);
                          actualRank = globalRank >= 0 ? globalRank + 1 : -1;
                        }
                        
                        const auraLevel = getAuraLevel(famousPerson.totalAura);
                        
                        return (
                          <tr key={famousPerson.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-3 sm:px-6">
                              {actualRank === -1 ? (
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-medium">
                                  NR
                                </div>
                              ) : (
                                getRankBadge(actualRank)
                              )}
                            </td>
                            <td className="py-4 px-3 sm:px-6">
                              <div className="flex items-center gap-2 sm:gap-4">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                                  {famousPerson.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-gray-900 font-medium flex items-center gap-2 text-sm sm:text-base">
                                    {famousPerson.name}
                                  </div>
                                  <div className={`text-xs sm:text-sm font-medium ${auraLevel.color}`}>
                                    {auraLevel.level} Aura
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-3 sm:px-6">
                              <div className="text-gray-900 font-bold text-base sm:text-lg">{famousPerson.totalAura.toLocaleString()}</div>
                            </td>
                            <td className="hidden sm:table-cell py-4 px-6">
                              <div className="text-gray-600 text-sm">{famousPerson.ratingsReceived} ratings</div>
                            </td>
                            <td className="py-4 px-3 sm:px-6">
                              <div className="flex gap-2">
                                <Link 
                                  href={`/rate-famous/${famousPerson.id}`}
                                  className="px-2 sm:px-3 py-1.5 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors font-medium text-center"
                                >
                                  Rate Person
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* How to Rank Section */}
        <div className="mt-8 sm:mt-12 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6 sm:mb-8">How to Get on the Leaderboard</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center text-gray-900">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h4 className="text-base sm:text-lg font-semibold mb-2">Build Your Network</h4>
              <p className="text-gray-600 text-xs sm:text-sm">Connect with more friends and expand your social circle to receive more aura points.</p>
            </div>
            <div className="text-center text-gray-900">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-base sm:text-lg font-semibold mb-2">Show Your Qualities</h4>
              <p className="text-gray-600 text-xs sm:text-sm">Demonstrate your personality, achievements, and character to earn higher rankings.</p>
            </div>
            <div className="text-center text-gray-900 sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-base sm:text-lg font-semibold mb-2">Stay Active</h4>
              <p className="text-gray-600 text-xs sm:text-sm">Regular engagement and positive interactions help maintain your aura score.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}