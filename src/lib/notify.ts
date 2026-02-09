'use client';

type NotifyType = 'rating_received' | 'group_join' | 'voting_closed';

interface NotifyData {
  fromUserDisplayName?: string;
  points?: string | number;
  groupName?: string;
  joinerName?: string;
  appUrl?: string;
}

interface NotifyOptions {
  /** Firebase ID token for auth (required for notify API) */
  token: string;
  /** For rating_received and group_join: must match authenticated user */
  fromUserId?: string;
}

/** Call the notify API to send an email to a user. Fails silently. */
export async function sendNotification(
  toUserId: string,
  type: NotifyType,
  data: NotifyData = {},
  options: NotifyOptions
): Promise<void> {
  try {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const body: Record<string, unknown> = {
      toUserId,
      type,
      data: { ...data, appUrl },
    };
    if (options.fromUserId) body.fromUserId = options.fromUserId;

    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Notify API error:', res.status, await res.text());
      }
    }
  } catch {
    // Silent fail
  }
}
