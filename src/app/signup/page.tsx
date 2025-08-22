'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Signup() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading) {
      router.push('/onboarding'); // Redirect to onboarding after signup
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
          <Link href="/login" className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-purple-300">
            Login
          </Link>
        </div>
      </nav>

      {/* Signup Content */}
      <main className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-md mx-auto">
          <div className="text-center text-gray-700 mb-8">
            <div className="text-4xl mb-4 mystical-text font-bold">✧ Join Aura ✧</div>
            <p className="text-gray-600">Sign up with Google to start rating your friends</p>
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
                Already have an account?{" "}
                <Link href="/login" className="text-purple-500 hover:text-purple-600 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>By signing up, you agree to our{" "}
              <Link href="/terms" className="text-purple-500 hover:text-purple-600">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-cyan-500 hover:text-cyan-600">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 