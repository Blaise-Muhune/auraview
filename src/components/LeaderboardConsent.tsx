'use client';

import { useState } from 'react';

type Choice = { show: boolean; anonymous: boolean };

const DEFAULT_CHOICE: Choice = { show: true, anonymous: false };

interface LeaderboardConsentProps {
  displayName: string;
  /** When true, one choice applies to both global leaderboard and group results (anonymous = anonymous everywhere, else visible everywhere). */
  includeGroupLeaderboard?: boolean;
  onSave: (choice: Choice) => Promise<void>;
  isLoading?: boolean;
}

const CHOICES: { show: boolean; anonymous: boolean; label: string }[] = [
  { show: true, anonymous: false, label: 'Show my name' },
  { show: true, anonymous: true, label: 'Anonymous' },
];

export function LeaderboardConsent({
  displayName,
  includeGroupLeaderboard = false,
  onSave,
  isLoading,
}: LeaderboardConsentProps) {
  const [choice, setChoice] = useState<Choice>(DEFAULT_CHOICE);

  const handleContinue = async () => {
    await onSave(choice);
  };

  const title = includeGroupLeaderboard
    ? 'How do you want to appear on leaderboards and group results?'
    : 'How do you want to appear on the leaderboard?';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Visibility preference
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {includeGroupLeaderboard
            ? 'Your name is shown by default. Choose Anonymous to hide your name on leaderboards and group results.'
            : 'Your name is shown by default. You can change this anytime in your profile.'}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {CHOICES.map((c) => (
            <button
              key={`${c.show}-${c.anonymous}`}
              type="button"
              onClick={() => setChoice(c)}
              disabled={!!isLoading}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                choice.show === c.show && choice.anonymous === c.anonymous
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {c.label === 'Show my name' ? displayName || 'My name' : c.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={isLoading}
        className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isLoading ? 'Saving...' : 'Continue'}
      </button>
    </div>
  );
}
