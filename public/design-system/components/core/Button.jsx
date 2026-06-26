import React from 'react';

/**
 * Boost Boss Button — the brand's primary action primitive.
 * Renders an <a> when `href` is set, otherwise a <button>.
 * Variants and sizes mirror the marketing surfaces (pink CTA,
 * ghost, outline, dark-ghost for dark heroes, white for pink boxes).
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  iconRight,
  iconLeft,
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1.5px solid transparent',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1,
    transition:
      'transform var(--dur-fast) var(--ease-snappy), background var(--dur-fast), box-shadow var(--dur-fast), border-color var(--dur-fast)',
  };

  const sizes = {
    sm: { padding: '7px 14px', fontSize: '13.5px', borderRadius: 'var(--r-xs)' },
    md: { padding: '9px 18px', fontSize: '14.5px', borderRadius: 'var(--r-sm)' },
    lg: { padding: '14px 26px', fontSize: '15.5px', borderRadius: 'var(--r-md)' },
  };

  const variants = {
    primary: {
      rest: { background: 'var(--bb-pink)', color: '#fff', borderColor: 'var(--bb-pink)', boxShadow: '0 6px 20px rgba(255,45,120,0.32)' },
      hover: { background: 'var(--bb-pink-dark)', borderColor: 'var(--bb-pink-dark)', boxShadow: 'var(--glow-pink)' },
    },
    outline: {
      rest: { background: '#fff', color: 'var(--bb-ink)', borderColor: 'var(--bb-ink-800)' },
      hover: { background: 'var(--bb-ink)', color: '#fff', borderColor: 'var(--bb-ink)' },
    },
    ghost: {
      rest: { background: 'transparent', color: 'var(--bb-ink)', borderColor: 'rgba(15,15,26,0.18)' },
      hover: { background: 'rgba(15,15,26,0.04)', borderColor: 'rgba(15,15,26,0.32)' },
    },
    ghostDark: {
      rest: { background: 'rgba(255,255,255,0.05)', color: '#fff', borderColor: 'rgba(255,255,255,0.18)' },
      hover: { background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.32)' },
    },
    white: {
      rest: { background: '#fff', color: 'var(--bb-pink)', borderColor: '#fff' },
      hover: { background: 'var(--bb-ink)', color: '#fff', borderColor: 'var(--bb-ink)' },
    },
  };

  const v = variants[variant] || variants.primary;
  const lift = variant === 'ghost' || variant === 'outline' ? {} : { transform: 'translateY(-2px)' };

  const composed = {
    ...base,
    ...sizes[size],
    ...v.rest,
    ...(hover && !disabled ? { ...v.hover, ...lift } : null),
    ...(active && !disabled ? { transform: 'scale(0.97)' } : null),
    ...style,
  };

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => { setHover(false); setActive(false); },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
  };

  const inner = (
    <>
      {iconLeft ? <span aria-hidden="true">{iconLeft}</span> : null}
      {children}
      {iconRight ? <span aria-hidden="true">{iconRight}</span> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <a href={href} style={composed} onClick={onClick} {...handlers} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" style={composed} disabled={disabled} onClick={onClick} {...handlers} {...rest}>
      {inner}
    </button>
  );
}
