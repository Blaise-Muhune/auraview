import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

let adminApp: App | null = null;

function loadServiceAccount(): object {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    try {
      const absPath = path.startsWith('/') || /^[A-Z]:/i.test(path) ? path : join(process.cwd(), path);
      const content = readFileSync(absPath, 'utf-8');
      return JSON.parse(content) as object;
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load service account from path:', e);
      }
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH invalid or file unreadable');
    }
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json || json.trim() === '{' || json.trim().length < 50) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not configured or truncated (put JSON on one line in .env, or use FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json)');
  }
  try {
    return JSON.parse(json) as object;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON invalid JSON (must be single-line in .env)');
  }
}

export function getAdminDb() {
  const existing = getApps()[0];
  if (existing) {
    return getFirestore(existing as App);
  }
  const serviceAccount = loadServiceAccount();
  adminApp = initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(adminApp);
}

export function getAdminAuth() {
  if (!getApps().length) getAdminDb();
  return getAuth(getApps()[0] as App);
}

export function hasAdminConfig(): boolean {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()?.length ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}
