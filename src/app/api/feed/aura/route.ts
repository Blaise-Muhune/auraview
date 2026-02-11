import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { FieldValue, DocumentReference } from 'firebase-admin/firestore';

const FEED_AURA_STEP = 100;
const FEED_AURA_MAX = 500;
const FEED_AURA_MIN = -100;

function feedAuraDocId(postId: string, fromUserId: string): string {
  return `${postId}_${fromUserId}`;
}

export async function POST(request: Request) {
  try {
    if (!hasAdminConfig()) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const body = (await request.json()) as {
      idToken?: string;
      postId?: string;
      delta?: number;
    };
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : body.idToken ?? null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let fromUserId: string;
    let fromUserDisplayName: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      fromUserId = decoded.uid;
      const userRecord = await getAdminAuth().getUser(decoded.uid);
      fromUserDisplayName = userRecord.displayName ?? decoded.email?.split('@')[0] ?? 'Someone';
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const postId = typeof body.postId === 'string' ? body.postId.trim() : '';
    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const rawDelta = typeof body.delta === 'number' ? body.delta : FEED_AURA_STEP;
    const delta = rawDelta === FEED_AURA_STEP ? 100 : rawDelta === -FEED_AURA_STEP ? -100 : 0;
    if (delta === 0) {
      return NextResponse.json({ error: 'delta must be 100 or -100' }, { status: 400 });
    }

    const db = getAdminDb();
    const postSnap = await db.collection('feedPosts').doc(postId).get();
    if (!postSnap.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    const post = postSnap.data() as { authorId?: string };
    const toUserId = post?.authorId ?? '';
    if (!toUserId) {
      return NextResponse.json({ error: 'Invalid post' }, { status: 400 });
    }
    if (fromUserId === toUserId) {
      return NextResponse.json({ error: 'Cannot give aura to your own post' }, { status: 400 });
    }

    const docId = feedAuraDocId(postId, fromUserId);
    const feedAuraRef = db.collection('feedAura').doc(docId);
    const feedAuraSnap = await feedAuraRef.get();

    let current = 0;
    const oldDocRefs: DocumentReference[] = [];

    if (feedAuraSnap.exists) {
      current = (feedAuraSnap.data() as { points?: number }).points ?? 0;
    } else {
      const legacy = await db
        .collection('feedAura')
        .where('postId', '==', postId)
        .where('fromUserId', '==', fromUserId)
        .get();
      legacy.docs.forEach((d) => {
        current += (d.data() as { points?: number }).points ?? 0;
        oldDocRefs.push(d.ref);
      });
    }

    const newPoints = Math.max(FEED_AURA_MIN, Math.min(FEED_AURA_MAX, current + delta));
    if (newPoints === current) {
      return NextResponse.json({ ok: true, points: newPoints });
    }

    const postRef = db.collection('feedPosts').doc(postId);
    const userRef = db.collection('users').doc(toUserId);
    const increment = newPoints - current;

    await db.runTransaction(async (tx) => {
      for (const ref of oldDocRefs) {
        tx.delete(ref);
      }
      tx.set(feedAuraRef, {
        postId,
        fromUserId,
        fromUserDisplayName,
        toUserId,
        points: newPoints,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(postRef, { totalAuraCount: FieldValue.increment(increment) });
      tx.update(userRef, { feedAuraTotal: FieldValue.increment(increment) });
    });

    return NextResponse.json({ ok: true, points: newPoints });
  } catch (err) {
    logger.error('Feed aura API error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
