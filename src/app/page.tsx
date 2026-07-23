'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col relative">
      <Nav showAuth />

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-16 sm:py-24 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-400/10 dark:bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-32 w-64 h-64 bg-amber-300/10 dark:bg-amber-600/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-3">
            Aura
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-2">
            Friends rate your vibe. Climb the rankings.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 max-w-md mx-auto mb-12">
            Share a personal link or start a group — get honest ratings on presence, authenticity, style, and more.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-14">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-all text-center"
            >
              Get started
            </Link>
            <Link
              href="/leaderboard"
              className="w-full sm:w-auto px-8 py-3.5 border-2 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-all text-center"
            >
              Browse rankings
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Share link & get rated
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Closed friend groups
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Global rankings
            </span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
