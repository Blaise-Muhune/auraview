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
    maxParticipants: 50,
    votingDurationDays: 7,
    minVotersToClose: '' as number | '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
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

      await createGroupSession(
        formData.name.trim(),
        formData.description.trim(),
        user,
        formData.maxParticipants,
        formData.votingDurationDays,
        typeof formData.minVotersToClose === 'number' ? formData.minVotersToClose : undefined
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
                    <label htmlFor="maxParticipants" className="block text-gray-900 dark:text-gray-100 font-medium mb-2 text-sm">
                      Max Participants
                    </label>
                    <input
                      type="number"
                      id="maxParticipants"
                      name="maxParticipants"
                      value={formData.maxParticipants}
                      onChange={handleInputChange}
                      min="2"
                      max="100"
                      className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-500 text-sm"
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