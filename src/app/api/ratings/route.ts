import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { FieldValue } from 'firebase-admin/firestore';

const POINTS_MAX = 10000;
const POINTS_MIN = -10000;
const REASON_MAX_LENGTH = 500;
const DISPLAY_NAME_MAX_LENGTH = 100;
const DIRECT_GROUP_ID = 'direct';

const QUESTION_IDS = ['presence_energy', 'authenticity_self_vibe', 'social_pull', 'style_aesthetic', 'trustworthy'] as const;

interface RatingBody {
  idToken?: string;
  groupId: string;
  toUserId: string;
  toUserDisplayName: string;
  points: number;
  reason?: string;
  questionScores?: { [key: string]: number };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RatingBody;
    const authHeader = request.headers.get('Authorization');
    const token =
      authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (body.idToken ?? null);
    if (!token || !hasAdminConfig()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let decodedToken: { uid: string };
    try {
      decodedToken = await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const fromUserId = decodedToken.uid;

    const { groupId, toUserId, toUserDisplayName, points, reason, questionScores } = body;

    if (!groupId || !toUserId || !toUserDisplayName || typeof points !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (points < POINTS_MIN || points > POINTS_MAX) {
      return NextResponse.json({ error: 'Points out of bounds' }, { status: 400 });
    }

    if (fromUserId === toUserId) {
      return NextResponse.json({ error: 'Cannot rate yourself' }, { status: 400 });
    }

    if (typeof toUserDisplayName === 'string' && toUserDisplayName.length > DISPLAY_NAME_MAX_LENGTH) {
      return NextResponse.json({ error: 'toUserDisplayName too long' }, { status: 400 });
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (trimmedReason.length > REASON_MAX_LENGTH) {
      return NextResponse.json({ error: 'Reason too long' }, { status: 400 });
    }

    // Validate questionScores if provided
    let sanitizedQuestionScores: { [key: string]: number } | null = null;
    if (questionScores && typeof questionScores === 'object') {
      sanitizedQuestionScores = {};
      for (const qid of QUESTION_IDS) {
        const val = questionScores[qid];
        if (typeof val === 'number' && val >= -10000 && val <= 10000) {
          sanitizedQuestionScores[qid] = val;
        }
      }
    }

    const db = getAdminDb();

    const isDirect = groupId === DIRECT_GROUP_ID;

    if (isDirect) {
      const toUserSnap = await db.collection('users').doc(toUserId).get();
      if (!toUserSnap.exists) {
        return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
      }
    } else {
      const groupSnap = await db.collection('groups').doc(groupId).get();
      if (!groupSnap.exists) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }
      const group = groupSnap.data() as { participants?: string[]; slots?: Array<{ userId?: string }> };
      const participants = group.participants || [];
      if (!participants.includes(fromUserId)) {
        return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
      }
      const isSlotId = toUserId.startsWith('slot:');
      if (isSlotId) {
        const match = toUserId.match(/^slot:([^:]+):(\d+)$/);
        if (!match || match[1] !== groupId) {
          return NextResponse.json({ error: 'Invalid slot target' }, { status: 400 });
        }
        const slotIndex = parseInt(match[2], 10);
        const slots = group.slots || [];
        if (slotIndex < 0 || slotIndex >= slots.length) {
          return NextResponse.json({ error: 'Slot index out of range' }, { status: 400 });
        }
        const slot = slots[slotIndex];
        if (slot?.userId === fromUserId) {
          return NextResponse.json({ error: 'Cannot rate yourself' }, { status: 400 });
        }
      } else {
        if (!participants.includes(toUserId)) {
          return NextResponse.json({ error: 'Target user not in group' }, { status: 403 });
        }
      }
    }

    const existingRatings = await db
      .collection('ratings')
      .where('groupId', '==', groupId)
      .where('fromUserId', '==', fromUserId)
      .where('toUserId', '==', toUserId)
      .limit(1)
      .get();

    if (!existingRatings.empty) {
      return NextResponse.json({ error: 'Already rated this user in this context' }, { status: 409 });
    }

    const fromUserSnap = await db.collection('users').doc(fromUserId).get();
    const fromUserDisplayName =
      (fromUserSnap.data() as { displayName?: string })?.displayName || 'Anonymous';

    // Each person you rate gets up to 10,000 points (±10,000). No global pool.

    const ratingData: Record<string, unknown> = {
      groupId,
      fromUserId,
      fromUserDisplayName,
      toUserId,
      toUserDisplayName,
      points,
      reason: trimmedReason || null,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (sanitizedQuestionScores && Object.keys(sanitizedQuestionScores).length > 0) {
      ratingData.questionScores = sanitizedQuestionScores;
    }

    await db.collection('ratings').add(ratingData);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Ratings API error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
