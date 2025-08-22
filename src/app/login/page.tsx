'use client';

import Link from "next/link";
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
          
          // If user has no social handles, redirect to onboarding
          if (profile && (!profile.socialHandles || Object.keys(profile.socialHandles).length === 0)) {
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
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
      <div className="min-h-screen bg-gray-50 mystical-bg relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 mystical-text">✧</div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 mystical-bg relative overflow-hidden">
      {/* Simple mystical particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-purple-400/20 text-2xl float">✦</div>
        <div className="absolute top-40 right-20 text-cyan-400/20 text-xl float" style={{animationDelay: '1s'}}>✧</div>
        <div className="absolute bottom-40 left-20 text-emerald-400/20 text-3xl float" style={{animationDelay: '2s'}}>❋</div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-6 text-gray-700">
        <Link href="/" className="text-2xl font-bold mystical-text">✧ Aura ✧</Link>
        <div className="flex gap-4">
          <Link href="/signup" className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-lg hover:from-purple-600 hover:to-cyan-600 transition-all shadow-lg">
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Login Content */}
      <main className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-md mx-auto">
          <div className="text-center text-gray-700 mb-8">
            <div className="text-4xl mb-4 mystical-text font-bold">✧ Welcome Back ✧</div>
            <p className="text-gray-600">Sign in with Google to continue</p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full px-6 py-4 bg-white border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:border-purple-400 hover:bg-purple-50 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningIn ? (
                <>
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              <p className="text-gray-600">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-purple-500 hover:text-purple-600 transition-colors">
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