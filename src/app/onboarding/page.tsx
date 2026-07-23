'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { markOnboardingDone } from '@/lib/ux-storage';

const STEPS = [
  {
    title: 'What is Aura?',
    body: "Friends rate each other's vibe — presence, authenticity, style, and more. Ratings add up to your aura score and place on the rankings.",
  },
  {
    title: 'Two ways to get rated',
    body: 'Share your personal link so anyone can rate you, or create/join a group so a friend circle rates each other in a closed session.',
  },
  {
    title: 'How rating works',
    body: 'Each trait uses +/− points (you can leave traits at 0). Direct ratings are one per person — you can’t re-rate the same friend later.',
  },
] as const;

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login?redirect=' + encodeURIComponent('/onboarding'));
    }
  }, [user, loading, router]);

  const finish = (href: string) => {
    markOnboardingDone();
    router.push(href);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/dashboard" />
      <main className="max-w-xl mx-auto px-5 py-10">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-6">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-3">{current.title}</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed mb-10">{current.body}</p>

        <div className="flex gap-1.5 mb-10" aria-hidden>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-800'}`}
            />
          ))}
        </div>

        {!isLast ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => finish('/dashboard')}
              className="px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:opacity-90"
            >
              Next
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Pick a starting path:</p>
            <Link
              href={`/profile/${user.uid}`}
              onClick={() => markOnboardingDone()}
              className="block w-full py-3.5 px-4 rounded-xl border-2 border-amber-500/50 dark:border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10 text-center font-medium text-gray-900 dark:text-gray-100 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              Share my link
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => finish('/create-group')}
                className="py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                Create group
              </button>
              <button
                type="button"
                onClick={() => finish('/join-group')}
                className="py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                Join group
              </button>
            </div>
            <button
              type="button"
              onClick={() => finish('/dashboard')}
              className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Go to Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
