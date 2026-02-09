/** Legend for each score value on the rating scale */
export const SCORE_LEGEND: Record<number, string> = {
  [-2000]: 'Very low',
  [-1500]: 'Low',
  [-1000]: 'Below average',
  [-500]: 'Slightly low',
  0: 'Neutral',
  500: 'Slightly high',
  1000: 'Above average',
  1500: 'High',
  2000: 'Exceptional',
};

export function getScoreLegend(score: number): string {
  return SCORE_LEGEND[score] ?? (score < 0 ? 'Very low' : 'Exceptional');
}
