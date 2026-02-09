'use client';

import { useState } from 'react';

type Choice = { show: boolean; anonymous: boolean };

const DEFAULT_CHOICE: Choice = { show: true, anonymous: false };

interface LeaderboardConsentProps {
  displayName: string;
  /** When true, show both group and global consent. When false, only global (e.g. direct rate). */
  includeGroupLeaderboard?: boolean;
  onSave: (
    global: Choice,
    group?: Choice
  ) => Promise<void>;
  isLoading?: boolean;
}

const CHOICES: { show: boolean; anonymous: boolean; label: string }[] = [
  { show: true, anonymous: false, label: 'Show my name' },
  { show: true, anonymous: true, label: 'Anonymous' },
  { show: false, anonymous: false, label: "Don't show me" },
];

function ConsentSection({
  title,
  displayName,
  choice,
  onChoice,
  disabled,
}: {
  title: string;
  displayName: string;
  choice: Choice;
  onChoice: (c: Choice) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((c) => (
          <button
            key={`${c.show}-${c.anonymous}`}
            type="button"
            onClick={() => onChoice(c)}
            disabled={disabled}
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
  );
}

export function LeaderboardConsent({
  displayName,
  includeGroupLeaderboard = false,
  onSave,
  isLoading,
}: LeaderboardConsentProps) {
  const [globalChoice, setGlobalChoice] = useState<Choice>(DEFAULT_CHOICE);
  const [groupChoice, setGroupChoice] = useState<Choice>(DEFAULT_CHOICE);
  const [useSameForBoth, setUseSameForBoth] = useState(true);

  const effectiveGroupChoice = useSameForBoth ? globalChoice : groupChoice;

  const handleContinue = async () => {
    await onSave(globalChoice, includeGroupLeaderboard ? effectiveGroupChoice : undefined);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Leaderboard preferences
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          You can change this anytime in your profile.
        </p>
      </div>

      <ConsentSection
        title="Global leaderboard"
        displayName={displayName}
        choice={globalChoice}
        onChoice={setGlobalChoice}
        disabled={!!isLoading}
      />

      {includeGroupLeaderboard && (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useSameForBoth}
              onChange={(e) => setUseSameForBoth(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Same for group results
          </label>
          {!useSameForBoth && (
            <ConsentSection
              title="Group results"
              displayName={displayName}
              choice={groupChoice}
              onChoice={setGroupChoice}
              disabled={!!isLoading}
            />
          )}
        </>
      )}

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
