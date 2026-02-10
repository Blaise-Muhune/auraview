import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { FieldValue } from 'firebase-admin/firestore';

const TITLE_MAX = 100;
const MESSAGE_MAX = 1000;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(request: Request) {
  try {
    if (!hasAdminConfig()) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const body = (await request.json()) as { title?: string; message?: string; idToken?: string };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    if (title.length > TITLE_MAX) {
      return NextResponse.json({ error: `Title must be at most ${TITLE_MAX} characters` }, { status: 400 });
    }

    if (message.length > MESSAGE_MAX) {
      return NextResponse.json({ error: `Message must be at most ${MESSAGE_MAX} characters` }, { status: 400 });
    }

    let userId: string | null = null;
    let userEmail: string | null = null;
    let userDisplayName: string | null = null;
    if (body.idToken && typeof body.idToken === 'string') {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(body.idToken);
        userId = decoded.uid;
        userEmail = decoded.email ?? null;
        userDisplayName = (decoded.name as string) ?? null;
        if (!userDisplayName) {
          const userRecord = await auth.getUser(decoded.uid);
          userDisplayName = userRecord.displayName ?? null;
        }
      } catch {
        // ignore invalid token; store message without sender info
      }
    }

    const db = getAdminDb();
    const data: Record<string, unknown> = {
      title: escapeHtml(title),
      message: escapeHtml(message),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (userId) data.userId = userId;
    if (userEmail) data.userEmail = userEmail;
    if (userDisplayName) data.userDisplayName = userDisplayName;

    await db.collection('contactMessages').add(data);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Contact API error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
