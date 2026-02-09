/**
 * Generate short, quotable insights from rating data.
 * Framed positively - what friends appreciate, not scores/rankings.
 */

export interface InsightInput {
  totalAura: number;
  ratingsReceived: number;
  reasons: string[];
  isTopInGroup?: boolean;
}

// Positive, shareable insight phrases - "what friends see in you"
const PRESENCE_INSIGHTS = [
  "Your presence is your strongest trait.",
  "You light up the room without trying.",
  "People feel your energy the moment you walk in.",
];

const AUTHENTICITY_INSIGHTS = [
  "You show up as yourself—and that's rare.",
  "Your authenticity shines through.",
  "People appreciate how real you are.",
];

const APPRECIATION_INSIGHTS = [
  "Your friends really see you.",
  "People appreciate what you bring to their lives.",
  "You leave a lasting impression on those around you.",
];

const IMPACT_INSIGHTS = [
  "You make people feel good just by being around.",
  "Your vibe resonates with everyone you meet.",
  "You're the kind of person people remember.",
];

const STRENGTH_INSIGHTS = [
  "Your character speaks louder than words.",
  "You carry yourself with quiet confidence.",
  "People notice your steadiness.",
];

export function generateInsight(input: InsightInput): string {
  const { totalAura, ratingsReceived, reasons } = input;
  const hasReasons = reasons.length > 0;
  const highAura = totalAura >= 2000;
  const manyRatings = ratingsReceived >= 3;

  // If we have compliment reasons, use the first meaningful one as the primary insight
  if (hasReasons && reasons[0]?.trim()) {
    const reason = reasons[0].trim();
    // Format as quotable if it's short enough
    if (reason.length <= 80) {
      return `"${reason}"`;
    }
    return reason;
  }

  // Generate based on aura level and engagement
  const allInsights = [
    ...(highAura ? PRESENCE_INSIGHTS : []),
    ...(manyRatings ? AUTHENTICITY_INSIGHTS : []),
    ...APPRECIATION_INSIGHTS,
    ...(highAura ? IMPACT_INSIGHTS : []),
    ...STRENGTH_INSIGHTS,
  ];

  // Pick deterministically based on totalAura for consistency
  const index = totalAura % Math.max(1, allInsights.length);
  return allInsights[index] || APPRECIATION_INSIGHTS[0];
}

export function generateShareableInsights(input: InsightInput): string[] {
  const insights: string[] = [];
  const { reasons } = input;

  // Primary insight
  insights.push(generateInsight(input));

  // Add a reason as secondary if we have multiple
  if (reasons.length > 1 && reasons[1]?.trim() && reasons[1].length <= 80) {
    insights.push(`"${reasons[1].trim()}"`);
  }

  return insights.slice(0, 3); // Max 3 insights
}

export interface RankCardInput {
  rank: number;
  totalInGroup: number;
  groupName: string;
  displayName: string;
  totalAura: number;
}

// Straightforward, shareable messages for each rank
const RANK_1_MESSAGES = [
  "#1 in {groupName}",
  "First place",
  "Top of the group",
];

const RANK_2_MESSAGES = [
  "#2 in {groupName}",
  "Second place",
  "Runner-up",
];

const RANK_3_MESSAGES = [
  "#3 in {groupName}",
  "Third place",
  "Top 3",
];

const RANK_OTHER_MESSAGES = [
  "Ranked in {groupName}",
  "Part of {groupName}",
  "Joined the group",
];

export function generateRankCard(input: RankCardInput): { headline: string; subline: string; shareText: string } {
  const { rank, totalInGroup, groupName, displayName, totalAura } = input;
  const group = groupName || 'the group';
  const name = displayName || 'You';

  let subline: string;
  const messages = rank === 1 ? RANK_1_MESSAGES 
    : rank === 2 ? RANK_2_MESSAGES 
    : rank === 3 ? RANK_3_MESSAGES 
    : RANK_OTHER_MESSAGES;
  const headline = messages[totalAura % messages.length]?.replace('{groupName}', group) ?? messages[0]!.replace('{groupName}', group);

  if (rank === 1) {
    subline = `#1 of ${totalInGroup} in ${group}`;
  } else if (rank <= 3) {
    subline = `#${rank} of ${totalInGroup} in ${group}`;
  } else {
    subline = `Ranked in ${group} — ${totalAura.toLocaleString()} aura`;
  }

  const shareText = `${name}: "${headline}" — ${subline} (Aura)`;
  return { headline, subline, shareText };
}
