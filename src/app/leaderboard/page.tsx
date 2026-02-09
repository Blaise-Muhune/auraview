'use client';

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useSearchParams } from "next/navigation";
import { getLeaderboardData, getAllFamousPeopleStats, FamousPerson } from "@/lib/firestore";

interface UserRanking {
  userId: string;
  displayName: string;
  totalAura: number | null;
  groupsJoined: number;
  ratingsReceived: number;
  isUnrated?: boolean;
}

interface GlobalStats {
  totalUsers: number;
  totalRatings: number;
  averageAura: number | null;
  highestAura: number | null;
}

interface TMDBPerson {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  popularity: number;
}

function LeaderboardContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
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

  // Open Famous People tab when ?tab=famous (e.g. after rating a famous person)
  useEffect(() => {
    if (searchParams.get('tab') === 'famous') {
      setActiveTab('famous');
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    loadLeaderboardData();
    loadFamousPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when auth state is known
  }, [loading, user]);

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
      setError(null);
      const { rankings: rankingsData, stats: statsData } = await getLeaderboardData(
        user ? () => user.getIdToken() : () => Promise.resolve(undefined)
      );

      setRankings(rankingsData);
      setFilteredRankings(rankingsData);
      setStats(statsData);

      if (user) {
        const userRank = rankingsData.findIndex((r) => r.userId === user.uid);
        setCurrentUserRank(userRank >= 0 ? userRank + 1 : null);
      } else {
        setCurrentUserRank(null);
      }
    } catch (err) {
      console.error('Error loading leaderboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const getAuraLevel = (totalAura: number) => {
    if (totalAura >= 1_000_000) return { level: 'Elite', color: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/60' };
    if (totalAura >= 100_000) return { level: 'High', color: 'text-amber-600 dark:text-amber-500', border: 'border-amber-500/50' };
    if (totalAura >= 10_000) return { level: 'Rising', color: 'text-gray-700 dark:text-gray-300', border: 'border-gray-400 dark:border-gray-600' };
    if (totalAura >= 1_000) return { level: 'Building', color: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-600' };
    return { level: 'New', color: 'text-gray-500 dark:text-gray-500', border: 'border-gray-300 dark:border-gray-700' };
  };

  const getRankBadge = (rank: number) => (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-mono text-sm tabular-nums bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-700">
      {rank}
    </div>
  );

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading leaderboard...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref={user ? '/dashboard' : '/'} showAuth={!user} />

      <main className="max-w-2xl mx-auto px-5 py-10">
        {!user && (
          <div className="mb-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Create groups, get rated by friends, and climb the rankings.</p>
            <Link href="/signup" className="inline-block px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium rounded-xl hover:opacity-90">
              Get started free
            </Link>
          </div>
        )}
        <header className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Top auras</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Highest aura scores worldwide</p>
          {user && currentUserRank && (
            <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl inline-block bg-gray-50 dark:bg-gray-900">
              <span className="text-gray-900 dark:text-gray-100 font-medium text-sm">
                {userSearchQuery && currentUserRank > 20 
                  ? `Your Rank: #${currentUserRank} (not in top 20)`
                  : `Your Rank: #${currentUserRank}`
                }
              </span>
            </div>
          )}
        </header>

        {error && (
          <p className="mb-6 text-red-600 dark:text-red-400 text-sm">{error}</p>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center text-gray-900 dark:text-gray-100">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {stats.highestAura != null ? stats.highestAura.toLocaleString() : '—'}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Highest Score</div>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center text-gray-900 dark:text-gray-100">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {stats.averageAura != null ? stats.averageAura.toLocaleString() : '—'}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Average Score</div>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center text-gray-900 dark:text-gray-100">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{stats.totalUsers.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Active Users</div>
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center text-gray-900 dark:text-gray-100">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{stats.totalRatings.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Total Ratings</div>
            </div>
          </div>
        )}

        <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
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
                    placeholder="Search users by name..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
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
                  <Link href="/signup" className="inline-block px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 transition-opacity">
                    Join the Rankings
                  </Link>
                </div>
              ) : (
                <>
                {/* Podium – top 3 (1st center, 2nd left, 3rd right) */}
                {filteredRankings.length >= 3 && (() => {
                  const [second, first, third] = [
                    filteredRankings[1],
                    filteredRankings[0],
                    filteredRankings[2],
                  ];
                  const isUser1 = user && first.userId === user.uid;
                  const isUser2 = user && second.userId === user.uid;
                  const isUser3 = user && third.userId === user.uid;
                  const podiumHref = (r: UserRanking, isYou: boolean) => {
                    if (isYou) return user ? `/profile/${r.userId}` : `/login?redirect=${encodeURIComponent(`/profile/${r.userId}`)}`;
                    return user ? `/rate-user/${r.userId}` : `/login?redirect=${encodeURIComponent(`/rate-user/${r.userId}`)}`;
                  };
                  const PodiumSlot = ({ r, isYou, rank, bg, bgFoot }: { r: UserRanking; isYou: boolean; rank: number; bg: string; bgFoot: string }) => {
                    const href = podiumHref(r, isYou);
                    const h = rank === 1 ? 'h-20 sm:h-24' : rank === 2 ? 'h-14 sm:h-16' : 'h-10 sm:h-12';
                    const slotClass = 'flex flex-col items-center flex-1 max-w-[90px] sm:max-w-[110px]';
                    const content = (
                      <>
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-white font-semibold text-lg rounded-full mb-2 ${rank === 1 ? 'sm:w-16 sm:h-16 sm:text-xl' : ''} ${bg}`}>
                          {r.displayName.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="text-center mb-2 min-w-0 px-1">
                          <div className="text-[13px] text-gray-900 dark:text-gray-100 truncate max-w-full" title={r.displayName}>{r.displayName}</div>
                          {isYou && <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">You</span>}
                          <div className={`font-mono text-sm tabular-nums ${rank === 1 ? 'text-lg text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>{r.totalAura?.toLocaleString() ?? '—'}</div>
                        </div>
                        <div className={`w-full ${bg} ${h} rounded-t`} />
                        <div className={`w-full h-5 ${bgFoot} rounded-b flex items-center justify-center`}>
                          <span className="font-mono text-xs text-white/90">{rank}</span>
                        </div>
                      </>
                    );
                    if (href) {
                      return (
                        <Link href={href} className={`${slotClass} cursor-pointer hover:opacity-90 transition-opacity rounded-lg`}>
                          {content}
                        </Link>
                      );
                    }
                    return <div className={slotClass}>{content}</div>;
                  };
                  return (
                    <div className="py-8 px-4 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-end justify-center gap-1 sm:gap-3 max-w-sm mx-auto">
                        <PodiumSlot r={second} isYou={!!isUser2} rank={2} bg="bg-gray-500 dark:bg-gray-600" bgFoot="bg-gray-600 dark:bg-gray-700" />
                        <PodiumSlot r={first} isYou={!!isUser1} rank={1} bg="bg-amber-500 dark:bg-amber-600" bgFoot="bg-amber-600 dark:bg-amber-700" />
                        <PodiumSlot r={third} isYou={!!isUser3} rank={3} bg="bg-amber-700 dark:bg-amber-800" bgFoot="bg-amber-800 dark:bg-amber-900" />
                      </div>
                    </div>
                  );
                })()}

                {/* List: ranks 4+ (or all if &lt; 3) */}
                <div className="overflow-x-auto">
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(() => {
                      const listStart = filteredRankings.length >= 3 ? 3 : 0;
                      const start = (currentPage - 1) * RANKINGS_PER_PAGE;
                      const paginatedRankings = filteredRankings.slice(listStart).slice(start, start + RANKINGS_PER_PAGE);
                      return paginatedRankings.map((userRanking) => {
                      const actualRank = rankings.findIndex(ranking => ranking.userId === userRanking.userId) + 1;
                      if (actualRank === 0) console.warn(`User ${userRanking.displayName} not found in global rankings`);
                      const auraLevel = getAuraLevel(userRanking.totalAura ?? 0);
                      const isCurrentUser = user && userRanking.userId === user.uid;

                      return (
                        <div
                          key={userRanking.userId}
                          className={`flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 py-4 px-4 sm:px-6 hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors ${
                            isCurrentUser ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''
                          }`}
                        >
                          <div className="w-10 shrink-0">{getRankBadge(actualRank)}</div>
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                            <div className="shrink-0 w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-200 font-semibold text-sm rounded-full bg-gray-200 dark:bg-gray-700 ring-1 ring-gray-300 dark:ring-gray-600">
                              {userRanking.displayName.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-900 dark:text-gray-100 font-medium text-sm truncate">{userRanking.displayName}</span>
                                {isCurrentUser && (
                                  <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">You</span>
                                )}
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${auraLevel.border} ${auraLevel.color}`}>
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
                          <div className="text-gray-900 dark:text-gray-100 font-mono font-semibold text-lg tabular-nums">
                            {userRanking.totalAura != null ? userRanking.totalAura.toLocaleString() : '—'}
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={user ? `/profile/${userRanking.userId}` : `/login?redirect=${encodeURIComponent(`/profile/${userRanking.userId}`)}`}
                              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors py-1.5"
                            >
                              Profile
                            </Link>
                            {userRanking.userId !== user?.uid && (
                              <Link
                                href={user ? `/rate-user/${userRanking.userId}` : `/login?redirect=${encodeURIComponent(`/rate-user/${userRanking.userId}`)}`}
                                className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-1.5 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                              >
                                Rate
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    });
                    })()}
                  </div>
                </div>

                {/* Pagination */}
                {(() => {
                  const listStart = filteredRankings.length >= 3 ? 3 : 0;
                  const listCount = filteredRankings.length - listStart;
                  if (listCount <= RANKINGS_PER_PAGE) return null;
                  const totalPages = Math.ceil(listCount / RANKINGS_PER_PAGE);
                  return (
                    <div className="flex items-center justify-center gap-2 sm:gap-4 py-6 px-4 border-t border-gray-200 dark:border-gray-800">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  );
                })()}
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
                  {/* Podium – top 3 famous people */}
                  {(() => {
                    const top3Ranked = filteredFamousPeople.filter(f => !f.isUnrated).slice(0, 3);
                    if (top3Ranked.length < 3) return null;
                    const [second, first, third] = [top3Ranked[1], top3Ranked[0], top3Ranked[2]];
                    const FamousPodiumSlot = ({ fp, rank, bg, bgFoot }: { fp: FamousPerson; rank: number; bg: string; bgFoot: string }) => {
                      const href = user ? `/rate-famous/${fp.id}` : `/login?redirect=${encodeURIComponent(`/rate-famous/${fp.id}`)}`;
                      const h = rank === 1 ? 'h-20 sm:h-24' : rank === 2 ? 'h-14 sm:h-16' : 'h-10 sm:h-12';
                      const slotClass = 'flex flex-col items-center flex-1 max-w-[90px] sm:max-w-[110px] cursor-pointer hover:opacity-90 transition-opacity rounded-lg';
                      const content = (
                        <>
                          <div className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center overflow-hidden rounded-full mb-2 ${rank === 1 ? 'sm:w-16 sm:h-16' : ''} ${bg}`}>
                            {fp.imageUrl ? (
                              <Image src={fp.imageUrl} alt={fp.name} width={56} height={56} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-semibold text-lg">{fp.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="text-center mb-2 min-w-0 px-1">
                            <div className="text-[13px] text-gray-900 dark:text-gray-100 truncate max-w-full" title={fp.name}>{fp.name}</div>
                            <div className={`font-mono text-sm tabular-nums ${rank === 1 ? 'text-lg text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>{fp.totalAura.toLocaleString()}</div>
                          </div>
                          <div className={`w-full ${bg} ${h} rounded-t`} />
                          <div className={`w-full h-5 ${bgFoot} rounded-b flex items-center justify-center`}>
                            <span className="font-mono text-xs text-white/90">{rank}</span>
                          </div>
                        </>
                      );
                      return (
                        <Link key={fp.id} href={href} className={slotClass}>
                          {content}
                        </Link>
                      );
                    };
                    return (
                      <div className="py-8 px-4 border-b border-gray-200 dark:border-gray-800">
                        <div className="flex items-end justify-center gap-1 sm:gap-3 max-w-sm mx-auto">
                          <FamousPodiumSlot fp={second} rank={2} bg="bg-gray-500 dark:bg-gray-600" bgFoot="bg-gray-600 dark:bg-gray-700" />
                          <FamousPodiumSlot fp={first} rank={1} bg="bg-amber-500 dark:bg-amber-600" bgFoot="bg-amber-600 dark:bg-amber-700" />
                          <FamousPodiumSlot fp={third} rank={3} bg="bg-amber-700 dark:bg-amber-800" bgFoot="bg-amber-800 dark:bg-amber-900" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* List: famous people rank 4+ (or all if &lt; 3 ranked) */}
                  {(() => {
                    const top3Ranked = filteredFamousPeople.filter(f => !f.isUnrated).slice(0, 3);
                    const listStart = top3Ranked.length >= 3 ? 3 : 0;
                    const listPeople = listStart > 0
                      ? filteredFamousPeople.filter(f => !top3Ranked.some(t => t.id === f.id))
                      : filteredFamousPeople;
                    const start = (famousPage - 1) * RANKINGS_PER_PAGE;
                    const paginated = listPeople.slice(start, start + RANKINGS_PER_PAGE);
                    const totalListPages = Math.ceil(listPeople.length / RANKINGS_PER_PAGE);

                    return (
                      <>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {paginated.map((fp) => {
                            const actualRank = fp.isUnrated ? -1 : (famousPeople.findIndex(f => f.id === fp.id) + 1);
                            const auraLevel = getAuraLevel(fp.totalAura);
                            return (
                              <div key={fp.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 py-4 px-4 sm:px-6 hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                                <div className="w-10 shrink-0">
                                  {actualRank === -1 ? (
                                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-mono">NR</div>
                                  ) : (
                                    getRankBadge(actualRank)
                                  )}
                                </div>
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden flex items-center justify-center bg-gray-300 dark:bg-gray-600 ring-1 ring-gray-200 dark:ring-gray-600">
                                    {fp.imageUrl ? (
                                      <Image src={fp.imageUrl} alt={fp.name} width={48} height={48} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-gray-600 dark:text-gray-300 font-semibold text-sm">{fp.name.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium text-sm">{fp.name}</span>
                                    <span className={`ml-2 text-[11px] font-medium px-2 py-0.5 rounded-md border ${auraLevel.border} ${auraLevel.color}`}>{auraLevel.level}</span>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fp.ratingsReceived} ratings</div>
                                  </div>
                                </div>
                                <div className="text-gray-900 dark:text-gray-100 font-mono font-semibold text-lg tabular-nums">{fp.totalAura.toLocaleString()}</div>
                                <Link href={user ? `/rate-famous/${fp.id}` : `/login?redirect=${encodeURIComponent(`/rate-famous/${fp.id}`)}`} className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                                  Rate
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                        {totalListPages > 1 && (
                          <div className="flex items-center justify-center gap-2 sm:gap-4 py-6 px-4 border-t border-gray-200 dark:border-gray-800">
                            <button onClick={() => setFamousPage(p => Math.max(1, p - 1))} disabled={famousPage <= 1} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                              Previous
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Page {famousPage} of {totalListPages}</span>
                            <button onClick={() => setFamousPage(p => Math.min(totalListPages, p + 1))} disabled={famousPage >= totalListPages} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
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
              <Link href="/signup" className="inline-block px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:opacity-90">
                Join and climb the rankings
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Leaderboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav />
        <main className="max-w-xl mx-auto px-5 py-10 flex items-center justify-center">
          <span className="text-gray-500 dark:text-gray-400">Loading...</span>
        </main>
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
} 