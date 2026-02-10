import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string; limit?: number };
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : body.idToken ?? null;

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
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
    const snap = await db
      .collection('contactMessages')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const messages = snap.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt as { seconds?: number; _seconds?: number } | null;
      const sec = createdAt ? (createdAt.seconds ?? createdAt._seconds ?? 0) : 0;
      return {
        id: doc.id,
        title: data.title || '',
        message: data.message || '',
        read: data.read === true,
        createdAt: sec ? new Date(sec * 1000).toISOString() : null,
        userId: data.userId ?? null,
        userEmail: data.userEmail ?? null,
        userDisplayName: data.userDisplayName ?? null,
      };
    });

    return NextResponse.json({ messages });
  } catch (err) {
    logger.error('Contact messages error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
