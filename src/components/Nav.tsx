'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

export function Nav({ 
  showAuth = false, 
  showBack = false, 
  backHref = '/dashboard',
  rightContent 
}: { 
  showAuth?: boolean; 
  showBack?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <nav className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-medium text-gray-900 dark:text-gray-100">
          <Image src="/logo.png" alt="Aura" width={28} height={28} className="rounded" />
          Aura
        </Link>
        <div className="flex items-center gap-2">
          {rightContent}
          {showBack && (
            <Link href={backHref} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Back
            </Link>
          )}
          <ThemeToggle />
          {showAuth && (
            <>
              <Link href="/login" className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                Log in
              </Link>
              <Link href="/signup" className="px-3 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-md hover:opacity-90">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
