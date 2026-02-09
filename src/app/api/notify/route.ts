import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { hasAdminConfig, getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}
const FROM_EMAIL = process.env.EMAIL_FROM || 'Aura <notifications@resend.dev>';
const APP_NAME = 'Aura';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MAX_NOTIFY_PER_MINUTE = 20;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = rateLimit.get(uid);
  if (!entry) {
    rateLimit.set(uid, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (now > entry.resetAt) {
    rateLimit.set(uid, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= MAX_NOTIFY_PER_MINUTE) return false;
  entry.count++;
  return true;
}

type NotifyType = 'rating_received' | 'group_join' | 'voting_closed';

interface NotifyBody {
  toUserId: string;
  type: NotifyType;
  data: Record<string, string>;
  fromUserId?: string;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !hasAdminConfig()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let decodedToken: { uid: string };
    try {
      decodedToken = await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const uid = decodedToken.uid;
    if (!checkRateLimit(uid)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = (await request.json()) as NotifyBody;
    const { toUserId, type, data, fromUserId } = body;

    if (!toUserId || !type) {
      return NextResponse.json({ error: 'Missing toUserId or type' }, { status: 400 });
    }

    if (type === 'rating_received' || type === 'group_join') {
      if (!fromUserId || fromUserId !== uid) {
        return NextResponse.json({ error: 'fromUserId must match authenticated user' }, { status: 403 });
      }
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: true }); // Graceful skip
    }

    let email: string | null = null;
    let emailNotifications = true;

    if (hasAdminConfig()) {
      const db = getAdminDb();
      const userSnap = await db.collection('users').doc(toUserId).get();
      if (userSnap.exists) {
        const userData = userSnap.data() as Record<string, unknown>;
        email = typeof userData?.email === 'string' ? userData.email : null;
        emailNotifications = userData?.emailNotifications !== false;
      }
    } else {
      return NextResponse.json({ ok: true }); // Graceful skip when Admin not configured
    }

    if (!email || !emailNotifications) {
      return NextResponse.json({ ok: true });
    }

    let subject: string;
    let html: string;

    switch (type) {
      case 'rating_received': {
        const fromName = escapeHtml(data.fromUserDisplayName || 'Someone');
        const points = escapeHtml(String(data.points || '0'));
        const groupName = escapeHtml(data.groupName || 'a group');
        const appUrl = (data.appUrl && typeof data.appUrl === 'string' && data.appUrl.startsWith('http')) ? data.appUrl : '#';
        subject = `${fromName} gave you aura`;
        html = `
          <p>Hey,</p>
          <p><strong>${fromName}</strong> gave you <strong>${points}</strong> aura points in ${groupName}.</p>
          <p><a href="${appUrl}">View your ranking</a></p>
          <p>— ${APP_NAME}</p>
        `;
        break;
      }
      case 'group_join': {
        const joinerName = escapeHtml(data.joinerName || 'Someone');
        const groupName = escapeHtml(data.groupName || 'your group');
        const appUrl = (data.appUrl && typeof data.appUrl === 'string' && data.appUrl.startsWith('http')) ? data.appUrl : '#';
        subject = `${joinerName} joined ${groupName}`;
        html = `
          <p>Hey,</p>
          <p><strong>${joinerName}</strong> joined ${groupName}.</p>
          <p><a href="${appUrl}">View group</a></p>
          <p>— ${APP_NAME}</p>
        `;
        break;
      }
      case 'voting_closed': {
        const groupName = escapeHtml(data.groupName || 'your group');
        const appUrl = (data.appUrl && typeof data.appUrl === 'string' && data.appUrl.startsWith('http')) ? data.appUrl : '#';
        subject = `Voting closed in ${groupName}`;
        html = `
          <p>Hey,</p>
          <p>Voting has closed in <strong>${groupName}</strong>. Results are ready.</p>
          <p><a href="${appUrl}">View results</a></p>
          <p>— ${APP_NAME}</p>
        `;
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const resend = getResend();
    if (resend) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject,
        html: html.trim().replace(/\n\s+/g, '\n'),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Notify API error:', err);
    }
    return NextResponse.json({ ok: true }); // Don't fail the flow
  }
}
