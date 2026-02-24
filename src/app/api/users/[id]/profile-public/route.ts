import { NextResponse } from 'next/server';
import { getAdminDb, hasAdminConfig } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[id]/profile-public
 * Returns minimal public profile (id, displayName, photoURL) for the rate-user page
 * so unauthenticated visitors can see who they're rating before signing in.
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

    const data = snap.data() as { displayName?: string; photoURL?: string } | undefined;
    return NextResponse.json({
      id,
      displayName: data?.displayName ?? 'User',
      photoURL: data?.photoURL ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}
