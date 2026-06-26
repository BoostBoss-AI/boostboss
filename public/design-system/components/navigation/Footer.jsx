import React from 'react';
import { RocketMark } from './Navbar.jsx';

/**
 * Boost Boss marketing Footer — brand + tagline column followed by link
 * columns, with a legal/colophon bottom row. Themes for light (cream) or
 * dark (aurora) surfaces.
 */
export function Footer({
  theme = 'light',
  tagline = 'The MCP-powered ad network for AI applications. Built for developers. Designed for advertisers.',
  columns = [
    { title: 'Product', links: [
      { label: 'Publishers', href: '#' }, { label: 'SuperBoost', href: '#' },
      { label: 'BBX Exchange', href: '#' }, { label: 'Pricing', href: '#' }, { label: 'Live demo', href: '#' },
    ] },
    { title: 'Resources', links: [
      { label: 'Documentation', href: '#' }, { label: 'API reference', href: '#' }, { label: 'Benna whitepaper', href: '#' },
    ] },
    { title: 'Company', links: [
      { label: 'About', href: '#' }, { label: 'Trust center', href: '#' }, { label: 'Contact', href: '#' },
    ] },
  ],
  bottomLeft = '© 2026 Boost Boss · All rights reserved.',
  bottomRight = 'Made for the AI era.',
  style = {},
}) {
  const dark = theme === 'dark';
  const titleColor = dark ? 'rgba(244,244,248,0.45)' : 'var(--bb-muted)';
  const linkColor = dark ? 'rgba(244,244,248,0.66)' : 'var(--bb-ink-soft)';
  const tagColor = dark ? 'rgba(244,244,248,0.6)' : 'var(--bb-ink-soft)';
  const brandColor = dark ? '#fff' : 'var(--bb-ink)';
  const border = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--bb-line)';

  return (
    <footer style={{ background: dark ? 'transparent' : '#fff', borderTop: border, padding: '56px 0 34px', ...style }}>
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '0 var(--gutter)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: '44px', paddingBottom: '40px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <RocketMark size={30} glow={false} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, letterSpacing: 'var(--ls-tight)', color: brandColor }}>Boost Boss</span>
            </div>
            <p style={{ fontSize: '14px', color: tagColor, lineHeight: 1.6, maxWidth: '300px' }}>{tagline}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: titleColor, marginBottom: '14px' }}>{col.title}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {col.links.map((l) => (
                  <li key={l.label}><FooterLink href={l.href} color={linkColor}>{l.label}</FooterLink></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '22px', borderTop: border, fontSize: '13px', color: titleColor }}>
          <span>{bottomLeft}</span><span>{bottomRight}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ children, href, color }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a href={href} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ fontSize: '14px', color: hover ? 'var(--bb-pink)' : color, textDecoration: 'none', transition: 'color var(--dur-fast)' }}>
      {children}
    </a>
  );
}
