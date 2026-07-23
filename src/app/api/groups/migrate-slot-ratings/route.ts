import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
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

    let migrated = 0;
    let merged = 0;

    for (const slotDoc of snapshot.docs) {
      const slotData = slotDoc.data() as {
        fromUserId?: string;
        fromUserDisplayName?: string;
        points?: number;
        reason?: string | null;
        questionScores?: { [key: string]: number };
      };
      const fromUserId = slotData.fromUserId;
      if (!fromUserId) {
        await slotDoc.ref.delete();
        continue;
      }

      // Rater somehow rated a slot they later claimed — drop invalid self-rating
      if (fromUserId === userId) {
        await slotDoc.ref.delete();
        continue;
      }

      const existing = await db
        .collection('ratings')
        .where('fromUserId', '==', fromUserId)
        .where('toUserId', '==', userId)
        .limit(20)
        .get();

      if (existing.empty) {
        // First time this rater → claimer: attach the real user to the slot vote
        const updatePayload: Record<string, unknown> = {
          toUserId: userId,
          toUserDisplayName: displayName,
          groupIds: FieldValue.arrayUnion(groupId),
          lastGroupId: groupId,
        };
        await slotDoc.ref.update(updatePayload);
        migrated += 1;
        continue;
      }

      // Already rated this person (group or leaderboard): replace old vote with slot scores
      const primary = existing.docs[0];
      const questionScores = slotData.questionScores;
      const updatePayload: Record<string, unknown> = {
        points: typeof slotData.points === 'number' ? slotData.points : 0,
        reason: typeof slotData.reason === 'string' ? slotData.reason : null,
        toUserDisplayName: displayName,
        fromUserDisplayName: slotData.fromUserDisplayName || 'Anonymous',
        groupIds: FieldValue.arrayUnion(groupId),
        lastGroupId: groupId,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (questionScores && typeof questionScores === 'object' && Object.keys(questionScores).length > 0) {
        updatePayload.questionScores = questionScores;
      } else {
        updatePayload.questionScores = FieldValue.delete();
      }

      await primary.ref.update(updatePayload);

      const batch = db.batch();
      batch.delete(slotDoc.ref);
      for (const extra of existing.docs.slice(1)) {
        // Skip if somehow same as primary
        if (extra.id !== primary.id) batch.delete(extra.ref);
      }
      await batch.commit();
      merged += 1;
    }

    return NextResponse.json({ ok: true, migrated, merged, total: snapshot.size });
  } catch (err) {
    logger.error('Migrate slot ratings error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
