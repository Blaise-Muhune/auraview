import nodemailer from 'nodemailer';

/** Default matches app admin; override with GMAIL_USER if needed. */
const DEFAULT_GMAIL_USER = 'blaisemu007@gmail.com';

export function isGmailAppPasswordConfigured(): boolean {
  return !!process.env.GMAIL_APP_PASSWORD?.trim();
}

export function getGmailFromAddress(): string {
  return (process.env.GMAIL_USER || DEFAULT_GMAIL_USER).trim();
}

/**
 * Sends one SMTP message per batch using BCC so recipients do not see each other.
 * Uses Gmail (GMAIL_USER + GMAIL_APP_PASSWORD). Requires a Google App Password on the account.
 */
export async function sendBuildEmailBroadcast(params: {
  subject: string;
  text: string;
  recipientEmails: string[];
}): Promise<{ recipientCount: number; batches: number }> {
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!pass) {
    throw new Error('GMAIL_APP_PASSWORD is not configured');
  }
  const user = getGmailFromAddress();
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const raw of params.recipientEmails) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    emails.push(raw.trim());
  }
  if (emails.length === 0) {
    throw new Error('No recipients with valid email addresses');
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const BATCH_SIZE = 400;
  let batches = 0;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    batches += 1;
    await transport.sendMail({
      from: `Aura <${user}>`,
      to: user,
      bcc: batch,
      subject: params.subject,
      text: params.text,
    });
  }

  return { recipientCount: emails.length, batches };
}
