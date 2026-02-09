import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

function toDateKey(ts: { seconds?: number; _seconds?: number } | null): string {
  if (!ts) return '';
  const sec = ts.seconds ?? (ts as { _seconds?: number })._seconds ?? 0;
  const d = new Date(sec * 1000);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : body.idToken ?? null;

    if (!token || !hasAdminConfig()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken: { uid: string; email?: string };
    try {
      decodedToken = await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    let email = decodedToken.email?.toLowerCase();
    if (!email) {
      const userRecord = await getAdminAuth().getUser(decodedToken.uid);
      email = userRecord.email?.toLowerCase();
    }
    if (!ADMIN_EMAIL || email !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getAdminDb();
    const [usersSnap, groupsSnap, ratingsSnap, ratingsDocs] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('groups').count().get(),
      db.collection('ratings').count().get(),
      db.collection('ratings').orderBy('createdAt', 'desc').limit(500).get(),
    ]);

    const users = usersSnap.data().count;
    const groups = groupsSnap.data().count;
    const ratings = ratingsSnap.data().count;

    const days: Record<string, number> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    ratingsDocs.docs.forEach((doc) => {
      const data = doc.data();
      const key = toDateKey(data.createdAt as { seconds?: number; _seconds?: number } | null);
      if (key && key in days) days[key]++;
    });

    const ratingsByDay = Object.entries(days).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      ratings: count,
      fullDate: date,
    }));

    const overview = [
      { name: 'Users', value: users, fill: '#3b82f6' },
      { name: 'Groups', value: groups, fill: '#10b981' },
      { name: 'Ratings', value: ratings, fill: '#f59e0b' },
    ];

    return NextResponse.json({
      users,
      groups,
      ratings,
      ratingsByDay,
      overview,
    });
  } catch (err) {
    logger.error('Admin stats error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
