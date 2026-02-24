'use client';

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import { getUserProfile, getUserTotalAura, UserProfile } from "@/lib/firestore";

const SOCIAL_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
  github: 'GitHub',
};

function getSocialType(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    let href = url.trim();
    if (!href.startsWith('http')) href = 'https://' + href;
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com')) return 'twitter';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
    if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
    return null;
  } catch {
    return null;
  }
}

interface ViewProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ViewProfilePage({ params }: ViewProfilePageProps) {
  const { user, loading } = useAuth();
  const { id } = use(params);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [totalAura, setTotalAura] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    try {
      if (user) {
        // Signed-in: use Firestore (allowed by rules) and computed total aura
        const userProfile = await getUserProfile(id);
        if (!userProfile) {
          setError('Profile not found. This user may not have created a profile yet.');
          return;
        }
        setProfile(userProfile);
        const total = await getUserTotalAura(id);
        setTotalAura(total);
      } else {
        // Guest (e.g. friend who clicked shared link): load via API so we don't require auth
        const res = await fetch(`/api/users/${id}/profile-public`);
        if (!res.ok) {
          if (res.status === 404) setError('Profile not found. This user may not have created a profile yet.');
          else setError('Failed to load profile. Please try again later.');
          return;
        }
        const data = await res.json() as {
          id: string;
          displayName: string;
          photoURL: string | null;
          totalAura: number;
          socialHandles?: UserProfile['socialHandles'];
          auraSources?: UserProfile['auraSources'];
        };
        setTotalAura(data.totalAura);
        setProfile({
          id: data.id,
          displayName: data.displayName,
          photoURL: data.photoURL ?? '',
          email: '',
          baseAura: 500,
          totalAura: data.totalAura,
          pointsToGive: 10000,
          createdAt: {} as UserProfile['createdAt'],
          groupsJoined: [],
          socialHandles: data.socialHandles,
          auraSources: data.auraSources,
        } as UserProfile);
      }
    } catch {
      setError(user ? 'Failed to load profile. Please try again later.' : 'Profile not found. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (id) loadProfile();
  }, [id, loadProfile]);

  useEffect(() => {
    setProfileImageError(false);
  }, [profile?.id]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    const needsSignIn = !user && error?.includes('Sign in');
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref={user ? '/dashboard' : '/'} showAuth={!user} />
        <main className="max-w-xl mx-auto px-5 py-10 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {needsSignIn ? 'Sign in to view' : 'Profile Not Found'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">{error || 'The profile you are looking for does not exist.'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {needsSignIn && (
              <Link href={`/login?redirect=${encodeURIComponent(`/profile/${id}`)}`} className="inline-block px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90">
                Sign in
              </Link>
            )}
            <Link href={user ? '/dashboard' : '/'} className="inline-block px-4 py-3 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium rounded-xl hover:opacity-90">
              {user ? 'Back to Dashboard' : 'Back to home'}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile/${id}` : '';
  const isOwnProfile = user?.uid === profile.id;
  const shareMessage = profileUrl ? `I'm on Aura — an app where friends rate each other and you see your "aura" score. Rate me or check my profile: ${profileUrl}` : '';

  const handleCopyLink = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref={user ? '/dashboard' : '/'} showAuth={!user} />

      <main className="max-w-xl mx-auto px-5 py-10">
        <div className="text-center text-gray-900 dark:text-gray-100 mb-12">
          <h1 className="text-4xl font-bold mb-4">Aura Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Learn about this person&apos;s aura and achievements</p>
        </div>

        {/* User Info */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
            {profile.photoURL && !profileImageError ? (
              <Image 
                src={profile.photoURL} 
                alt={profile.displayName || 'User'} 
                width={96}
                height={96}
                className="w-24 h-24 rounded-full border-4 border-gray-200 dark:border-gray-700 object-cover"
                unoptimized
                onError={() => setProfileImageError(true)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-3xl font-semibold text-gray-600 dark:text-gray-300 shrink-0">
                {(profile.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{profile.displayName || 'User'}</h2>
              <div className="inline-block p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="text-3xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {(totalAura ?? profile.totalAura).toLocaleString()}
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">Total Aura</div>
              </div>
            </div>
          </div>
          
          {/* Share link (own profile) or Give aura (others) */}
          {isOwnProfile ? (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share your profile</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Copy the message below and paste it anywhere you share (Instagram, TikTok, group chat, etc.)</p>
                <div className="flex flex-col gap-2 w-full max-w-md">
                  <textarea
                    readOnly
                    rows={2}
                    value={shareMessage}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm resize-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex-shrink-0 px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 transition-colors text-[13px]"
                  >
                    {copied ? 'Copied!' : 'Copy message'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Give them aura</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Share your aura points with {profile.displayName || 'this person'}</p>
                </div>
                <Link
                  href={user ? `/rate-user/${profile.id}` : `/login?redirect=${encodeURIComponent(`/rate-user/${profile.id}`)}`}
                  className="px-5 py-3 bg-gray-900 dark:bg-white rounded-xl text-white dark:text-gray-900 font-semibold hover:opacity-90 transition-colors text-[13px]"
                >
                  {user ? 'Give aura' : 'Log in to give aura'}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Social links */}
        {(() => {
          const h = profile.socialHandles || {};
          const links = h.socialLinks?.filter(Boolean) ?? [
            h.instagram, h.twitter, h.linkedin, h.github
          ].filter(Boolean) as string[];
          if (links.length === 0) return null;
          return (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Social</h3>
              <div className="space-y-2">
                {links.map((url, i) => {
                  const type = getSocialType(url);
                  const href = url.startsWith('http') ? url : `https://${url}`;
                  return (
                    <a
                      key={i}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {type ? SOCIAL_NAMES[type] || type : 'Link'}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{url}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Website */}
        {profile.socialHandles?.website && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Website</h3>
            <a
              href={profile.socialHandles.website.startsWith('http') ? profile.socialHandles.website : `https://${profile.socialHandles.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
            >
              {profile.socialHandles.website}
            </a>
          </div>
        )}

        {/* Back Button */}
        <div className="text-center">
          <Link href={user ? '/dashboard' : '/'} className="inline-block px-5 py-3 bg-gray-900 dark:bg-white rounded-xl text-white dark:text-gray-900 font-semibold hover:opacity-90 transition-colors text-[13px]">
            {user ? 'Back to Dashboard' : 'Back to home'}
          </Link>
        </div>
      </main>
    </div>
  );
} 