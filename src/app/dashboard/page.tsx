'use client';

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserRemainingPoints, getUserDistributedPoints, getUserTotalAura } from "@/lib/firestore";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [remainingPoints, setRemainingPoints] = useState(10000);
  const [distributedPoints, setDistributedPoints] = useState(0);
  const [totalAura, setTotalAura] = useState(500);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }

    if (user) {
      loadUserStats();
    }
  }, [user, loading, router]);

  const loadUserStats = async () => {
    if (!user) return;
    try {
      const [remaining, distributed, aura] = await Promise.all([
        getUserRemainingPoints(user.uid),
        getUserDistributedPoints(user.uid),
        getUserTotalAura(user.uid)
      ]);
      
      setRemainingPoints(remaining);
      setDistributedPoints(distributed);
      setTotalAura(aura);
    } catch (err) {
      console.error('Failed to load user stats:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-base sm:text-lg">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
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
              <Link href="/leaderboard" className="px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700 text-sm">
                Leaderboard
              </Link>
              <button
                onClick={handleSignOut}
                className="px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-red-300 text-red-600 text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="text-center text-gray-900 mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-4">Welcome to Aura</h1>
          <p className="text-lg sm:text-xl text-gray-600">Start rating your friends and building your aura score</p>
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8 mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full"
                />
              )}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{user.displayName || 'User'}</h2>
                <p className="text-gray-500 text-sm sm:text-base">{user.email}</p>
              </div>
            </div>
            <Link 
              href="/profile"
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm text-center"
            >
              Edit Profile
            </Link>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center text-gray-900 shadow-sm border border-gray-200">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">{totalAura.toLocaleString()}</div>
              <div className="text-gray-500 text-xs sm:text-sm">Total Aura</div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center text-gray-900 shadow-sm border border-gray-200">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">{remainingPoints.toLocaleString()}</div>
              <div className="text-gray-500 text-xs sm:text-sm">Points to Give</div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center text-gray-900 shadow-sm border border-gray-200">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-2">{distributedPoints.toLocaleString()}</div>
              <div className="text-gray-500 text-xs sm:text-sm">Total Points Used</div>
            </div>
          </div>
          <div className="mt-4 sm:mt-6 text-center text-gray-500 text-xs sm:text-sm bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            💡 Both positive and negative ratings count against your 10,000 point limit.
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <Link href="/create-group" className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm border border-gray-200 hover:shadow-md transition-all text-center group">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-blue-200 transition-colors">
              <svg className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Create Group</h3>
            <p className="text-gray-600 text-xs sm:text-sm">Start a new aura rating session with your friends</p>
          </Link>
          
          <Link href="/join-group" className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm border border-gray-200 hover:shadow-md transition-all text-center group">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-green-200 transition-colors">
              <svg className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Join Group</h3>
            <p className="text-gray-600 text-xs sm:text-sm">Join an existing group session using a code</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Link href="/leaderboard" className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm border border-gray-200 hover:shadow-md transition-all text-center group">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-purple-200 transition-colors">
              <svg className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">View Rankings</h3>
            <p className="text-gray-600 text-xs sm:text-sm">See the global aura leaderboard and your position</p>
          </Link>
          
          <Link href="/my-groups" className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm border border-gray-200 hover:shadow-md transition-all text-center group">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-orange-200 transition-colors">
              <svg className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">My Groups</h3>
            <p className="text-gray-600 text-xs sm:text-sm">View and manage your created and joined groups</p>
          </Link>
        </div>

        {/* Quick Actions Section */}
        <div className="mt-8 sm:mt-12 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6 sm:mb-8">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center text-gray-900">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h4 className="text-base sm:text-lg font-semibold mb-2">Rate Friends</h4>
              <p className="text-gray-600 text-xs sm:text-sm">Give and receive aura ratings to build your social reputation.</p>
            </div>
            <div className="text-center text-gray-900">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h4 className="text-base sm:text-lg font-semibold mb-2">Join Groups</h4>
              <p className="text-gray-600 text-xs sm:text-sm">Connect with friends and participate in group rating sessions.</p>
            </div>
            <div className="text-center text-gray-900">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-base sm:text-lg font-semibold mb-2">Track Progress</h4>
              <p className="text-gray-600 text-xs sm:text-sm">Monitor your aura score and see how you rank globally.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 