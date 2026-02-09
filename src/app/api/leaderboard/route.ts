import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const CACHE_TTL_MS = 60_000; // 1 minute
let cache: { rankings: unknown[]; stats: unknown; at: number } | null = null;

const QUESTION_IDS = ['presence_energy', 'authenticity_self_vibe', 'social_pull', 'style_aesthetic', 'trustworthy'] as const;

export type LeaderboardRanking = {
  userId: string;
  displayName: string;
  totalAura: number;
  groupsJoined: number;
  ratingsReceived: number;
  questionTotals?: { [key: string]: number };
};

export type LeaderboardStats = {
  totalUsers: number;
  totalRatings: number;
  averageAura: number;
  highestAura: number;
};

async function computeLeaderboard(): Promise<{
  rankings: LeaderboardRanking[];
  stats: LeaderboardStats;
}> {
  const db = getAdminDb();

  const [groupsSnap, ratingsSnap] = await Promise.all([
    db.collection('groups').get(),
    db.collection('ratings').get(),
  ]);

  const uniqueUserIds = new Set<string>();
  groupsSnap.docs.forEach((doc) => {
    const participants = (doc.data() as { participants?: string[] }).participants ?? [];
    participants.forEach((id: string) => uniqueUserIds.add(id));
  });

  const userStats = new Map<
    string,
    { displayName: string; totalAura: number; groupsJoined: number; ratingsReceived: number; questionTotals: { [key: string]: number } }
  >();
  uniqueUserIds.forEach((userId) => {
    userStats.set(userId, {
      displayName: 'Anonymous User',
      totalAura: 500,
      groupsJoined: 0,
      ratingsReceived: 0,
      questionTotals: Object.fromEntries(QUESTION_IDS.map((q) => [q, 0])),
    });
  });

  groupsSnap.docs.forEach((doc) => {
    const participants = (doc.data() as { participants?: string[] }).participants ?? [];
    participants.forEach((userId: string) => {
      const stat = userStats.get(userId);
      if (stat) stat.groupsJoined += 1;
    });
  });

  ratingsSnap.docs.forEach((doc) => {
    const r = doc.data() as { toUserId?: string; points?: number; questionScores?: { [key: string]: number } };
    const stat = userStats.get(r.toUserId ?? '');
    if (stat) {
      stat.totalAura += r.points ?? 0;
      stat.ratingsReceived += 1;
      if (r.questionScores && typeof r.questionScores === 'object') {
        for (const qid of QUESTION_IDS) {
          const val = r.questionScores[qid];
          if (typeof val === 'number') {
            stat.questionTotals[qid] = (stat.questionTotals[qid] ?? 0) + val;
          }
        }
      }
    }
  });

  const userIds = Array.from(uniqueUserIds);
  const BATCH_SIZE = 10;
  const usersToExclude = new Set<string>();
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const refs = batch.map((id) => db.collection('users').doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, j) => {
      const userId = batch[j];
      const stat = userStats.get(userId);
      if (stat && snap.exists) {
        const data = snap.data() as {
          displayName?: string;
          showOnLeaderboard?: boolean;
          leaderboardAnonymous?: boolean;
        };
        if (data?.showOnLeaderboard === false) {
          usersToExclude.add(userId);
        } else {
          if (data?.leaderboardAnonymous) {
            stat.displayName = 'Anonymous';
          } else if (data?.displayName) {
            stat.displayName = data.displayName;
          }
        }
      }
    });
  }

  const rankings: LeaderboardRanking[] = Array.from(userStats.entries())
    .filter(([userId]) => !usersToExclude.has(userId))
    .map(([userId, s]) => ({
      userId,
      displayName: s.displayName,
      totalAura: s.totalAura,
      groupsJoined: s.groupsJoined,
      ratingsReceived: s.ratingsReceived,
      questionTotals: s.questionTotals,
    }))
    .sort((a, b) => b.totalAura - a.totalAura);

  const totalUsers = uniqueUserIds.size - usersToExclude.size;
  const totalRatings = ratingsSnap.size;
  let totalAura = 0;
  ratingsSnap.docs.forEach((doc) => {
    totalAura += (doc.data() as { points?: number }).points ?? 0;
  });
  totalAura += totalUsers * 500;
  const averageAura = totalUsers > 0 ? Math.round(totalAura / totalUsers) : 0;
  const highestAura = rankings.length > 0 ? rankings[0].totalAura : 0;

  return {
    rankings,
    stats: {
      totalUsers,
      totalRatings,
      averageAura,
      highestAura,
    },
  };
}

const SORT_OPTIONS = ['total', ...QUESTION_IDS] as const;

async function handleLeaderboardRequest(request: Request): Promise<Response> {
  if (!hasAdminConfig()) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const url = new URL(request.url);
  const sortBy = url.searchParams.get('sortBy') || 'total';
  const validSort = SORT_OPTIONS.includes(sortBy as (typeof SORT_OPTIONS)[number]) ? sortBy : 'total';

  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    const { rankings: rawRankings, stats: rawStats } = cache as {
      rankings: LeaderboardRanking[];
      stats: LeaderboardStats;
    };
    const sorted = [...rawRankings].sort((a, b) => {
      if (validSort === 'total') return b.totalAura - a.totalAura;
      const aVal = a.questionTotals?.[validSort] ?? 0;
      const bVal = b.questionTotals?.[validSort] ?? 0;
      return bVal - aVal;
    });
    return NextResponse.json({ rankings: sorted, stats: rawStats });
  }
  const { rankings, stats } = await computeLeaderboard();
  cache = { rankings, stats, at: now };
  const sorted = [...rankings].sort((a, b) => {
    if (validSort === 'total') return b.totalAura - a.totalAura;
    const aVal = a.questionTotals?.[validSort] ?? 0;
    const bVal = b.questionTotals?.[validSort] ?? 0;
    return bVal - aVal;
  });
  return NextResponse.json({ rankings: sorted, stats });
}

export async function POST(request: Request) {
  try {
    return await handleLeaderboardRequest(request);
  } catch (err) {
    logger.error('Leaderboard API error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    return await handleLeaderboardRequest(request);
  } catch (err) {
    logger.error('Leaderboard API error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
