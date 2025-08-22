'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getUserGroups, leaveGroup, GroupSession } from "@/lib/firestore";
import { collection, query, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MyGroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const [visibleCodes, setVisibleCodes] = useState<{[key: string]: boolean}>({});

  const loadUserGroups = useCallback(async () => {
    try {
      console.log('Loading user groups for user:', user?.uid);
      
      // Test Firestore connection first
      console.log('Testing Firestore connection...');
      const testQuery = query(collection(db, 'groups'), limit(1));
      const testSnapshot = await getDocs(testQuery);
      console.log('Firestore connection test successful, found', testSnapshot.size, 'documents');
      
      const userGroups = await getUserGroups(user!.uid);
      console.log('Loaded groups:', userGroups);
      setGroups(userGroups);
    } catch (error) {
      console.error('Error loading user groups:', error);
      setError('Failed to load your groups');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadUserGroups();
    }
  }, [user, loading, router, loadUserGroups]);

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return;

    setLeavingGroupId(groupId);
    try {
      await leaveGroup(groupId, user.uid);
      // Remove the group from the local state
      setGroups(prev => prev.filter(group => group.id !== groupId));
    } catch {
      setError('Failed to leave group');
    } finally {
      setLeavingGroupId(null);
    }
  };

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp && typeof timestamp === 'object' && 'toDate' in timestamp 
      ? (timestamp as { toDate(): Date }).toDate() 
      : new Date(timestamp as string | number);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGroupStatus = (group: GroupSession) => {
    if (!group.isActive) return { status: 'Inactive', color: 'text-gray-500', bgColor: 'bg-gray-100' };
    if (group.participants.length >= (group.maxParticipants || 50)) {
      return { status: 'Full', color: 'text-red-600', bgColor: 'bg-red-100' };
    }
    return { status: 'Active', color: 'text-green-600', bgColor: 'bg-green-100' };
  };

  const toggleCodeVisibility = (groupId: string) => {
    setVisibleCodes(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg">Loading your groups...</div>
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
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900">Aura</Link>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
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
              <Link href="/dashboard" className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700">
                Dashboard
              </Link>
              <Link href="/leaderboard" className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700">
                Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-900 mb-12">
          <h1 className="text-4xl font-bold mb-4">My Groups</h1>
          <p className="text-xl text-gray-600">Manage your aura rating sessions</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">No Groups Yet</h3>
            <p className="text-gray-600 mb-8">You haven&apos;t joined or created any groups yet.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/create-group"
                className="px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Create Your First Group
              </Link>
              <Link 
                href="/join-group"
                className="px-6 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Join a Group
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {groups.map((group, index) => {
              const isCreator = group.createdBy === user.uid;
              const groupStatus = getGroupStatus(group);
              
              return (
                <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all p-6">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    {/* Group Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{group.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                            <span>
                              Code: 
                              <button
                                onClick={() => toggleCodeVisibility(group.id!)}
                                className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
                              >
                                {visibleCodes[group.id!] ? 'Hide' : 'Show'}
                              </button>
                              {visibleCodes[group.id!] ? (
                                <span className="ml-1 font-mono bg-gray-100 px-2 py-1 rounded">{group.code}</span>
                              ) : (
                                <span className="ml-1 font-mono bg-gray-100 px-2 py-1 rounded">{'•'.repeat(group.code.length)}</span>
                              )}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${groupStatus.bgColor} ${groupStatus.color}`}>
                              {groupStatus.status}
                            </span>
                            {isCreator && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                Creator
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {group.description && (
                        <p className="text-gray-600 mb-4">{group.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span>Created: {formatDate(group.createdAt)}</span>
                        <span>•</span>
                        <span>{group.participants.length} participant{group.participants.length !== 1 ? 's' : ''}</span>
                        {group.maxParticipants && (
                          <>
                            <span>•</span>
                            <span>Max: {group.maxParticipants}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link 
                        href={`/group/${group.id}`}
                        className="px-4 py-2 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors text-sm text-center shadow-sm"
                      >
                        View Group
                      </Link>
                      
                      <Link 
                        href={`/group/${group.id}/rate`}
                        className="px-4 py-2 bg-green-600 rounded-lg text-white font-semibold hover:bg-green-700 transition-colors text-sm text-center shadow-sm"
                      >
                        Rate Friends
                      </Link>
                      
                      <Link 
                        href={`/group/${group.id}/results`}
                        className="px-4 py-2 bg-purple-600 rounded-lg text-white font-semibold hover:bg-purple-700 transition-colors text-sm text-center shadow-sm"
                      >
                        View Results
                      </Link>
                      
                      {!isCreator && (
                        <button
                          onClick={() => handleLeaveGroup(group.id!)}
                          disabled={leavingGroupId === group.id}
                          className="px-4 py-2 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          {leavingGroupId === group.id ? 'Leaving...' : 'Leave Group'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        {groups.length > 0 && (
          <div className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">Quick Actions</h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/create-group"
                className="px-6 py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm text-center"
              >
                Create New Group
              </Link>
              <Link 
                href="/join-group"
                className="px-6 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-200 transition-colors text-center"
              >
                Join Another Group
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 