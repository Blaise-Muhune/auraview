'use client';

import Link from "next/link";
import Image from "next/image";
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

      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Image src="/logo.png" alt="Aura" width={64} height={64} className="rounded-lg mx-auto mb-6" />
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Aura</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Discover what friends actually think about you
          </p>
        </div>

        <p className="text-gray-500 dark:text-gray-500 text-center mb-10 max-w-md mx-auto">
          Share appreciation with friends. Get insights and compliments. No judging.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link 
            href="/signup" 
            className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-md hover:opacity-90 text-center"
          >
            Get started
          </Link>
          <Link 
            href="/leaderboard" 
            className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 text-center"
          >
            View ranking
          </Link>
        </div>

        <footer className="border-t border-gray-200 dark:border-gray-800 pt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-500">10,000 points to give and receive each · Create or join groups</p>
        </footer>
      </main>
    </div>
  );
}
