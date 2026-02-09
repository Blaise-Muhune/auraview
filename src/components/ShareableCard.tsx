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

/** Card designed for capture as image - shareable, drives traffic to auraview.app */
export function ShareableCard({
  displayName,
  rank,
  totalAura,
  auraLevel,
  headline,
  subline,
}: ShareableCardProps) {
  // 360x540 - 2:3 ratio, works well for Instagram/stories
  const w = 360;
  const h = 540;

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: w,
        height: h,
        background: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Accent bar */}
      <div style={{ height: 4, background: '#f59e0b' }} />

      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Rank badge */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: rank === 1 ? '#f59e0b' : '#4b5563',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            fontFamily: 'ui-monospace, monospace',
            marginBottom: 16,
          }}
        >
          #{rank}
        </div>

        {/* Name */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: '#171717',
            margin: 0,
            marginBottom: 4,
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {displayName}
        </h1>

        {/* Subline */}
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0, marginBottom: 20, textAlign: 'center' }}>
          {subline}
        </p>

        {/* Aura level + score */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <div
            style={{
              padding: '8px 14px',
              border: '1px solid #e5e7eb',
              fontSize: 13,
              color: '#6b7280',
            }}
          >
            {auraLevel}
          </div>
          <div
            style={{
              padding: '8px 14px',
              border: '1px solid #f59e0b',
              background: 'rgba(245, 158, 11, 0.1)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 18,
              fontWeight: 700,
              color: '#d97706',
            }}
          >
            {totalAura.toLocaleString()} aura
          </div>
        </div>

        {/* Headline quote */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <p
            style={{
              fontSize: 20,
              color: '#171717',
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
            padding: 16,
            background: '#111827',
            textAlign: 'center',
            marginTop: 20,
          }}
        >
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', margin: 0, marginBottom: 4 }}>
            Discover what your friends really think about you
          </p>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#f59e0b',
              margin: 0,
              letterSpacing: '0.02em',
            }}
          >
            auraview.app
          </p>
        </div>
      </div>
    </div>
  );
}
