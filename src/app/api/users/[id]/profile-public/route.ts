import { NextResponse } from 'next/server';
import { getAdminDb, hasAdminConfig } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[id]/profile-public
 * Returns public profile for unauthenticated visitors (shared profile link, rate-user page).
 * Includes: id, displayName, photoURL, totalAura (computed), socialHandles, auraSources.
 * No email or private data.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!hasAdminConfig()) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(id);
    const snap = await userRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = snap.data() as {
      displayName?: string;
      photoURL?: string;
      feedAuraTotal?: number;
      socialHandles?: Record<string, unknown>;
      auraSources?: Record<string, unknown>;
    } | undefined;

    // Compute total aura: base 500 + sum of ratings where toUserId === id + feedAuraTotal
    const ratingsSnap = await db.collection('ratings').where('toUserId', '==', id).get();
    const totalPoints = ratingsSnap.docs.reduce((sum, d) => sum + ((d.data() as { points?: number }).points ?? 0), 0);
    const feedAura = data?.feedAuraTotal ?? 0;
    const totalAura = totalPoints + 500 + feedAura;

    return NextResponse.json({
      id,
      displayName: data?.displayName ?? 'User',
      photoURL: data?.photoURL ?? null,
      totalAura,
      socialHandles: data?.socialHandles ?? undefined,
      auraSources: data?.auraSources ?? undefined,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}
