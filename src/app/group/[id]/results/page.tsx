'use client';

import Link from "next/link";
import { useRef, useMemo, useCallback } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { getGroupById, getGroupRatings, getUserProfilesByIds, getUserDisplayName, isVotingClosed, Rating, GroupSession, UserProfile, getSlotId, isSlotId } from "@/lib/firestore";
import { generateRankCard } from "@/lib/insights";
import { ShareableCard } from "@/components/ShareableCard";

/** Same score = same rank; next distinct score gets next rank (e.g. 1, 2, 2, 4). */
function getDisplayRanks<T>(sortedList: T[], getScore: (item: T) => number): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < sortedList.length; i++) {
    if (i === 0) ranks.push(1);
    else {
      const prev = getScore(sortedList[i - 1]!);
      const curr = getScore(sortedList[i]!);
      ranks.push(prev === curr ? ranks[i - 1]! : i + 1);
    }
  }
  return ranks;
}

interface ResultsPageProps {
  params: Promise<{
    id: string;
  }>;
}

const GROUP_SORT_OPTIONS = [
  { value: 'total', label: 'Total Aura' },
  { value: 'presence_energy', label: 'Room presence' },
  { value: 'authenticity_self_vibe', label: 'Authenticity' },
  { value: 'social_pull', label: 'Vibe' },
  { value: 'style_aesthetic', label: 'Style' },
  { value: 'trustworthy', label: 'Trustworthy' },
] as const;

interface UserRanking {
  userId: string;
  displayName: string;
  totalPoints: number;
  baseAura: number;
  totalAura: number;
  ratingsReceived: Rating[];
  isCreator: boolean;
  questionTotals?: { [key: string]: number };
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
  const [, setSharedCardUserId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showMyCardModal, setShowMyCardModal] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('total');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const getScoreForSort = useCallback((r: UserRanking) =>
    sortBy === 'total' ? r.totalAura : (r.questionTotals?.[sortBy] ?? 0), [sortBy]);

  const filteredRankings = useMemo(() => {
    const list = [...rankings];
    list.sort((a, b) => getScoreForSort(b) - getScoreForSort(a));
    return list;
  }, [rankings, getScoreForSort]);

  const displayRanks = useMemo(() => getDisplayRanks(filteredRankings, getScoreForSort), [filteredRankings, getScoreForSort]);

  const displayRanksByTotal = useMemo(() => getDisplayRanks(rankings, r => r.totalAura), [rankings]);

  const handleShareProfile = async () => {
    if (!user) return;
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/rate-user/${user.uid}`;
    const message = 'Give me your honest feedback on Aura — a quick app where friends rate each other. Rate me here: ' + url;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Rate me on Aura', text: message, url });
        setShareFeedback('Shared!');
      } else {
        await navigator.clipboard?.writeText(message);
        setShareFeedback('Message copied!');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        try {
          await navigator.clipboard?.writeText(message);
          setShareFeedback('Message copied!');
        } catch {
          setShareFeedback('Could not share');
        }
      }
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/leaderboard');
      return;
    }

    if (user && id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData runs on auth/group change
  }, [user, loading, id, router]);

  const loadData = async () => {
    if (!user || !id) return;
    try {
      const [groupData, ratingsData] = await Promise.all([
        getGroupById(id),
        getGroupRatings(id),
      ]);

      if (!groupData) {
        setError('Group not found');
        return;
      }

      setGroup(groupData);
      setRatings(ratingsData);

      const userProfiles = await getUserProfilesByIds(groupData.participants);
      await calculateRankings(groupData, ratingsData, userProfiles);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading group data:', err);
      }
      setError(err instanceof Error ? err.message : 'Failed to load group data');
    } finally {
      setIsLoading(false);
    }
  };

  const QUESTION_IDS = ['presence_energy', 'authenticity_self_vibe', 'social_pull', 'style_aesthetic', 'trustworthy'] as const;

  const calculateRankings = async (groupData: GroupSession, ratingsData: Rating[], userProfiles: UserProfile[]) => {
    const userTotals = new Map<string, { points: number; ratings: Rating[] }>();

    const targets: string[] =
      groupData.slots && groupData.slots.length > 0
        ? groupData.slots.map((s, i) => (s.userId ? s.userId : getSlotId(groupData.id!, i)))
        : groupData.participants;

    targets.forEach((targetId) => {
      userTotals.set(targetId, { points: 0, ratings: [] });
    });

    ratingsData.forEach((rating) => {
      const current = userTotals.get(rating.toUserId);
      if (current) {
        current.points += rating.points;
        current.ratings.push(rating);
      }
    });

    const buildQuestionTotals = (ratingsList: Rating[]): { [key: string]: number } => {
      const totals: { [key: string]: number } = {};
      for (const qid of QUESTION_IDS) {
        totals[qid] = 0;
      }
      ratingsList.forEach((r) => {
        if (r.questionScores && typeof r.questionScores === 'object') {
          for (const qid of QUESTION_IDS) {
            const val = r.questionScores[qid];
            if (typeof val === 'number') totals[qid] = (totals[qid] ?? 0) + val;
          }
        }
      });
      return totals;
    };

    const userProfileMap = new Map<string, UserProfile>();
    userProfiles.forEach((profile) => {
      userProfileMap.set(profile.id, profile);
    });

    const rankingsPromises = Array.from(userTotals.entries()).map(async ([targetId, data]) => {
      const questionTotals = buildQuestionTotals(data.ratings);
      if (isSlotId(targetId)) {
        const match = targetId.match(/^slot:[^:]+:(\d+)$/);
        const slotIndex = match ? parseInt(match[1], 10) : -1;
        const slot = groupData.slots?.[slotIndex];
        const displayName = slot?.displayName ?? slot?.label ?? 'Unknown';
        return {
          userId: targetId,
          displayName,
          totalPoints: data.points,
          baseAura: 500,
          totalAura: 500 + data.points,
          ratingsReceived: data.ratings,
          isCreator: false,
          questionTotals,
        };
      }

      const profile = userProfileMap.get(targetId);
      if (profile?.showOnGroupLeaderboard === false) return null;

      let displayName: string;
      if (profile?.groupLeaderboardAnonymous) {
        displayName = 'Anonymous';
      } else if (groupData.participantDisplayNames?.[targetId]) {
        displayName = groupData.participantDisplayNames[targetId];
      } else if (targetId === groupData.createdBy) {
        displayName = groupData.createdByDisplayName;
      } else {
        displayName = await getUserDisplayName(targetId);
      }

      return {
        userId: targetId,
        displayName,
        totalPoints: data.points,
        baseAura: 500,
        totalAura: 500 + data.points,
        ratingsReceived: data.ratings,
        isCreator: targetId === groupData.createdBy,
        questionTotals,
      };
    });

    const rankingsArray = (await Promise.all(rankingsPromises)).filter((r): r is NonNullable<typeof r> => r !== null);
    rankingsArray.sort((a, b) => b.totalAura - a.totalAura);
    setRankings(rankingsArray);
  };

  const getRankBadge = (rank: number) => (
    <div className={`w-8 h-8 flex items-center justify-center font-mono text-[12px] tabular-nums ${
      rank === 1 ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    }`}>
      {rank}
    </div>
  );

  const captureCard = async (
    ranking: UserRanking,
    rank: number,
    mode: 'share' | 'download',
    onSuccess?: () => void
  ) => {
    const el = cardRefs.current[ranking.userId];
    if (!el) return;
    const card = generateRankCard({
      rank,
      totalInGroup: rankings.length,
      groupName: group!.name,
      displayName: ranking.displayName,
      totalAura: ranking.totalAura,
    });
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#0f172a',
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsCapturing(false);
          return;
        }
        const file = new File([blob], `aura-${ranking.displayName.replace(/\s/g, '-')}-rank-${rank}.png`, { type: 'image/png' });
        if (mode === 'share' && navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `${ranking.displayName}'s Aura`,
            text: `${card.headline} — See yours at auraview.app`,
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
        onSuccess?.();
      }, 'image/png', 1);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Capture failed:', err);
      }
    } finally {
      setIsCapturing(false);
    }
  };


  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center gap-6">
        <div className="w-px h-8 bg-gray-400 dark:bg-gray-500 animate-pulse" />
        <span className="text-gray-500 dark:text-gray-400 text-sm tracking-wide">Loading</span>
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
        <main className="max-w-md mx-auto px-5 py-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Group Not Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{error || 'The group you are looking for does not exist.'}</p>
          <Link href="/dashboard" className="inline-block px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 text-[13px]">
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/my-groups" />

      <main className="max-w-xl mx-auto px-5 py-10">
          <header className="mb-10 results-item" style={{ animationDelay: '0.02s' }}>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Results
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{group.name}</p>
            {(() => {
              const uniqueVoters = new Set(ratings.map(r => r.fromUserId)).size;
              const votingClosed = isVotingClosed(group, uniqueVoters);
              if (!votingClosed) {
                return (
                  <p className="mt-4 text-[13px] text-amber-600 dark:text-amber-400 border-l-2 border-amber-500 pl-3">
                    Voting is still open. Shareable cards appear when it closes.
                  </p>
                );
              }
              return null;
            })()}
          </header>

          {/* Podium – flat, sculptural (top 3 by current sort) */}
          {filteredRankings.length >= 3 && (
            <div className="mb-12 results-item" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-end justify-center gap-1 sm:gap-2">
                <div className="flex flex-col items-center flex-1 max-w-[90px]">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-600 dark:bg-gray-600 flex items-center justify-center text-white font-semibold text-lg mb-2">
                    {filteredRankings[1]?.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center mb-2">
                    <div className="text-[13px] text-gray-900 dark:text-gray-200 truncate max-w-full" title={filteredRankings[1]?.displayName}>
                      {filteredRankings[1]?.displayName}
                    </div>
                    <div className="font-mono text-lg tabular-nums text-gray-500 dark:text-gray-400">{sortBy === 'total' ? `${filteredRankings[1]?.totalAura.toLocaleString()} aura` : (filteredRankings[1]?.questionTotals?.[sortBy] ?? 0).toLocaleString()}</div>
                    {filteredRankings[1]?.ratingsReceived.length ? <div className="text-[10px] text-gray-500 dark:text-gray-400">{filteredRankings[1].ratingsReceived.length} rated</div> : null}
                  </div>
                  <div className="w-full bg-gray-600 dark:bg-gray-600 h-16 sm:h-20" />
                  <div className="w-full h-6 bg-gray-600 dark:bg-gray-600 flex items-center justify-center">
                    <span className="font-mono text-sm text-neutral-400">{displayRanks[1] ?? 2}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center flex-1 max-w-[110px]">
                  <div className="w-14 h-14 sm:w-[72px] sm:h-[72px] bg-amber-500 flex items-center justify-center text-white font-semibold text-xl mb-2">
                    {filteredRankings[0]?.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center mb-2">
                    <div className="text-[13px] text-gray-900 dark:text-gray-200 truncate max-w-full" title={filteredRankings[0]?.displayName}>
                      {filteredRankings[0]?.displayName}
                    </div>
                    <div className="font-mono text-xl tabular-nums text-amber-600 dark:text-amber-400">{sortBy === 'total' ? `${filteredRankings[0]?.totalAura.toLocaleString()} aura` : (filteredRankings[0]?.questionTotals?.[sortBy] ?? 0).toLocaleString()}</div>
                    {filteredRankings[0]?.ratingsReceived.length ? <div className="text-[10px] text-gray-500 dark:text-gray-400">{rankings[0].ratingsReceived.length} rated</div> : null}
                  </div>
                  <div className="w-full bg-amber-500 h-24 sm:h-28" />
                  <div className="w-full h-6 bg-amber-500 flex items-center justify-center">
                    <span className="font-mono text-sm text-white/90">{displayRanks[0] ?? 1}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center flex-1 max-w-[90px]">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-700 flex items-center justify-center text-white font-semibold text-lg mb-2">
                    {filteredRankings[2]?.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center mb-2">
                    <div className="text-[13px] text-gray-900 dark:text-gray-200 truncate max-w-full" title={filteredRankings[2]?.displayName}>
                      {filteredRankings[2]?.displayName}
                    </div>
                    <div className="font-mono text-lg tabular-nums text-gray-500 dark:text-gray-400">{sortBy === 'total' ? `${filteredRankings[2]?.totalAura.toLocaleString()} aura` : (filteredRankings[2]?.questionTotals?.[sortBy] ?? 0).toLocaleString()}</div>
                    {filteredRankings[2]?.ratingsReceived.length ? <div className="text-[10px] text-gray-500 dark:text-gray-400">{rankings[2].ratingsReceived.length} rated</div> : null}
                  </div>
                  <div className="w-full bg-amber-700 h-12 sm:h-16" />
                  <div className="w-full h-6 bg-amber-700 flex items-center justify-center">
                    <span className="font-mono text-sm text-neutral-300">{displayRanks[2] ?? 3}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filteredRankings.length > 0 && filteredRankings.length < 3 && (
            <div className="mb-12 flex justify-center gap-10 results-item" style={{ animationDelay: '0.1s' }}>
              {filteredRankings.map((ranking, index) => {
                const rank = displayRanks[index] ?? index + 1;
                const isFirst = rank === 1;
                return (
                  <div key={ranking.userId} className="flex flex-col items-center">
                    <div className={`w-14 h-14 flex items-center justify-center font-serif text-xl mb-2 ${
                      isFirst ? 'bg-amber-500 text-white' : 'bg-gray-600 dark:bg-gray-600 text-white'
                    }`}>
                      {ranking.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-center">
                      <div className="text-[13px] text-gray-900 dark:text-gray-200">{ranking.displayName}</div>
                      <div className={`font-mono text-lg tabular-nums ${isFirst ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {sortBy === 'total' ? `${ranking.totalAura.toLocaleString()} aura` : (ranking.questionTotals?.[sortBy] ?? 0).toLocaleString()}
                      </div>
                      {ranking.ratingsReceived.length > 0 && <div className="text-[10px] text-gray-500 dark:text-gray-400">{ranking.ratingsReceived.length} rated</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shareable rank cards - only when voting is closed */}
          {(() => {
            const uniqueVoters = new Set(ratings.map(r => r.fromUserId)).size;
            const votingClosed = isVotingClosed(group, uniqueVoters);
            if (!votingClosed) return null;

            return (
              <div id="shareable-cards" className="mb-10">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 results-item" style={{ animationDelay: '0.1s' }}>Your card</h3>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4 results-item" style={{ animationDelay: '0.12s' }}>Share your ranking when voting is closed.</p>
                {rankings.filter(r => r.userId === user.uid).map((ranking, index) => {
              const idx = rankings.findIndex(r => r.userId === user.uid);
              const rank = idx >= 0 ? displayRanksByTotal[idx]! : 1;
              const card = generateRankCard({
                rank,
                totalInGroup: rankings.length,
                groupName: group.name,
                displayName: ranking.displayName,
                totalAura: ranking.totalAura,
              });
              const isCurrentUser = ranking.userId === user.uid;

              return (
                <div
                  key={ranking.userId}
                  className={`relative p-4 mb-3 results-item border-l-2 ${
                    isCurrentUser
                      ? 'border-l-amber-500 bg-gray-50 dark:bg-gray-900/50'
                      : 'border-l-transparent bg-white dark:bg-gray-900/30'
                  }`}
                  style={{ animationDelay: `${0.14 + index * 0.05}s` }}
                >
                  {/* Off-screen card for image capture - fixed position outside viewport */}
                  <div
                    ref={(el) => { cardRefs.current[ranking.userId] = el; }}
                    className="absolute left-[-9999px] top-0"
                    style={{ width: 360, height: 540 }}
                  >
                    <ShareableCard
                      displayName={ranking.displayName}
                      rank={rank}
                      totalInGroup={rankings.length}
                      groupName={group.name}
                      totalAura={ranking.totalAura}
                      headline={card.headline}
                      subline={card.subline}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-0.5">
                        {ranking.displayName} {isCurrentUser && '· you'}
                      </p>
                      <p className="text-base font-medium text-gray-900 dark:text-gray-100">{card.headline}</p>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{card.subline}</p>
                    </div>
                    <button
                      onClick={() => setShowMyCardModal(true)}
                      className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 text-[13px]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View card
                    </button>
                  </div>
                </div>
              );
            })}
              </div>
            );
          })()}

          <div className="mb-10">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 results-item" style={{ animationDelay: '0.08s' }}>Rankings</h3>
            {rankings.length > 0 && (
              <div className="mb-4 results-item flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500"
                >
                  {GROUP_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            {rankings.length === 0 ? (
              <div className="text-center py-12 results-item" style={{ animationDelay: '0.1s' }}>
                <div className="w-px h-12 bg-gray-300 dark:bg-gray-600 mx-auto mb-4" />
                <p className="text-gray-900 dark:text-gray-200 text-sm">No ratings yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const listStart = filteredRankings.length >= 3 ? 3 : 0;
                  const listRankings = filteredRankings.slice(listStart);
                  return listRankings.map((ranking, index) => {
                  const rank = displayRanks[listStart + index] ?? listStart + index + 1;
                  const isYou = ranking.userId === user.uid;
                  
                  return (
                    <div
                      key={ranking.userId}
                      className={`results-item p-4 border-l-2 ${
                        isYou 
                          ? 'border-l-amber-500 bg-gray-50 dark:bg-gray-900/50' 
                          : rank === 1 ? 'border-l-amber-500/50' : 'border-l-gray-200 dark:border-l-gray-700'
                      }`}
                      style={{ animationDelay: `${0.12 + (listStart + index) * 0.05}s` }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-3">
                          {getRankBadge(rank)}
                          <div className="w-9 h-9 bg-gray-600 dark:bg-gray-600 flex items-center justify-center text-white font-semibold text-sm">
                            {ranking.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-900 dark:text-gray-100 text-sm flex flex-wrap items-center gap-1.5">
                              <span className="truncate">{ranking.displayName}</span>
                              {ranking.isCreator && (
                                <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                  creator
                                </span>
                              )}
                              {ranking.userId === user.uid && (
                                <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">you</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right sm:text-left pl-11 sm:pl-0">
                          <div className="font-mono text-lg tabular-nums text-gray-900 dark:text-gray-100">
                            {sortBy === 'total' ? (
                              <>{ranking.totalAura.toLocaleString()} <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">aura</span></>
                            ) : (
                              (ranking.questionTotals?.[sortBy] ?? 0).toLocaleString()
                            )}
                          </div>
                          {sortBy !== 'total' && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                              total {ranking.totalAura.toLocaleString()} aura
                            </div>
                          )}
                          {ranking.ratingsReceived.length > 0 && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {ranking.ratingsReceived.length} rated
                            </div>
                          )}
                        </div>
                      </div>
                      {isYou && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <button
                            type="button"
                            onClick={handleShareProfile}
                            className="flex items-center gap-2 text-[12px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            {shareFeedback || 'Share profile & gain more aura'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
                })()}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link
              href="/create-group"
              className="px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 text-center text-[13px]"
            >
              Create my own group
            </Link>
            <Link
              href="/leaderboard"
              className="px-5 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-center text-[13px]"
            >
              View global ranking
            </Link>
          </div>

          {/* View My Card modal */}
          {showMyCardModal && group && (() => {
            const myRanking = rankings.find(r => r.userId === user.uid);
            if (!myRanking) return null;
            const rankIdx = rankings.findIndex(r => r.userId === user.uid);
            const rank = rankIdx >= 0 ? displayRanksByTotal[rankIdx]! : 1;
            const card = generateRankCard({
              rank,
              totalInGroup: rankings.length,
              groupName: group.name,
              displayName: myRanking.displayName,
              totalAura: myRanking.totalAura,
            });
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
                onClick={() => setShowMyCardModal(false)}
              >
                <div
                  className="relative max-w-sm w-full"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setShowMyCardModal(false)}
                      className="text-white/80 hover:text-white text-sm"
                      aria-label="Close"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="shadow-2xl">
                    <ShareableCard
                      displayName={myRanking.displayName}
                      rank={rank}
                      totalInGroup={rankings.length}
                      groupName={group.name}
                      totalAura={myRanking.totalAura}
                      headline={card.headline}
                      subline={card.subline}
                    />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => captureCard(myRanking, rank, 'share', () => setShowMyCardModal(false))}
                      disabled={isCapturing}
                      className="flex-1 py-3 bg-amber-500 text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCapturing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => captureCard(myRanking, rank, 'download', () => setShowMyCardModal(false))}
                      disabled={isCapturing}
                      className="flex-1 py-3 border border-white/40 text-white font-medium text-sm hover:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    <button
                      onClick={() => setShowMyCardModal(false)}
                      className="px-4 py-3 border border-white/40 text-white text-sm hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
      </main>
    </div>
  );
} 