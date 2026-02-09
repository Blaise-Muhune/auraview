'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Nav } from "@/components/Nav";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
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
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showAuth />

      <main className="max-w-xl mx-auto px-5 py-10">
        <header className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Aura</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Discover what friends actually think about you
          </p>
        </header>

        <p className="text-gray-500 dark:text-gray-400 text-center mb-10 max-w-md mx-auto text-sm">
          Share appreciation with friends. Get insights.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link 
            href="/signup" 
            className="px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 text-center text-[13px]"
          >
            Get started
          </Link>
          <Link 
            href="/leaderboard" 
            className="px-5 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-center text-[13px]"
          >
            View ranking
          </Link>
        </div>
      </main>
    </div>
  );
}
