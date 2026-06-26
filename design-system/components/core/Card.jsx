import React from 'react';

/**
 * Boost Boss Card — the surface container in three brand languages:
 * `soft` (modern SaaS: white, hairline border, soft shadow),
 * `pop` (neo-brutalist accent: ink border + hard offset shadow), and
 * `glass` (dark translucent card for dark hero surfaces).
 */
export function Card({
  children,
  variant = 'soft',
  hoverable = false,
  padding = 26,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const variants = {
    soft: {
      rest: {
        background: 'var(--surface-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-md)',
      },
      hover: { transform: 'translateY(-3px)', boxShadow: 'var(--shadow-lg)' },
    },
    pop: {
      rest: {
        background: 'var(--bb-bg-soft)',
        border: '1.5px solid var(--border-ink)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-pop)',
      },
      hover: { transform: 'translateY(-3px)', boxShadow: 'var(--shadow-pop-lg)' },
    },
    glass: {
      rest: {
        background: 'linear-gradient(160deg, rgba(28,28,43,0.92), rgba(15,15,26,0.92))',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.06)',
        color: 'var(--text-on-dark)',
      },
      hover: { transform: 'translateY(-3px)', boxShadow: 'var(--shadow-xl)', borderColor: 'rgba(255,255,255,0.22)' },
    },
    flat: {
      rest: {
        background: 'var(--surface-card)',
        border: '1.5px solid var(--bb-line)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'none',
      },
      hover: { transform: 'translateY(-3px)', boxShadow: 'var(--shadow-pop)', borderColor: 'var(--border-ink)' },
    },
  };

  const v = variants[variant] || variants.soft;
  const composed = {
    padding: typeof padding === 'number' ? `${padding}px` : padding,
    transition: 'transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base), border-color var(--dur-base)',
    ...v.rest,
    ...(hoverable && hover ? v.hover : null),
    ...style,
  };

  return (
    <div
      style={composed}
      onMouseEnter={hoverable ? () => setHover(true) : undefined}
      onMouseLeave={hoverable ? () => setHover(false) : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
