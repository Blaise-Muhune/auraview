import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

const CACHE_TTL_MS = 60_000; // 1 minute
let cache: { rankings: unknown[]; stats: unknown; at: number } | null = null;

export type LeaderboardRanking = {
  userId: string;
  displayName: string;
  totalAura: number;
  groupsJoined: number;
  ratingsReceived: number;
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
    { displayName: string; totalAura: number; groupsJoined: number; ratingsReceived: number }
  >();
  uniqueUserIds.forEach((userId) => {
    userStats.set(userId, {
      displayName: 'Anonymous User',
      totalAura: 500,
      groupsJoined: 0,
      ratingsReceived: 0,
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
    const r = doc.data() as { toUserId?: string; points?: number };
    const stat = userStats.get(r.toUserId ?? '');
    if (stat) {
      stat.totalAura += r.points ?? 0;
      stat.ratingsReceived += 1;
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

async function handleLeaderboardRequest(request: Request): Promise<Response> {
  let token: string | null = null;
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      token = (body as { token?: string; idToken?: string }).token ?? (body as { token?: string; idToken?: string }).idToken ?? null;
    } catch {
      // body parse failed
    }
  }
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  }
  if (!hasAdminConfig()) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  let authenticated = false;
  if (token) {
    try {
      await getAdminAuth().verifyIdToken(token);
      authenticated = true;
    } catch {
      // invalid token - fall back to anonymized
    }
  }
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    const { rankings: rawRankings, stats: rawStats } = cache as {
      rankings: LeaderboardRanking[];
      stats: LeaderboardStats;
    };
    if (authenticated) {
      return NextResponse.json({ rankings: rawRankings, stats: rawStats });
    }
    const anonymized = rawRankings.map((r) => ({
      userId: r.userId,
      displayName: 'Anonymous',
      totalAura: null as number | null,
      groupsJoined: r.groupsJoined,
      ratingsReceived: r.ratingsReceived,
    }));
    return NextResponse.json({
      rankings: anonymized,
      stats: { ...rawStats, averageAura: null, highestAura: null },
      anonymized: true,
    });
  }
  const { rankings, stats } = await computeLeaderboard();
  cache = { rankings, stats, at: now };
  if (authenticated) {
    return NextResponse.json({ rankings, stats, anonymized: false });
  }
  const anonymized = rankings.map((r) => ({
    userId: r.userId,
    displayName: 'Anonymous',
    totalAura: null as number | null,
    groupsJoined: r.groupsJoined,
    ratingsReceived: r.ratingsReceived,
  }));
  return NextResponse.json({
    rankings: anonymized,
    stats: { ...stats, averageAura: null, highestAura: null },
    anonymized: true,
  });
}

export async function POST(request: Request) {
  try {
    return await handleLeaderboardRequest(request);
  } catch (err) {
    console.error('Leaderboard API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    return await handleLeaderboardRequest(request);
  } catch (err) {
    console.error('Leaderboard API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
