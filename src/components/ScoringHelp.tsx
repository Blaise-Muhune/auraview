'use client';

import { useEffect, useState } from 'react';
import { dismissScoringHelp, isScoringHelpDismissed } from '@/lib/ux-storage';

type ScoringHelpProps = {
  /** Extra line for one-shot direct / famous ratings */
  oneShotNote?: boolean;
  className?: string;
};

export function ScoringHelp({ oneShotNote = false, className = '' }: ScoringHelpProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isScoringHelpDismissed());
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`mb-6 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-left ${className}`}
      role="note"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
          <p className="font-medium text-gray-900 dark:text-gray-100">How scoring works</p>
          <ul className="list-disc pl-4 space-y-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <li>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">+</span> = stronger aura;{' '}
              <span className="text-rose-600 dark:text-rose-400 font-medium">−</span> = weaker. Neutral (0) is fine.
            </li>
            <li>Use ±500 on each trait (±2,000 max per trait).</li>
            {oneShotNote && <li>You can rate each person once (direct ratings).</li>}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissScoringHelp();
            setVisible(false);
          }}
          className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
