'use client';

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { getGroupByCode, joinGroup } from "@/lib/firestore";

function JoinGroupContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState('');

  // Check for code in URL parameters
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      const code = codeFromUrl.toUpperCase();
      setGroupCode(code);
      // Store the group code for redirect after authentication
      localStorage.setItem('pendingGroupCode', code);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Cleanup pending group code when component unmounts if user didn't join
  useEffect(() => {
    return () => {
      // Only clear if user is authenticated and hasn't joined yet
      if (user && !success) {
        // Don't clear here - let the user keep trying to join
        // Only clear on successful join or when redirecting to group
      }
    };
  }, [user, success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsJoining(true);
    setError(null);
    setSuccess(null);

    try {
      if (!groupCode.trim()) {
        throw new Error('Group code is required');
      }

      const code = groupCode.trim().toUpperCase();
      const group = await getGroupByCode(code);

      if (!group) {
        throw new Error('Group not found. Please check the code.');
      }

      if (!group.isActive) {
        throw new Error('This group session is no longer active.');
      }

      await joinGroup(group.id!, user);
      
      // Clear any pending group code since we've successfully joined
      localStorage.removeItem('pendingGroupCode');
      
      setSuccess(`Successfully joined "${group.name}"! Redirecting...`);
      setTimeout(() => {
        router.push(`/group/${group.id}`);
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setIsJoining(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setGroupCode(value);
    // Store the group code for redirect after authentication
    if (value.trim()) {
      localStorage.setItem('pendingGroupCode', value);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-base sm:text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3">
              <Image 
                src="/logo.png" 
                alt="Aura Logo" 
                width={28} 
                height={28} 
                className="rounded-lg sm:w-8 sm:h-8"
              />
              <span className="text-xl sm:text-2xl font-bold text-gray-900">Aura</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              {user && (
                <div className="hidden sm:flex items-center gap-3">
                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-600">
                    {user.displayName || 'User'}
                  </span>
                </div>
              )}
              <Link href="/dashboard" className="px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700 text-sm">
                Dashboard
              </Link>
              <button
                onClick={() => router.push('/')}
                className="px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-red-300 text-red-600 text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Join Group Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="max-w-md mx-auto">
          <div className="text-center text-gray-900 mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-4">Join Group Session</h1>
            <p className="text-lg sm:text-xl text-gray-600">Enter the group code to join an aura rating session</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8">
            {error && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="groupCode" className="block text-gray-900 font-medium mb-2 text-sm sm:text-base">
                  Group Code
                </label>
                <input
                  type="text"
                  id="groupCode"
                  value={groupCode}
                  onChange={handleInputChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors text-center text-lg sm:text-2xl font-mono tracking-widest"
                  placeholder="ABC123"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Enter the 6-character code shared with you
                </p>
              </div>

              <button
                type="submit"
                disabled={isJoining || !groupCode.trim()}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Joining Group...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Join Group Session
                  </span>
                )}
              </button>
            </form>

            <div className="mt-4 sm:mt-6 text-center">
              <p className="text-gray-600 text-sm sm:text-base">
                Or{" "}
                <Link href="/create-group" className="text-blue-600 hover:text-blue-700 transition-colors font-medium">
                  create a new group
                </Link>
              </p>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-6 sm:mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 sm:p-6 border border-blue-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 text-center">How to Join</h3>
            <ul className="text-gray-700 text-xs sm:text-sm space-y-2 sm:space-y-3">
              <li className="flex items-start gap-2 sm:gap-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-xs font-bold">1</span>
                </div>
                <span>Ask the group creator for the 6-character code</span>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-xs font-bold">2</span>
                </div>
                <span>Enter the code above and click &quot;Join Group Session&quot;</span>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-xs font-bold">3</span>
                </div>
                <span>Start rating your friends&apos; aura in the group</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function JoinGroup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-base sm:text-lg">Loading...</div>
        </div>
      </div>
    }>
      <JoinGroupContent />
    </Suspense>
  );
} 