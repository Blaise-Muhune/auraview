'use client';

export interface ShareableCardProps {
  displayName: string;
  rank: number;
  totalInGroup: number;
  groupName: string;
  totalAura: number;
  auraLevel?: string;
  headline: string;
  subline: string;
}

/** Card designed for capture as image - shareable, drives traffic to auraview.app */
export function ShareableCard({
  displayName,
  rank,
  totalAura,
  headline,
  subline,
}: ShareableCardProps) {
  // 360x540 - 2:3 ratio, works well for Instagram/stories
  const w = 360;
  const h = 540;

  const isFirst = rank === 1;
  const isNegative = totalAura < 500;
  const scoreColor = isNegative ? '#eab308' : '#22c55e';
  const scoreBg = isNegative ? 'rgba(234, 179, 8, 0.12)' : 'rgba(34, 197, 94, 0.12)';
  const scoreBorder = isNegative ? 'rgba(234, 179, 8, 0.35)' : 'rgba(34, 197, 94, 0.35)';

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: w,
        height: h,
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: 'inset 0 0 0 1px rgba(251, 191, 36, 0.15)',
      }}
    >
      {/* Top accent stripe */}
      <div
        style={{
          height: 3,
          background: isFirst
            ? 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)'
            : 'linear-gradient(90deg, #475569, #64748b)',
          opacity: 0.9,
        }}
      />

      <div style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Rank badge */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: isFirst
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'ui-monospace, monospace',
            marginBottom: 20,
            boxShadow: isFirst
              ? '0 4px 20px rgba(245, 158, 11, 0.4)'
              : '0 4px 12px rgba(0, 0, 0, 0.5)',
            border: isFirst ? '2px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(255,255,255,0.1)',
          }}
        >
          #{rank}
        </div>

        {/* Name */}
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#f8fafc',
            margin: 0,
            marginBottom: 6,
            textAlign: 'center',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}
        >
          {displayName}
        </h1>

        {/* Subline */}
        <p
          style={{
            fontSize: 13,
            color: '#94a3b8',
            margin: 0,
            marginBottom: 24,
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {subline}
        </p>

        {/* Score pill */}
        <div
          style={{
            padding: '10px 20px',
            background: scoreBg,
            border: `1px solid ${scoreBorder}`,
            borderRadius: 999,
            marginBottom: 28,
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 20,
              fontWeight: 700,
              color: scoreColor,
              letterSpacing: '0.05em',
            }}
          >
            +{totalAura.toLocaleString()}
          </span>
          <span style={{ fontSize: 14, color: scoreColor, marginLeft: 6, fontWeight: 500 }}>aura</span>
        </div>

        {/* Headline quote */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8px',
            background: 'rgba(15, 23, 42, 0.5)',
            borderRadius: 12,
            border: '1px solid rgba(71, 85, 105, 0.4)',
          }}
        >
          <p
            style={{
              fontSize: 18,
              color: '#e2e8f0',
              textAlign: 'center',
              lineHeight: 1.5,
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            &ldquo;{headline}&rdquo;
          </p>
        </div>

        {/* CTA - drive traffic */}
        <div
          style={{
            width: '100%',
            padding: 18,
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
            textAlign: 'center',
            marginTop: 20,
            borderTop: '1px solid rgba(71, 85, 105, 0.5)',
          }}
        >
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, marginBottom: 4, letterSpacing: '0.03em' }}>
            Rate friends. See your ranking.
          </p>
          <p
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#f59e0b',
              margin: 0,
              letterSpacing: '0.08em',
            }}
          >
            auraview.app
          </p>
        </div>
      </div>
    </div>
  );
}
