import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string; messageId?: string; markAll?: boolean };
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

    if (body.markAll) {
      const snap = await db.collection('contactMessages').where('read', '==', false).get();
      const batch = db.batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    const messageId = body.messageId;
    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 });
    }

    await db.collection('contactMessages').doc(messageId).update({ read: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Contact mark read error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
