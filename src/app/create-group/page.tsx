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
  const [success, setSuccess] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    expectedCount: 8,
    memberNamesText: '',
    votingDurationDays: 7,
    minVotersToClose: '' as number | '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/leaderboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await ensureUserProfile(user);
      setProfileLoading(false);
    })();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.name.trim()) {
        throw new Error('Group name is required');
      }

      const slotLabels = formData.memberNamesText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const expectedCount = Math.max(2, Math.min(100, Number(formData.expectedCount) || 8));
      await createGroupSession(
        formData.name.trim(),
        formData.description.trim(),
        user,
        expectedCount,
        formData.votingDurationDays,
        typeof formData.minVotersToClose === 'number' ? formData.minVotersToClose : undefined,
        slotLabels.length > 0 ? slotLabels : undefined
      );

      setSuccess(`Group created! Redirecting...`);
      setTimeout(() => {
        router.push('/my-groups');
      }, 1200);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/dashboard" />
      <main className="max-w-xl mx-auto px-5 py-10">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Create group</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Name it, get a code</p>
        </header>
        <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            {error && <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>}
            {success && <p className="mb-4 text-green-600 dark:text-green-400 text-sm">{success}</p>}

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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How many people will be in this group (including you)</p>
              </div>

              <div>
                <label htmlFor="memberNamesText" className="block text-gray-900 dark:text-gray-100 text-sm font-medium mb-2">
                  Add names <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="memberNamesText"
                  name="memberNamesText"
                  value={formData.memberNamesText}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 resize-y text-sm"
                  placeholder={'Your name first, then others — one per line or commas\ne.g. Jamie\nAlex, Sam'}
                />
                <div className="mt-2 space-y-2 text-xs text-gray-500 dark:text-gray-400">
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-300">You are already in the group.</span>{' '}
                    You do not need to add yourself as an extra person; &quot;Number of people&quot; already includes you.
                  </p>
                  <p>
                    If you add names, the <span className="font-medium text-gray-700 dark:text-gray-300">first name is your slot</span>{' '}
                    (the label for you as host). Put <span className="font-medium text-gray-700 dark:text-gray-300">your name on the first line</span>, then everyone else you expect—joiners pick an open slot and can tweak the label.
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