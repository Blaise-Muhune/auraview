import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const getSlotId = (groupId: string, slotIndex: number) => `slot:${groupId}:${slotIndex}`;

interface Body {
  idToken?: string;
  groupId: string;
  slotIndex: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : body.idToken ?? null;
    if (!token || !hasAdminConfig()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let decodedToken: { uid: string };
    try {
      decodedToken = await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = decodedToken.uid;

    const { groupId, slotIndex } = body;
    if (!groupId || typeof slotIndex !== 'number' || slotIndex < 0) {
      return NextResponse.json({ error: 'Missing groupId or invalid slotIndex' }, { status: 400 });
    }

    const db = getAdminDb();
    const groupSnap = await db.collection('groups').doc(groupId).get();
    if (!groupSnap.exists) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = groupSnap.data() as { slots?: Array<{ userId?: string; displayName?: string }> };
    const slots = group.slots || [];
    if (slotIndex >= slots.length) {
      return NextResponse.json({ error: 'Slot index out of range' }, { status: 400 });
    }

    const slot = slots[slotIndex];
    if (slot?.userId !== userId) {
      return NextResponse.json({ error: 'You have not claimed this slot' }, { status: 403 });
    }

    const displayName = slot.displayName || 'Someone';
    const slotId = getSlotId(groupId, slotIndex);

    const snapshot = await db
      .collection('ratings')
      .where('groupId', '==', groupId)
      .where('toUserId', '==', slotId)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((d) => {
      batch.update(d.ref, { toUserId: userId, toUserDisplayName: displayName });
    });

    if (!snapshot.empty) {
      await batch.commit();
    }

    return NextResponse.json({ ok: true, migrated: snapshot.size });
  } catch (err) {
    logger.error('Migrate slot ratings error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
