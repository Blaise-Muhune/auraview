import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

type AdminUserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  emailVerified: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };
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

    const auth = getAdminAuth();
    const users: AdminUserRow[] = [];
    let pageToken: string | undefined;

    do {
      const list = await auth.listUsers(1000, pageToken);
      for (const u of list.users) {
        const created = u.metadata.creationTime;
        users.push({
          uid: u.uid,
          email: u.email ?? null,
          displayName: u.displayName ?? null,
          createdAt: created ? new Date(created).toISOString() : null,
          emailVerified: u.emailVerified === true,
        });
      }
      pageToken = list.pageToken;
    } while (pageToken);

    users.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return NextResponse.json({ users });
  } catch (err) {
    logger.error('Admin users list error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
