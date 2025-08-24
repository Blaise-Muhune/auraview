'use client';

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserProfile, ensureUserProfile } from "@/lib/firestore";

export default function Login() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading) {
      // Check if user has social handles set up
      const checkUserProfile = async () => {
        try {
          await ensureUserProfile(user);
          const profile = await getUserProfile(user.uid);
          
          // Check if there's a pending group code to join
          const pendingGroupCode = localStorage.getItem('pendingGroupCode');
          
          if (pendingGroupCode) {
            // Clear the pending group code
            localStorage.removeItem('pendingGroupCode');
            
            // If user has no social handles, redirect to onboarding first
            if (profile && (!profile.socialHandles || Object.keys(profile.socialHandles).length === 0)) {
              // Store the group code again for after onboarding
              localStorage.setItem('pendingGroupCode', pendingGroupCode);
              router.push('/onboarding');
            } else {
              // User is ready, redirect to join the group
              router.push(`/join-group?code=${pendingGroupCode}`);
            }
          } else {
            // No pending group, normal flow
            if (profile && (!profile.socialHandles || Object.keys(profile.socialHandles).length === 0)) {
              router.push('/onboarding');
            } else {
              router.push('/dashboard');
            }
          }
        } catch (err) {
          // If there's an error, just go to dashboard
          router.push('/dashboard');
        }
      };
      
      checkUserProfile();
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center h-auto sm:h-16 py-4 sm:py-0 gap-4 sm:gap-0">
            <Link href="/" className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="Aura Logo" 
                width={32} 
                height={32} 
                className="rounded-lg"
              />
              <span className="text-xl sm:text-2xl font-bold text-gray-900">Aura</span>
            </Link>
            <div className="flex gap-2 w-full sm:w-auto">
              <Link href="/signup" className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm text-center text-sm">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Login Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="max-w-md mx-auto">
          <div className="text-center text-gray-900 mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">Welcome Back</h1>
            <p className="text-lg sm:text-xl text-gray-600">Sign in with Google to continue</p>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isSigningIn ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm sm:text-base">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-blue-600 hover:text-blue-700 transition-colors font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 