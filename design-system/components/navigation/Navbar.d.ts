import * as React from 'react';

export interface NavLink {
  label: string;
  href: string;
}

export interface NavCta {
  label: string;
  href: string;
}

/**
 * Props for the marketing Navbar.
 *
 * @startingPoint section="Navigation" subtitle="Marketing top nav — dark & light" viewport="1100x520"
 */
export interface NavbarProps {
  /** Primary nav links. */
  links?: NavLink[];
  brandHref?: string;
  /** Show the animated "Lumi SDK ✦" wordmark beside the brand (publisher surfaces). */
  lumiMark?: boolean;
  /** `dark` for hero/aurora surfaces, `light` for the cream canvas. */
  theme?: 'dark' | 'light';
  /** Right-aligned primary CTA (pink). Pass null to omit. */
  cta?: NavCta | null;
  /** Right-aligned secondary action (ghost). Pass null to omit. */
  secondary?: NavCta | null;
  /** Apply the frosted-glass scrolled treatment (default true). */
  scrolled?: boolean;
  style?: React.CSSProperties;
}

/**
 * Fixed marketing top bar: rocket brand, links, and CTAs, frosted on scroll.
 */
export function Navbar(props: NavbarProps): JSX.Element;

/** The standalone rocket brand mark. */
export function RocketMark(props: { size?: number; glow?: boolean }): JSX.Element;

/** The animated "Lumi SDK ✦" shimmer wordmark. */
export function LumiMark(): JSX.Element;
