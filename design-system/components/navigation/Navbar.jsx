import React from 'react';

/** The Boost Boss rocket mark (inline so the nav is self-contained). */
export function RocketMark({ size = 34, glow = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={glow ? { filter: 'drop-shadow(0 4px 12px rgba(255,45,120,0.35))' } : undefined} aria-hidden="true">
      <path d="M 66 8 L 68.5 3 L 71 8 L 76 10.5 L 71 13 L 68.5 18 L 66 13 L 61 10.5 Z" fill="#FFE600" stroke="#1A1A2E" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="14" y1="28" x2="24" y2="28" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" />
      <line x1="8" y1="40" x2="24" y2="40" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" />
      <line x1="16" y1="52" x2="24" y2="52" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" />
      <path d="M 30 50 L 21 67 L 32 62 Z" fill="#04BEFE" stroke="#1A1A2E" strokeWidth="3" strokeLinejoin="round" />
      <path d="M 52 50 L 61 67 L 50 62 Z" fill="#04BEFE" stroke="#1A1A2E" strokeWidth="3" strokeLinejoin="round" />
      <rect x="30" y="26" width="22" height="36" fill="#FF2D78" stroke="#1A1A2E" strokeWidth="3" />
      <path d="M 30 26 L 41 7 L 52 26 Z" fill="#FFE600" stroke="#1A1A2E" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="41" cy="35" r="5.5" fill="#04BEFE" stroke="#1A1A2E" strokeWidth="2.5" />
      <line x1="30" y1="44" x2="52" y2="44" stroke="#1A1A2E" strokeWidth="2" />
      <text x="41" y="58" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontSize="13" fontWeight="900" fill="white" letterSpacing="-0.5">BB</text>
      <path d="M 31 62 L 36 77 L 41 66 L 46 77 L 51 62 Z" fill="#FFE600" stroke="#1A1A2E" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M 36 62 L 41 72 L 46 62 Z" fill="#FF2D78" />
    </svg>
  );
}

/**
 * Boost Boss marketing Navbar — fixed, frosted-on-scroll top bar with the
 * rocket brand, centered/left links, and right-aligned CTAs. Works on both
 * dark hero surfaces (`theme="dark"`) and the cream canvas (`theme="light"`).
 */
export function Navbar({
  links = [
    { label: 'Publishers', href: '#' },
    { label: 'SuperBoost Ads', href: '#' },
    { label: 'BBX', href: '#' },
    { label: 'Live Demo ↗', href: '#' },
  ],
  brandHref = '/',
  lumiMark = false,
  theme = 'dark',
  cta = { label: 'Start free', href: '#' },
  secondary = { label: 'Sign in', href: '#' },
  scrolled = true,
  style = {},
}) {
  const dark = theme === 'dark';
  const inkText = dark ? '#fff' : 'var(--bb-ink)';
  const linkText = dark ? 'rgba(244,244,248,0.82)' : 'var(--bb-ink-soft)';

  const navStyle = {
    position: 'sticky', top: 0, left: 0, right: 0, zIndex: 100,
    background: scrolled ? (dark ? 'var(--glass-dark-bg)' : 'var(--glass-bg)') : 'transparent',
    backdropFilter: scrolled ? 'var(--glass-blur)' : 'none',
    WebkitBackdropFilter: scrolled ? 'var(--glass-blur)' : 'none',
    borderBottom: scrolled ? (dark ? 'var(--glass-dark-border)' : 'var(--glass-border)') : '1px solid transparent',
    ...style,
  };

  return (
    <nav style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 'var(--nav-h)', maxWidth: 'var(--container)', margin: '0 auto', padding: '0 var(--gutter)' }}>
        <a href={brandHref} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <RocketMark />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, letterSpacing: 'var(--ls-tight)', color: inkText, whiteSpace: 'nowrap' }}>Boost Boss</span>
          {lumiMark ? <LumiMark /> : null}
        </a>

        <div style={{ display: 'flex', gap: '26px', alignItems: 'center' }}>
          {links.map((l) => (
            <a key={l.label} href={l.href}
              style={{ fontSize: '14.5px', fontWeight: 600, color: linkText, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              {l.label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {secondary ? <NavButton href={secondary.href} variant={dark ? 'ghostDark' : 'ghost'}>{secondary.label}</NavButton> : null}
          {cta ? <NavButton href={cta.href} variant="primary">{cta.label}</NavButton> : null}
        </div>
      </div>
    </nav>
  );
}

/** Lumi SDK shimmer wordmark used on publisher surfaces. */
export function LumiMark() {
  return (
    <span aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        marginLeft: '12px', paddingLeft: '12px',
        borderLeft: '1px solid rgba(255,255,255,0.16)',
        fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em',
        backgroundImage: 'linear-gradient(90deg,#FF2D78 0%,#D946EF 25%,#00FFE0 50%,#D946EF 75%,#FF2D78 100%)',
        backgroundSize: '220% 100%', backgroundPosition: '0% 50%',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
        animation: 'bbLumiShimmer 4s linear infinite',
      }}>
      Lumi SDK<span style={{ WebkitTextFillColor: 'var(--bb-yellow)', color: 'var(--bb-yellow)', fontSize: '16px' }}>✦</span>
      <style>{'@keyframes bbLumiShimmer{0%{background-position:0% 50%}100%{background-position:220% 50%}}'}</style>
    </span>
  );
}

function NavButton({ children, href, variant }) {
  const [hover, setHover] = React.useState(false);
  const map = {
    primary: { rest: { background: 'var(--bb-pink)', color: '#fff', borderColor: 'var(--bb-pink)', boxShadow: '0 6px 20px rgba(255,45,120,0.32)' }, hover: { background: 'var(--bb-pink-dark)', borderColor: 'var(--bb-pink-dark)' } },
    ghostDark: { rest: { background: 'rgba(255,255,255,0.05)', color: '#fff', borderColor: 'rgba(255,255,255,0.18)' }, hover: { background: 'rgba(255,255,255,0.10)' } },
    ghost: { rest: { background: 'transparent', color: 'var(--bb-ink)', borderColor: 'rgba(15,15,26,0.18)' }, hover: { background: 'rgba(15,15,26,0.04)' } },
  };
  const v = map[variant] || map.primary;
  return (
    <a href={href} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '14.5px',
        padding: '9px 18px', borderRadius: 'var(--r-sm)', border: '1.5px solid transparent',
        textDecoration: 'none', whiteSpace: 'nowrap',
        transition: 'background var(--dur-fast), border-color var(--dur-fast)',
        ...v.rest, ...(hover ? v.hover : null),
      }}>
      {children}
    </a>
  );
}
