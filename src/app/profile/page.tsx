'use client';

import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { updateUserProfile, ensureUserProfile } from "@/lib/firestore";
import { useTheme } from "@/components/ThemeProvider";

const SOCIAL_DOMAINS: Record<string, string> = {
  'instagram.com': 'instagram',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'linkedin.com': 'linkedin',
  'github.com': 'github',
};

function detectSocialType(url: string): string | null {
  if (!url.trim()) return null;
  try {
    let href = url.trim();
    if (!href.startsWith('http')) href = 'https://' + href;
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    for (const [domain, type] of Object.entries(SOCIAL_DOMAINS)) {
      if (host === domain || host.endsWith('.' + domain)) return type;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : 'https://' + trimmed;
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const [socialLinks, setSocialLinks] = useState<string[]>(['']);
  const [socialLinkErrors, setSocialLinkErrors] = useState<(string | null)[]>([]);
  const [website, setWebsite] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState<boolean | undefined>(undefined);
  const [leaderboardAnonymous, setLeaderboardAnonymous] = useState(false);
  const [showOnGroupLeaderboard, setShowOnGroupLeaderboard] = useState<boolean | undefined>(undefined);
  const [groupLeaderboardAnonymous, setGroupLeaderboardAnonymous] = useState(false);
  const [hasPendingGroup, setHasPendingGroup] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const userProfile = await ensureUserProfile(user);
      const h = userProfile.socialHandles || {};
      const links = h.socialLinks?.filter(Boolean) ?? [
        h.instagram, h.twitter, h.linkedin, h.github
      ].filter(Boolean) as string[];
      setSocialLinks(links.length ? links : ['']);
      setWebsite(h.website || '');
      setEmailNotifications(userProfile.emailNotifications !== false);
      setShowOnLeaderboard(userProfile.showOnLeaderboard ?? true);
      setLeaderboardAnonymous(userProfile.leaderboardAnonymous === true);
      setShowOnGroupLeaderboard(userProfile.showOnGroupLeaderboard);
      setGroupLeaderboardAnonymous(userProfile.groupLeaderboardAnonymous === true);
    } catch {
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (user) loadProfile();
  }, [user, loading, router, loadProfile]);

  useEffect(() => {
    setHasPendingGroup(!!(typeof window !== 'undefined' && localStorage.getItem('pendingGroupCode')));
  }, []);

  const validateSocialLink = (value: string): boolean => {
    if (!value.trim()) return true;
    return !!detectSocialType(value);
  };

  const addSocialLink = () => {
    if (socialLinks.length < 3) setSocialLinks([...socialLinks, '']);
  };

  const removeSocialLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
    setSocialLinkErrors(socialLinkErrors.filter((_, i) => i !== index));
  };

  const updateSocialLink = (index: number, value: string) => {
    setSocialLinks(prev => prev.map((v, i) => i === index ? value : v));
    setSocialLinkErrors(prev => prev.map((e, i) => i === index ? null : e));
  };

  const handleSave = async () => {
    if (!user) return;

    const errors = socialLinks.map(l =>
      !l.trim() ? null : (validateSocialLink(l) ? null : 'Not a social link. Try Instagram, X/Twitter, LinkedIn, or GitHub.')
    );
    if (errors.some(e => e)) {
      setSocialLinkErrors(errors);
      return;
    }
    setSocialLinkErrors([]);

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const socialHandles: Record<string, string | string[]> = {};
      if (website.trim()) socialHandles.website = normalizeUrl(website);
      const links = socialLinks.filter(l => l.trim() && validateSocialLink(l)).map(normalizeUrl);
      if (links.length) socialHandles.socialLinks = links;

      await updateUserProfile(user.uid, {
        socialHandles,
        emailNotifications,
        showOnLeaderboard: showOnLeaderboard ?? true,
        leaderboardAnonymous,
        showOnGroupLeaderboard: showOnGroupLeaderboard ?? false,
        groupLeaderboardAnonymous,
      });
      setSuccess('Saved!');
      const pendingCode = typeof window !== 'undefined' ? localStorage.getItem('pendingGroupCode') : null;
      if (pendingCode) {
        localStorage.removeItem('pendingGroupCode');
        setTimeout(() => router.push(`/join-group?code=${pendingCode}`), 800);
      } else {
        setTimeout(() => router.push('/dashboard'), 800);
      }
    } catch {
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading profile...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/dashboard" />

      <main className="max-w-xl mx-auto px-5 py-10">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Edit your preferences</p>
        </header>

        {error && <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>}
        {success && <p className="mb-4 text-green-600 dark:text-green-400 text-sm">{success}</p>}

        {/* User info */}
        <div className="flex items-center gap-4 mb-8">
          {user.photoURL && !imageError ? (
            <Image 
              src={user.photoURL} 
              alt="" 
              width={56} 
              height={56} 
              className="w-14 h-14 rounded-full object-cover" 
              unoptimized 
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl font-semibold text-gray-600 dark:text-gray-300 shrink-0">
              {(user.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{user.displayName || 'User'}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
          </div>
        </div>

        {/* Social links */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Social links
          </label>
          <div className="space-y-3">
            {socialLinks.map((link, i) => (
              <div key={i} className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => updateSocialLink(i, e.target.value)}
                    onBlur={() => {
                      if (link.trim() && !validateSocialLink(link)) {
                        setSocialLinkErrors(prev => {
                          const next = [...prev];
                          while (next.length <= i) next.push(null);
                          next[i] = 'Not a social link. Try Instagram, X/Twitter, LinkedIn, or GitHub.';
                          return next;
                        });
                      }
                    }}
                    placeholder="https://instagram.com/you or twitter.com/you"
                    className={`flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm ${
                      socialLinkErrors[i] ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  />
                  {socialLinks.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeSocialLink(i)}
                      aria-label="Remove link"
                      className="px-3 py-2.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                {socialLinkErrors[i] && (
                  <p className="text-sm text-red-600 dark:text-red-400">{socialLinkErrors[i]}</p>
                )}
              </div>
            ))}
          </div>
          {socialLinks.length < 3 && (
            <button
              type="button"
              onClick={addSocialLink}
              className="mt-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-400 dark:hover:border-gray-500"
            >
              + Add link
            </button>
          )}
        </div>

        {/* Personal website */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Personal website
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourwebsite.com"
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
          />
        </div>

        {/* Preferences */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Preferences</h2>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-400">Dark mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                theme === 'dark' ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-400">Email when someone rates you</span>
            <button
              type="button"
              role="switch"
              aria-checked={emailNotifications}
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                emailNotifications ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${
                  emailNotifications ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-400">Show on global leaderboard</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showOnLeaderboard}
                  onClick={() => setShowOnLeaderboard(!showOnLeaderboard)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    showOnLeaderboard ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${
                      showOnLeaderboard ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-400">Show as anonymous on global leaderboard</span>
            <button
              type="button"
              role="switch"
              aria-checked={leaderboardAnonymous}
              onClick={() => {
                const next = !leaderboardAnonymous;
                setLeaderboardAnonymous(next);
                if (next) setShowOnLeaderboard(true);
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                leaderboardAnonymous ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${
                  leaderboardAnonymous ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-400">Show on group results</span>
            <button
              type="button"
              role="switch"
              aria-checked={showOnGroupLeaderboard}
              onClick={() => setShowOnGroupLeaderboard(!showOnGroupLeaderboard)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                showOnGroupLeaderboard ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${
                  showOnGroupLeaderboard ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-400">Show as anonymous on group results</span>
            <button
              type="button"
              role="switch"
              aria-checked={groupLeaderboardAnonymous}
              onClick={() => {
                const next = !groupLeaderboardAnonymous;
                setGroupLeaderboardAnonymous(next);
                if (next) setShowOnGroupLeaderboard(true);
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                groupLeaderboardAnonymous ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${
                  groupLeaderboardAnonymous ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>

        <div className="mt-8 flex gap-3">
          {hasPendingGroup && (
            <button
              type="button"
              onClick={() => {
                const code = localStorage.getItem('pendingGroupCode');
                if (code) {
                  localStorage.removeItem('pendingGroupCode');
                  setHasPendingGroup(false);
                  router.push(`/join-group?code=${code}`);
                }
              }}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:opacity-90 disabled:opacity-50 text-sm"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </main>
    </div>
  );
}
