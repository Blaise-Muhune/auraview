'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { ensureUserProfile } from "@/lib/firestore";
import { Nav } from "@/components/Nav";

function LoginContent() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store group code and redirect URL from query params (only when present in this page's URL)
  useEffect(() => {
    const code = searchParams.get('code');
    const redirect = searchParams.get('redirect');
    if (code) {
      localStorage.setItem('pendingGroupCode', code.toUpperCase());
    } else if (typeof window !== 'undefined') {
      // No code in URL this time — clear any stale code so returning users go to dashboard
      localStorage.removeItem('pendingGroupCode');
    }
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      sessionStorage.setItem('loginRedirect', redirect);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !loading) {
      const checkRedirect = async () => {
        try {
          await ensureUserProfile(user);
          const codeInUrl = searchParams.get('code');
          const loginRedirect = sessionStorage.getItem('loginRedirect');
          // Only redirect to join-group if they came to login WITH a code in the link this time
          if (codeInUrl) {
            const code = codeInUrl.toUpperCase();
            localStorage.removeItem('pendingGroupCode');
            router.push(`/join-group?code=${code}`);
          } else if (loginRedirect) {
            sessionStorage.removeItem('loginRedirect');
            router.push(loginRedirect);
          } else {
            router.push('/dashboard');
          }
        } catch {
          router.push('/dashboard');
        }
      };
      checkRedirect();
    }
  }, [user, loading, router, searchParams]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showAuth />

      <main className="max-w-xl mx-auto px-5 py-10">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Log in</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Continue with Google</p>
        </header>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
          className="w-full px-5 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center gap-2 disabled:opacity-50 text-[13px]"
        >
          {isSigningIn ? (
            <span>Signing in...</span>
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

        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
          No account?{' '}
          <Link 
            href={searchParams.get('code') ? `/signup?code=${encodeURIComponent(searchParams.get('code')!)}` : '/signup'} 
            className="text-gray-900 dark:text-gray-100 underline"
          >
            Sign up
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
