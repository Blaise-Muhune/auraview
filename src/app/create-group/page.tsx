'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createGroupSession, ensureUserProfile } from "@/lib/firestore";

export default function CreateGroup() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string; name: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    expectedCount: 8,
    hostDisplayName: '',
    memberNamesText: '',
    votingDurationDays: 7,
    minVotersToClose: '' as number | '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=' + encodeURIComponent('/create-group'));
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const profile = await ensureUserProfile(user);
      setFormData((prev) => ({
        ...prev,
        hostDisplayName: prev.hostDisplayName || profile.displayName || user.displayName || '',
      }));
      setProfileLoading(false);
    })();
  }, [user]);

  const inviteUrl = (code: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/join-group?code=${code}`;

  const shareInvite = async (name: string, code: string) => {
    const url = inviteUrl(code);
    const message = `Join our Aura group "${name}" with code ${code}: ${url}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Join ${name} on Aura`, text: message, url });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch {
        // cancelled or failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      setError(`Could not copy. Share this code manually: ${code}`);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsCreating(true);
    setError(null);

    try {
      if (!formData.name.trim()) {
        throw new Error('Group name is required');
      }

      // Names listed are other people only — host is always included automatically
      const otherLabels = formData.memberNamesText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      let expectedCount = Math.max(2, Math.min(100, Number(formData.expectedCount) || 8));
      const minSeats = 1 + otherLabels.length;
      if (minSeats > expectedCount) {
        expectedCount = Math.min(100, minSeats);
      }
      const result = await createGroupSession(
        formData.name.trim(),
        formData.description.trim(),
        user,
        expectedCount,
        formData.votingDurationDays,
        typeof formData.minVotersToClose === 'number' ? formData.minVotersToClose : undefined,
        otherLabels.length > 0 ? otherLabels : undefined,
        formData.hostDisplayName.trim() || undefined
      );

      setCreated({ id: result.id, code: result.code, name: formData.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'memberNamesText') {
        const others = value
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean).length;
        // Host + others
        const minSeats = 1 + others;
        if (minSeats >= 2) next.expectedCount = Math.max(prev.expectedCount, Math.min(100, minSeats));
      }
      return next;
    });
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (created) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/my-groups" />
        <main className="max-w-xl mx-auto px-5 py-10">
          <header className="mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Group created</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{created.name}</p>
          </header>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Invite code</p>
              <p className="font-mono text-3xl sm:text-4xl font-semibold tracking-widest text-gray-900 dark:text-gray-100">{created.code}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => void copyCode(created.code)}
                className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                {codeCopied ? 'Code copied!' : 'Copy code'}
              </button>
              <button
                type="button"
                onClick={() => void shareInvite(created.name, created.code)}
                className="px-4 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90"
              >
                {shared ? 'Invite copied!' : 'Share invite'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Friends join at Join group with this code, or open your invite link. Voting stays open until the time limit or you close the session — filling the group does not lock ratings.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/my-groups"
                className="inline-block w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90"
              >
                Go to My groups
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Rate becomes available once at least one other person joins.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/dashboard" />
      <main className="max-w-xl mx-auto px-5 py-10">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Create group</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Name it, get a code to share with friends</p>
        </header>
        <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            {error && <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="name" className="block text-gray-900 dark:text-gray-100 text-sm mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
                  placeholder="e.g. Weekend Squad"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="expectedCount" className="block text-gray-900 dark:text-gray-100 text-sm font-medium mb-2">
                  Number of people
                </label>
                <input
                  type="number"
                  id="expectedCount"
                  name="expectedCount"
                  value={formData.expectedCount}
                  onChange={handleInputChange}
                  min="2"
                  max="100"
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How many people will be in this group (including you). You can list fewer other names than this — leftover seats stay open for friends to join and type their own names. Voting stays open until the time limit or you close — filling the group does not lock ratings.</p>
              </div>

              <div>
                <label htmlFor="hostDisplayName" className="block text-gray-900 dark:text-gray-100 text-sm font-medium mb-2">
                  Your name in this group
                </label>
                <input
                  type="text"
                  id="hostDisplayName"
                  name="hostDisplayName"
                  value={formData.hostDisplayName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
                  placeholder="Your name"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Filled from your profile automatically — edit only if you want a different label here.</p>
              </div>

              <div>
                <label htmlFor="memberNamesText" className="block text-gray-900 dark:text-gray-100 text-sm font-medium mb-2">
                  Add others <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="memberNamesText"
                  name="memberNamesText"
                  value={formData.memberNamesText}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 resize-y text-sm"
                  placeholder={'Other people — one per line or commas\ne.g. Alex\nSam, Jordan'}
                />
                <div className="mt-2 space-y-2 text-xs text-gray-500 dark:text-gray-400">
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-300">You are already in the group</span>
                    {' '}— do not add yourself here. List friends you know will join; anyone you skip stays an open seat they can claim with their own name.
                  </p>
                  <p>
                    Example: size <span className="font-medium text-gray-700 dark:text-gray-300">8</span> with{' '}
                    <span className="font-medium text-gray-700 dark:text-gray-300">5 other names</span> → you + those 5 + 2 open seats.
                  </p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">How to type names</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Separate names with commas or new lines (or both).</li>
                    <li>Extra spaces around commas are fine; each comma or line break starts the next name.</li>
                    <li>If a name contains a comma (e.g. &quot;Lee, Chris&quot;), put that person on their own line instead of using a comma inside the name.</li>
                  </ul>
                </div>
              </div>

              {showAdvanced && (
                <>
                  <div>
                    <label htmlFor="description" className="block text-gray-900 dark:text-gray-100 font-medium mb-2 text-sm">
                      Description (Optional)
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 resize-none text-sm"
                      placeholder="Optional note..."
                    />
                  </div>
                  <div>
                    <label htmlFor="votingDurationDays" className="block text-gray-900 dark:text-gray-100 font-medium mb-2 text-sm">
                      Voting closes after (days)
                    </label>
                    <input
                      type="number"
                      id="votingDurationDays"
                      name="votingDurationDays"
                      value={formData.votingDurationDays}
                      onChange={handleInputChange}
                      min="1"
                      max="90"
                      className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="minVotersToClose" className="block text-gray-900 dark:text-gray-100 font-medium mb-2 text-sm">
                      Or close when N people have voted (optional)
                    </label>
                    <input
                      type="number"
                      id="minVotersToClose"
                      name="minVotersToClose"
                      value={formData.minVotersToClose === '' ? '' : formData.minVotersToClose}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormData(prev => ({ ...prev, minVotersToClose: v === '' ? '' : parseInt(v, 10) || '' }));
                      }}
                      min="1"
                      max="100"
                      placeholder="Leave empty for time only"
                      className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
                    />
                  </div>
                </>
              )}

              {!showAdvanced && (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  + Add description or limits
                </button>
              )}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 disabled:opacity-50 text-[13px]"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating Group...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Create & Get Code
                  </span>
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              <Link href="/join-group" className="underline">Join a group</Link> instead
            </p>
          </div>
      </main>
    </div>
  );
}
