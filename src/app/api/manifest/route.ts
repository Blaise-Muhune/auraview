import { NextRequest, NextResponse } from 'next/server';

/** Build origin from request so manifest icons use absolute URLs (required for PWA install to show logo). */
function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const proto = request.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request);

  const manifest = {
    name: 'Aura - Global Friend Group Ranking App',
    short_name: 'Aura',
    description: "Rank your friends' aura based on personality, achievements, and character. Join groups, get rated, and see who has the highest aura worldwide.",
    id: '/',
    start_url: `${origin}/`,
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#b45309',
    orientation: 'portrait-primary',
    scope: `${origin}/`,
    lang: 'en',
    categories: ['social', 'lifestyle', 'entertainment'],
    icons: [
      { src: `${origin}/logo.png`, sizes: '72x72', type: 'image/png', purpose: 'any' },
      { src: `${origin}/logo.png`, sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: `${origin}/logo.png`, sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: `${origin}/logo.png`, sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: `${origin}/logo.png`, sizes: '152x152', type: 'image/png', purpose: 'any' },
      { src: `${origin}/logo.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${origin}/logo.png`, sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: `${origin}/logo.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${origin}/logo.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: `${origin}/logo.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      { src: `${origin}/logo.png`, sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Aura leaderboard' },
      { src: `${origin}/logo.png`, sizes: '750x1334', type: 'image/png', form_factor: 'narrow', label: 'Aura app' },
    ],
    shortcuts: [
      { name: 'Create Group', short_name: 'Create', description: 'Start a new aura rating session', url: `${origin}/create-group`, icons: [{ src: `${origin}/logo.png`, sizes: '96x96' }] },
      { name: 'Join Group', short_name: 'Join', description: 'Join an existing group with a code', url: `${origin}/join-group`, icons: [{ src: `${origin}/logo.png`, sizes: '96x96' }] },
      { name: 'Leaderboard', short_name: 'Rankings', description: 'View global aura rankings', url: `${origin}/leaderboard`, icons: [{ src: `${origin}/logo.png`, sizes: '96x96' }] },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
