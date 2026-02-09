'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-gray-200">
              Dashboard
            </Link>
            <Link href="/leaderboard" className="hover:text-gray-900 dark:hover:text-gray-200">
              Leaderboard
            </Link>
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-gray-200">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-gray-200">
              Privacy
            </Link>
        </div>
      </div>
    </footer>
  );
}
