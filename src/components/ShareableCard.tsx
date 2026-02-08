'use client';

export interface ShareableCardProps {
  displayName: string;
  rank: number;
  totalInGroup: number;
  groupName: string;
  totalAura: number;
  auraLevel: string;
  headline: string;
  subline: string;
}

/** Card designed for capture as image - fixed dimensions, self-contained styles for social share */
export function ShareableCard({
  displayName,
  rank,
  totalAura,
  auraLevel,
  headline,
  subline,
}: ShareableCardProps) {
  // totalInGroup, groupName are passed for interface compatibility but rendered via headline/subline
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // 360x450 base size - html2canvas will scale up for high-res output
  return (
    <div
      className="bg-white text-black rounded-2xl overflow-hidden flex flex-col"
      style={{
        width: 360,
        height: 450,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top gradient bar */}
      <div
        className="flex-shrink-0 h-3"
        style={{
          background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
        }}
      />

      <div className="flex-1 p-12 flex flex-col">
        {/* Rank badge */}
        <div className="flex justify-center mb-6">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg"
            style={{
              background: rank === 1
                ? 'linear-gradient(135deg, #eab308, #ca8a04)'
                : rank === 2
                  ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                  : rank === 3
                    ? 'linear-gradient(135deg, #d97706, #b45309)'
                    : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            }}
          >
            #{rank}
          </div>
        </div>

        {/* Name */}
        <h1
          className="text-4xl font-bold text-center text-gray-900 mb-1"
          style={{ lineHeight: 1.2 }}
        >
          {displayName}
        </h1>

        {/* Subline - ranking */}
        <p className="text-xl text-gray-600 text-center mb-6">
          {subline}
        </p>

        {/* Aura level + total */}
        <div className="flex justify-center gap-6 mb-8">
          <div className="px-5 py-2 rounded-xl bg-blue-50">
            <span className="text-sm text-blue-600 font-medium">{auraLevel}</span>
          </div>
          <div className="px-5 py-2 rounded-xl bg-gray-100">
            <span className="text-lg font-bold text-gray-900">{totalAura.toLocaleString()}</span>
            <span className="text-sm text-gray-600 ml-1">aura</span>
          </div>
        </div>

        {/* Headline - main insight */}
        <div className="flex-1 flex items-center justify-center px-4">
          <p
            className="text-2xl font-semibold text-center text-gray-800 leading-relaxed"
            style={{ maxWidth: 900 }}
          >
            &ldquo;{headline}&rdquo;
          </p>
        </div>

        {/* CTA section */}
        <div className="mt-8 p-6 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-lg font-semibold text-gray-900 text-center mb-2">
            Give me more aura or create your own group
          </p>
          <p className="text-base text-blue-600 font-medium text-center">
            {appUrl}
          </p>
        </div>
      </div>

      {/* App banner */}
      <div
        className="flex-shrink-0 flex items-center justify-center gap-3 py-4 px-6"
        style={{
          background: 'linear-gradient(90deg, #1e3a8a 0%, #312e81 100%)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Aura" width={36} height={36} className="rounded-lg" />
        <span className="text-white text-lg font-bold">Aura</span>
        <span className="text-blue-200 text-sm">— Discover what friends really think</span>
      </div>
    </div>
  );
}
