'use client';

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
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
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [filteredRankings, setFilteredRankings] = useState<UserRanking[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [famousPeople, setFamousPeople] = useState<FamousPerson[]>([]);
  const [filteredFamousPeople, setFilteredFamousPeople] = useState<FamousPerson[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'famous'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [famousPage, setFamousPage] = useState(1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const famousPeopleRef = useRef<FamousPerson[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const RANKINGS_PER_PAGE = 50;
  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || 'demo_key';
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w200';
  const hasValidApiKey = TMDB_API_KEY && TMDB_API_KEY !== 'demo_key';

  const focusSearchInput = useCallback(() => {
    if (searchInputRef.current) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    loadLeaderboardData();
    loadFamousPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when auth state is known
  }, [loading]);

  useEffect(() => {
    famousPeopleRef.current = famousPeople;
  }, [famousPeople]);

  // Handle user search filtering
  useEffect(() => {
    setCurrentPage(1);
    if (userSearchQuery.trim()) {
      const filtered = rankings.filter(r => 
        r.displayName.toLowerCase().includes(userSearchQuery.toLowerCase())
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

  const loadFamousPeople = async () => {
    if (!hasValidApiKey) return;
    try {
      const famousPeopleData = await getAllFamousPeopleStats();
      const famousPeopleArray = await Promise.all(
        Object.entries(famousPeopleData)
          .filter(([, data]) => data !== null)
          .map(async ([id, data]) => {
            try {
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
                  averageRating: data!.averageRating,
                };
              }
            } catch {
              // fallback
            }
            return {
              id,
              name: `Person ${id}`,
              profession: 'Celebrity',
              imageUrl: '',
              totalAura: data!.totalAura,
              ratingsReceived: data!.ratingsReceived,
              averageRating: data!.averageRating,
            };
          })
      );
      const sorted = famousPeopleArray.sort((a, b) => b.totalAura - a.totalAura);
      setFamousPeople(sorted);
      setFilteredFamousPeople(sorted);
    } catch {
      // ignore
    }
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
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          setIsSearching(true);
          const response = await fetch(
            `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`
          );
          if (!response.ok) throw new Error('Search failed');
          const data = await response.json();
          if (data.results?.length > 0) {
            const searchResults = data.results.slice(0, 10).map((person: TMDBPerson) => ({
              id: person.id.toString(),
              name: person.name,
              profession: person.known_for_department || 'Actor',
              imageUrl: person.profile_path ? `${TMDB_IMAGE_BASE_URL}${person.profile_path}` : '',
              totalAura: 0,
              ratingsReceived: 0,
              averageRating: 0,
            }));
            const merged = searchResults.map((sr: FamousPerson) => {
              const existing = famousPeople.find(fp => fp.name.toLowerCase() === sr.name.toLowerCase());
              if (existing) return existing;
              return { ...sr, isUnrated: true };
            });
            merged.sort((a: FamousPerson, b: FamousPerson) => {
              if (a.isUnrated && !b.isUnrated) return 1;
              if (!a.isUnrated && b.isUnrated) return -1;
              return b.totalAura - a.totalAura;
            });
            setFilteredFamousPeople(merged);
          } else {
            setFilteredFamousPeople([]);
          }
        } catch {
          setError('Failed to search');
          setFilteredFamousPeople([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } catch {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    searchFamousPeople(q);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredFamousPeople(famousPeople);
    setError(null);
  };

  const handleTabChange = (tab: 'users' | 'famous') => {
    setActiveTab(tab);
    if (tab === 'famous') focusSearchInput();
  };

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

  const getAuraLevel = (totalAura: number) => {
    if (totalAura >= 10_000_000) return { level: 'Celestial', color: 'text-amber-200 dark:text-amber-300', gradient: 'from-amber-400 via-yellow-300 to-amber-500', glow: 'shadow-amber-500/30', ring: 'ring-amber-400/60', border: 'border-amber-400', borderAccent: 'border-amber-400/60' };
    if (totalAura >= 5_000_000) return { level: 'Mythic', color: 'text-purple-600 dark:text-purple-400', gradient: 'from-purple-500 via-fuchsia-500 to-purple-600', glow: 'shadow-purple-500/25', ring: 'ring-purple-400/60', border: 'border-purple-400', borderAccent: 'border-purple-400/60' };
    if (totalAura >= 2_500_000) return { level: 'Legendary', color: 'text-violet-600 dark:text-violet-400', gradient: 'from-violet-500 via-purple-500 to-indigo-600', glow: 'shadow-violet-500/25', ring: 'ring-violet-400/60', border: 'border-violet-400', borderAccent: 'border-violet-400/60' };
    if (totalAura >= 1_000_000) return { level: 'Dazzling', color: 'text-indigo-600 dark:text-indigo-400', gradient: 'from-indigo-500 to-blue-600', glow: 'shadow-indigo-500/20', ring: 'ring-indigo-400/60', border: 'border-indigo-400', borderAccent: 'border-indigo-400/60' };
    if (totalAura >= 500_000) return { level: 'Brilliant', color: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500 to-cyan-500', glow: 'shadow-blue-500/20', ring: 'ring-blue-400/60', border: 'border-blue-400', borderAccent: 'border-blue-400/60' };
    if (totalAura >= 250_000) return { level: 'Luminous', color: 'text-cyan-600 dark:text-cyan-400', gradient: 'from-cyan-500 to-teal-500', glow: 'shadow-cyan-500/20', ring: 'ring-cyan-400/60', border: 'border-cyan-400', borderAccent: 'border-cyan-400/60' };
    if (totalAura >= 100_000) return { level: 'Radiant', color: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500 to-emerald-500', glow: 'shadow-teal-500/20', ring: 'ring-teal-400/60', border: 'border-teal-400', borderAccent: 'border-teal-400/60' };
    if (totalAura >= 10_000) return { level: 'Shimmer', color: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500 to-green-500', glow: 'shadow-emerald-500/15', ring: 'ring-emerald-400/60', border: 'border-emerald-400', borderAccent: 'border-emerald-400/60' };
    if (totalAura >= 1_000) return { level: 'Glow', color: 'text-green-600 dark:text-green-400', gradient: 'from-green-500 to-lime-500', glow: 'shadow-green-500/15', ring: 'ring-green-400/60', border: 'border-green-400', borderAccent: 'border-green-400/60' };
    if (totalAura >= 100) return { level: 'Spark', color: 'text-lime-600 dark:text-lime-400', gradient: 'from-lime-500 to-yellow-500', glow: 'shadow-lime-500/10', ring: 'ring-lime-400/50', border: 'border-lime-400', borderAccent: 'border-lime-400/60' };
    return { level: 'Kindling', color: 'text-gray-500 dark:text-gray-400', gradient: 'from-gray-400 to-gray-500', glow: '', ring: 'ring-gray-400/40', border: 'border-gray-300 dark:border-gray-600', borderAccent: 'border-gray-400/60' };
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-amber-950 shadow-md shadow-amber-500/25 ring-2 ring-amber-400/50 dark:ring-amber-500/30">
          1st
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 text-slate-900 shadow-md shadow-slate-400/25 ring-2 ring-slate-300/50 dark:ring-slate-500/30">
          2nd
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-amber-100 shadow-md shadow-amber-700/25 ring-2 ring-amber-600/50 dark:ring-amber-600/30">
          3rd
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-700">
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
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading leaderboard...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav 
        showBack 
        backHref={user ? '/dashboard' : '/'} 
        showAuth={!user}
        rightContent={user ? (
          <button
            onClick={handleSignOut}
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700"
          >
            Sign out
          </button>
        ) : undefined}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!user && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-center">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">Create groups, get rated by friends, and climb the rankings.</p>
            <Link href="/signup" className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              Get started free
            </Link>
          </div>
        )}
        <div className="text-center text-gray-900 dark:text-gray-100 mb-8">
          <h1 className="text-2xl font-bold mb-2">Top auras</h1>
          <p className="text-gray-600 dark:text-gray-400">Highest aura scores worldwide</p>
          {user && currentUserRank && (
            <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md inline-block bg-gray-50 dark:bg-gray-900">
              <span className="text-gray-900 dark:text-gray-100 font-medium text-sm">
                {userSearchQuery && currentUserRank > 20 
                  ? `Your Rank: #${currentUserRank} (not in top 20)`
                  : `Your Rank: #${currentUserRank}`
                }
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="mb-6 text-red-600 dark:text-red-400 text-sm">{error}</p>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 text-center text-gray-900 dark:text-gray-100">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{stats.highestAura.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Highest Score</div>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 text-center text-gray-900 dark:text-gray-100">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{stats.averageAura.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Average Score</div>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 text-center text-gray-900 dark:text-gray-100">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{stats.totalUsers.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Active Users</div>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 text-center text-gray-900 dark:text-gray-100">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{stats.totalRatings.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Total Ratings</div>
            </div>
          </div>
        )}

        <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Global Rankings</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleTabChange('users')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'users'
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => handleTabChange('famous')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'famous'
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  Famous People
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'users' ? (
          <>
              {/* Search Bar for Users */}
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-200 dark:border-gray-800">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder={user ? "Search users by name..." : "Log in to search"}
                    value={userSearchQuery}
                    onChange={(e) => user && setUserSearchQuery(e.target.value)}
                    disabled={!user}
                    className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Clear search"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {userSearchQuery && (
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {filteredRankings.length === 0 
                      ? 'No users found' 
                      : `${filteredRankings.length} user${filteredRankings.length === 1 ? '' : 's'} found`
                    } for &quot;{userSearchQuery}&quot;
                  </div>
                )}
              </div>

              {filteredRankings.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Rankings Yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">Be the first to join and start building your aura!</p>
                  <Link href="/signup" className="inline-block px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:opacity-90 transition-opacity">
                    Join the Rankings
                  </Link>
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(() => {
                      const start = (currentPage - 1) * RANKINGS_PER_PAGE;
                      const paginatedRankings = filteredRankings.slice(start, start + RANKINGS_PER_PAGE);
                      return paginatedRankings.map((userRanking) => {
                      const actualRank = rankings.findIndex(ranking => ranking.userId === userRanking.userId) + 1;
                      if (actualRank === 0) console.warn(`User ${userRanking.displayName} not found in global rankings`);
                      const auraLevel = getAuraLevel(userRanking.totalAura);
                      const isCurrentUser = user && userRanking.userId === user.uid;
                      const isTop15 = actualRank >= 1 && actualRank <= 15;
                      const isPodium = actualRank <= 3;

                      const rowContent = (
                        <div className={`flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 py-4 px-4 sm:px-6 hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors ${
                          isCurrentUser ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''
                        }`}>
                          <div className="w-10 shrink-0">{getRankBadge(actualRank)}</div>
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                            <div className={`shrink-0 flex items-center justify-center text-white font-semibold text-sm overflow-hidden rounded-full ${
                              isTop15 ? `w-12 h-12 sm:w-14 sm:h-14 ring-2 ring-offset-2 dark:ring-offset-gray-950 ${auraLevel.ring} shadow-lg ${auraLevel.glow} bg-gradient-to-br ${auraLevel.gradient}` : `w-10 h-10 bg-gradient-to-br ${auraLevel.gradient}`
                            }`}>
                              {userRanking.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-900 dark:text-gray-100 font-medium text-sm truncate">{userRanking.displayName}</span>
                                {isCurrentUser && (
                                  <span className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-medium opacity-90">You</span>
                                )}
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${auraLevel.border} ${auraLevel.color} bg-white/50 dark:bg-black/20 backdrop-blur-sm`}>
                                  {auraLevel.level}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                <span>{userRanking.groupsJoined} groups</span>
                                <span>·</span>
                                <span>{userRanking.ratingsReceived} ratings</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-gray-900 dark:text-gray-100 font-bold text-lg tabular-nums">{userRanking.totalAura.toLocaleString()}</div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/profile/${userRanking.userId}`}
                              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors py-1.5"
                            >
                              Profile
                            </Link>
                            {userRanking.userId !== user?.uid && (
                              <Link
                                href={user ? `/rate-user/${userRanking.userId}` : `/login?redirect=${encodeURIComponent(`/rate-user/${userRanking.userId}`)}`}
                                className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-1.5 px-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                              >
                                Rate
                              </Link>
                            )}
                          </div>
                        </div>
                      );

                      if (isTop15) {
                        return (
                          <div
                            key={userRanking.userId}
                            className={`relative overflow-hidden ${
                              isPodium
                                ? 'bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 dark:from-amber-500/10 dark:via-transparent dark:to-amber-500/10'
                                : 'bg-gradient-to-r from-gray-500/5 via-transparent to-gray-500/5 dark:from-gray-500/10 dark:via-transparent dark:to-gray-500/10'
                            }`}
                          >
                            {isPodium && (
                              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(251,191,36,0.03)_50%,transparent_100%)] dark:bg-[linear-gradient(90deg,transparent_0%,rgba(251,191,36,0.06)_50%,transparent_100%)]" />
                            )}
                            <div className={`relative border-l-2 sm:border-l-4 ${
                              actualRank === 1 ? 'border-amber-400' :
                              actualRank === 2 ? 'border-slate-400' :
                              actualRank === 3 ? 'border-amber-600' :
                              auraLevel.borderAccent
                            }`}>
                              {rowContent}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={userRanking.userId}>
                          {rowContent}
                        </div>
                      );
                    });
                    })()}
                  </div>
                </div>

                {/* Pagination */}
                {filteredRankings.length > RANKINGS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 sm:gap-4 py-6 px-4 border-t border-gray-200 dark:border-gray-800">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {currentPage} of {Math.ceil(filteredRankings.length / RANKINGS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredRankings.length / RANKINGS_PER_PAGE), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredRankings.length / RANKINGS_PER_PAGE)}
                      className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
                </>
              )}
          </>
          ) : (
            <div className="px-4 sm:px-8 py-4 sm:py-6">
              <div className="mb-6">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={user ? "Search famous people..." : "Log in to search"}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    disabled={!user}
                    className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {searchQuery && !isSearching && (
                      <button onClick={clearSearch} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1" title="Clear">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {isSearching && (
                      <div className="w-5 h-5 border-2 border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </div>
                {searchQuery && (
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {isSearching ? 'Searching...' : `${filteredFamousPeople.length} result${filteredFamousPeople.length !== 1 ? 's' : ''} found`}
                  </div>
                )}
              </div>

              <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  Still light on votes. Share it with friends and get them to add who they appreciate. It helps make the rankings feel real.
                </p>
              </div>

              {filteredFamousPeople.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {searchQuery ? 'No Results Found' : !hasValidApiKey ? 'Setup Required' : 'No Famous People Rankings Yet'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                    {searchQuery ? 'Try a different search term.' : !hasValidApiKey
                      ? 'Add NEXT_PUBLIC_TMDB_API_KEY to enable famous people.'
                      : 'Stay tuned for the first rankings!'}
                  </p>
                  {!searchQuery && hasValidApiKey && (
                    <Link href="/signup" className="inline-block px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:opacity-90">
                      Join to Rate Celebrities
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(() => {
                      const start = (famousPage - 1) * RANKINGS_PER_PAGE;
                      const paginated = filteredFamousPeople.slice(start, start + RANKINGS_PER_PAGE);
                      return paginated.map((fp) => {
                        const actualRank = fp.isUnrated ? -1 : (famousPeople.findIndex(f => f.id === fp.id) + 1);
                        const auraLevel = getAuraLevel(fp.totalAura);
                        const isTop15 = actualRank >= 1 && actualRank <= 15;
                        const isPodium = actualRank <= 3;
                        const row = (
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 py-4 px-4 sm:px-6 hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                            <div className="w-10 shrink-0">
                              {actualRank === -1 ? (
                                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-medium">NR</div>
                              ) : (
                                getRankBadge(actualRank)
                              )}
                            </div>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white font-semibold text-sm rounded-full bg-gradient-to-br ${auraLevel.gradient}`}>
                                {fp.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-gray-900 dark:text-gray-100 font-medium text-sm">{fp.name}</span>
                                <span className={`ml-2 text-[11px] font-medium px-2 py-0.5 rounded-md border ${auraLevel.border} ${auraLevel.color}`}>{auraLevel.level}</span>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fp.ratingsReceived} ratings</div>
                              </div>
                            </div>
                            <div className="text-gray-900 dark:text-gray-100 font-bold text-lg tabular-nums">{fp.totalAura.toLocaleString()}</div>
                            <Link href={user ? `/rate-famous/${fp.id}` : `/login?redirect=${encodeURIComponent(`/rate-famous/${fp.id}`)}`} className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                              Rate
                            </Link>
                          </div>
                        );
                        if (isTop15 && actualRank > 0) {
                          return (
                            <div key={fp.id} className={`relative ${isPodium ? 'bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5' : 'bg-gradient-to-r from-gray-500/5 via-transparent to-gray-500/5'}`}>
                              <div className={`border-l-2 sm:border-l-4 ${actualRank === 1 ? 'border-amber-400' : actualRank === 2 ? 'border-slate-400' : actualRank === 3 ? 'border-amber-600' : auraLevel.borderAccent}`}>
                                {row}
                              </div>
                            </div>
                          );
                        }
                        return <div key={fp.id}>{row}</div>;
                      });
                    })()}
                  </div>
                  {filteredFamousPeople.length > RANKINGS_PER_PAGE && (
                    <div className="flex items-center justify-center gap-2 sm:gap-4 py-6 px-4 border-t border-gray-200 dark:border-gray-800">
                      <button onClick={() => setFamousPage(p => Math.max(1, p - 1))} disabled={famousPage <= 1} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        Previous
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Page {famousPage} of {Math.ceil(filteredFamousPeople.length / RANKINGS_PER_PAGE)}</span>
                      <button onClick={() => setFamousPage(p => Math.min(Math.ceil(filteredFamousPeople.length / RANKINGS_PER_PAGE), p + 1))} disabled={famousPage >= Math.ceil(filteredFamousPeople.length / RANKINGS_PER_PAGE)} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* How to Rank Section */}
        <div className="mt-8 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-6">How to Get on the Leaderboard</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Build Your Network</h4>
              <p className="text-gray-600 dark:text-gray-400 text-xs">Connect with friends to receive more aura points.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Show Your Qualities</h4>
              <p className="text-gray-600 dark:text-gray-400 text-xs">Demonstrate your personality and achievements.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Stay Active</h4>
              <p className="text-gray-600 dark:text-gray-400 text-xs">Regular engagement maintains your score.</p>
            </div>
          </div>
          {!user && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
              <Link href="/signup" className="inline-block px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-md hover:opacity-90">
                Join and climb the rankings
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}