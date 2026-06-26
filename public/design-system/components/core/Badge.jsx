import React from 'react';

/**
 * Boost Boss Badge — eyebrows, status pills, and live-dot chips.
 * Covers the tinted uppercase eyebrows, the active/paused campaign
 * pills, and the pulsing "live" chips used across the marketing surfaces.
 */
export function Badge({
  children,
  tone = 'pink',
  variant = 'soft',
  dot = false,
  uppercase = false,
  style = {},
  ...rest
}) {
  const tones = {
    pink:    { soft: ['var(--bb-pink-tint)', 'var(--bb-pink)'], solid: ['var(--bb-pink)', '#fff'] },
    cyan:    { soft: ['var(--bb-cyan-tint)', 'var(--bb-cyan-deep)'], solid: ['var(--bb-cyan-link)', 'var(--bb-ink)'] },
    yellow:  { soft: ['var(--bb-yellow-tint)', 'var(--bb-yellow-deep)'], solid: ['var(--bb-yellow)', 'var(--bb-ink)'] },
    success: { soft: ['var(--bb-success-bg)', 'var(--bb-success-fg)'], solid: ['var(--bb-success)', '#fff'] },
    warn:    { soft: ['var(--bb-warn-bg)', 'var(--bb-warn)'], solid: ['var(--bb-warn)', '#fff'] },
    neutral: { soft: ['rgba(15,15,26,0.06)', 'var(--bb-ink-soft)'], solid: ['var(--bb-ink)', '#fff'] },
  };
  const [bg, fg] = (tones[tone] || tones.pink)[variant === 'solid' ? 'solid' : 'soft'];

  const composed = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: dot ? '7px' : '0',
    fontFamily: 'var(--font-body)',
    fontSize: uppercase ? '12px' : '11px',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: uppercase ? '1.1px' : '0.5px',
    textTransform: uppercase ? 'uppercase' : 'none',
    padding: uppercase ? '6px 11px' : '4px 10px',
    borderRadius: uppercase ? 'var(--r-xs)' : 'var(--r-pill)',
    background: variant === 'outline' ? 'transparent' : bg,
    color: fg,
    border: variant === 'outline' ? `1px solid ${bg}` : '1px solid transparent',
    ...style,
  };

  return (
    <span style={composed} {...rest}>
      {dot ? (
        <span
          style={{
            width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor',
            boxShadow: '0 0 0 0 currentColor',
            animation: 'bbBadgePulse 1.8s var(--ease-out) infinite',
          }}
        />
      ) : null}
      {children}
      <style>{'@keyframes bbBadgePulse{0%{box-shadow:0 0 0 0 rgba(0,255,224,.5)}70%{box-shadow:0 0 0 7px rgba(0,255,224,0)}100%{box-shadow:0 0 0 0 rgba(0,255,224,0)}}'}</style>
    </span>
  );
}
