'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { getGroupById, leaveGroup, GroupSession, getUserProfile } from "@/lib/firestore";

interface GroupPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function GroupPage({ params }: GroupPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [participantNames, setParticipantNames] = useState<{[key: string]: string}>({});
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user && id) {
      loadGroup();
    }
  }, [user, loading, id, router]);

  useEffect(() => {
    if (group) {
      loadParticipantNames();
    }
  }, [group]);

  const loadGroup = async () => {
    try {
      const groupData = await getGroupById(id);
      if (!groupData) {
        setError('Group not found');
        return;
      }
      setGroup(groupData);
    } catch (err) {
      setError('Failed to load group');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParticipantNames = async () => {
    if (!group) return;
    
    const names: {[key: string]: string} = {};
    
    // Load names for all participants
    for (const participantId of group.participants) {
      try {
        const userProfile = await getUserProfile(participantId);
        if (userProfile) {
          names[participantId] = userProfile.displayName;
        } else {
          names[participantId] = 'Anonymous User';
        }
      } catch (err) {
        console.error(`Failed to load profile for ${participantId}:`, err);
        names[participantId] = 'Anonymous User';
      }
    }
    
    setParticipantNames(names);
  };

  const handleLeaveGroup = async () => {
    if (!user || !group) return;

    setIsLeaving(true);
    try {
      await leaveGroup(group.id!, user.uid);
      router.push('/dashboard');
    } catch (err) {
      setError('Failed to leave group');
    } finally {
      setIsLeaving(false);
    }
  };

  const copyGroupLink = async () => {
    if (!group) return;

    const groupUrl = `${window.location.origin}/join-group?code=${group.code}`;
    try {
      await navigator.clipboard.writeText(groupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = groupUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyGroupCode = async () => {
    if (!group) return;

    try {
      await navigator.clipboard.writeText(group.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = group.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-base sm:text-lg">Loading group...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/dashboard" className="text-xl sm:text-2xl font-bold text-gray-900">Aura</Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Group Not Found</h2>
              <p className="text-gray-600 mb-6 text-sm sm:text-base">{error || 'The group you are looking for does not exist.'}</p>
              <Link href="/dashboard" className="inline-block px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm text-sm sm:text-base">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isCreator = group.createdBy === user.uid;
  const isParticipant = group.participants.includes(user.uid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="text-xl sm:text-2xl font-bold text-gray-900">Aura</Link>
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
              <Link href="/my-groups" className="px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700 text-sm">
                My Groups
              </Link>
              {isParticipant && (
                <button
                  onClick={handleLeaveGroup}
                  disabled={isLeaving}
                  className="px-3 sm:px-4 py-2 rounded-lg hover:bg-red-50 transition-colors border border-red-200 hover:border-red-300 text-red-600 disabled:opacity-50 text-sm"
                >
                  {isLeaving ? 'Leaving...' : 'Leave Group'}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Group Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="text-center text-gray-900 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{group.name}</h1>
          {group.description && (
            <p className="text-base sm:text-lg text-gray-600 mb-2">{group.description}</p>
          )}
          <p className="text-gray-500 text-xs sm:text-sm">
            Created by {group.createdByDisplayName}
          </p>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Group Code & Share Section - Compact Inline Layout */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6">
            {/* Group Code */}
            <div className="flex-1 text-center lg:text-left">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Group Code</h3>
              <div className="inline-flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                >
                  {showCode ? 'Hide' : 'Show'}
                </button>
                <div className="text-lg sm:text-xl font-bold font-mono tracking-widest text-gray-900">
                  {showCode ? group.code : '•'.repeat(group.code.length)}
                </div>
              </div>
            </div>

            {/* Share Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={copyGroupLink}
                className="px-3 sm:px-4 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap"
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={copyGroupCode}
                className="px-3 sm:px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-200 transition-colors text-xs sm:text-sm whitespace-nowrap"
              >
                {copied ? '✓ Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 text-center">
            Participants ({group.participants.length}/{group.maxParticipants || '∞'})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {group.participants.map((participantId, index) => (
              <div key={participantId} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                  {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : (index + 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 font-medium text-xs sm:text-sm truncate">
                    {participantId === group.createdBy 
                      ? (
                        <Link 
                          href={`/profile/${participantId}`}
                          className="hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {group.createdByDisplayName} (Creator)
                        </Link>
                      ) : (
                        <Link 
                          href={`/profile/${participantId}`}
                          className="hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {participantNames[participantId] || 'Loading...'}
                        </Link>
                      )}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {participantId === user.uid ? 'You' : 'Member'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Link href={`/group/${group.id}/rate`} className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all text-center group">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-blue-200 transition-colors">
              <svg className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518-4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Rate Friends</h3>
            <p className="text-gray-600 text-xs sm:text-sm">Distribute your aura points to group members</p>
          </Link>
          
          <Link href={`/group/${group.id}/results`} className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all text-center group">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-green-200 transition-colors">
              <svg className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">View Results</h3>
            <p className="text-gray-600 text-xs sm:text-sm">See the aura rankings for this group</p>
          </Link>
        </div>
      </main>
    </div>
  );
} 