import { NextResponse } from 'next/server';
import { hasAdminConfig, getAdminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { isGmailAppPasswordConfigured, sendBuildEmailBroadcast } from '@/lib/gmail-build-email';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const SUBJECT_MAX = 200;
const BODY_MAX = 20_000;

/** Vercel / long sends: increase if you have many recipients (Pro plan may be required). */
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      subject?: string;
      text?: string;
    };
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

    let adminEmail = decodedToken.email?.toLowerCase();
    if (!adminEmail) {
      const userRecord = await getAdminAuth().getUser(decodedToken.uid);
      adminEmail = userRecord.email?.toLowerCase();
    }
    if (!ADMIN_EMAIL || adminEmail !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isGmailAppPasswordConfigured()) {
      return NextResponse.json(
        {
          error:
            'Gmail is not configured. Add GMAIL_APP_PASSWORD (Google App Password) to your server environment. Optional: GMAIL_USER defaults to blaisemu007@gmail.com.',
        },
        { status: 503 }
      );
    }

    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!subject || !text) {
      return NextResponse.json({ error: 'Subject and message body are required' }, { status: 400 });
    }
    if (subject.length > SUBJECT_MAX) {
      return NextResponse.json({ error: `Subject must be at most ${SUBJECT_MAX} characters` }, { status: 400 });
    }
    if (text.length > BODY_MAX) {
      return NextResponse.json({ error: `Message must be at most ${BODY_MAX} characters` }, { status: 400 });
    }

    const auth = getAdminAuth();
    const recipientEmails: string[] = [];
    let pageToken: string | undefined;
    do {
      const list = await auth.listUsers(1000, pageToken);
      for (const u of list.users) {
        if (u.email) recipientEmails.push(u.email);
      }
      pageToken = list.pageToken;
    } while (pageToken);

    const result = await sendBuildEmailBroadcast({ subject, text, recipientEmails });

    return NextResponse.json({
      ok: true,
      recipientCount: result.recipientCount,
      batches: result.batches,
    });
  } catch (err) {
    logger.error('Admin send build email error', err);
    const message = err instanceof Error ? err.message : 'Failed to send';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
