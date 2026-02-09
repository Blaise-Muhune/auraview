'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAIL = 'blaisemu007@gmail.com';

const ChevronLeft = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const GroupsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const RankingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const ProfileIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const SignOutIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

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
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinkClasses = (href: string) => {
    const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
    return `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800/80'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/50'
    }`;
  };

  const menuLink = (href: string, label: string, icon: React.ReactNode) => (
    <Link
      key={href}
      href={href}
      onClick={() => setMenuOpen(false)}
      className={navLinkClasses(href)}
    >
      {icon}
      {label}
    </Link>
  );

  const handleSignOut = async () => {
    setMenuOpen(false);
    try {
      await signOut();
      router.push('/');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <nav className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Back or Logo */}
        <div className="flex items-center gap-3 min-w-0">
          {showBack ? (
            <Link
              href={backHref}
              className="flex items-center gap-1.5 px-2 py-2 -ml-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft />
              <span className="hidden sm:inline">Back</span>
            </Link>
          ) : (
            <Link
              href={user ? '/dashboard' : '/'}
              className="flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:opacity-90 transition-opacity shrink-0"
            >
              <Image src="/logo.png" alt="Aura" width={24} height={24} className="rounded-lg sm:w-7 sm:h-7" />
              <span className="hidden sm:inline text-lg font-semibold">Aura</span>
            </Link>
          )}
        </div>

        {/* Right: on mobile = menu + theme | on desktop = full nav */}
        <div className="flex items-center gap-1">
          {/* Mobile: hamburger + theme only */}
          {user && !showAuth && (
            <>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="sm:hidden flex items-center justify-center w-9 h-9 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </>
          )}
          {showAuth && (
            <div className="sm:hidden flex items-center gap-2">
              <Link href="/login" className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                Log in
              </Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:opacity-90 transition-opacity">
                Sign up
              </Link>
            </div>
          )}

          {/* Desktop: full nav links */}
          {user && !showAuth && (
            <div className="hidden sm:flex items-center gap-1">
              <Link href="/dashboard" className={`px-2 py-1.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/dashboard' ? 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800/80' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>Home</Link>
              <Link href="/my-groups" className={`px-2 py-1.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/my-groups' || pathname?.startsWith('/my-groups') ? 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800/80' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>Groups</Link>
              <Link href="/leaderboard" className={`px-2 py-1.5 text-sm font-medium rounded-lg transition-colors ${pathname?.startsWith('/leaderboard') ? 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800/80' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>Rankings</Link>
            </div>
          )}
          {isAdmin && (
            <Link href="/admin" className="hidden sm:flex items-center px-2 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Admin">
              Admin
            </Link>
          )}
          {rightContent}
          {user && !showAuth && (
            <div className="hidden sm:flex items-center gap-1">
              <Link href="/profile" className="flex items-center justify-center w-9 h-9 px-2 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors" aria-label="Profile">
                <ProfileIcon />
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center w-9 h-9 px-2 py-1.5 text-gray-500 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                aria-label="Sign out"
              >
                <SignOutIcon />
              </button>
            </div>
          )}
          <div className="w-px h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 mx-0.5 sm:mx-1" />
          <ThemeToggle />
          {showAuth && (
            <div className="hidden sm:flex items-center gap-1">
              <Link href="/login" className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                Log in
              </Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:opacity-90 transition-opacity">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && user && !showAuth && (
        <>
          <div
            className="sm:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-20 top-12"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="sm:hidden absolute left-3 right-3 top-full mt-0 max-w-3xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg py-2 z-30">
            {menuLink('/dashboard', 'Home', <HomeIcon />)}
            {menuLink('/my-groups', 'Groups', <GroupsIcon />)}
            {menuLink('/leaderboard', 'Rankings', <RankingsIcon />)}
            {menuLink('/profile', 'Profile', <ProfileIcon />)}
            {isAdmin && (
              <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                <span className="w-5 h-5 flex items-center justify-center font-semibold">A</span>
                Admin
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-left"
            >
              <SignOutIcon />
              Sign out
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
