/** localStorage keys for first-run / dismissible UX tips */

export const UX_KEYS = {
  onboardingDone: 'aura_onboarding_done',
  scoringHelpDismissed: 'aura_scoring_help_dismissed',
} as const;

export function isOnboardingDone(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(UX_KEYS.onboardingDone) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(UX_KEYS.onboardingDone, '1');
  } catch {
    // ignore
  }
}

export function isScoringHelpDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(UX_KEYS.scoringHelpDismissed) === '1';
  } catch {
    return false;
  }
}

export function dismissScoringHelp(): void {
  try {
    localStorage.setItem(UX_KEYS.scoringHelpDismissed, '1');
  } catch {
    // ignore
  }
}
