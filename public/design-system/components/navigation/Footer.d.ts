import * as React from 'react';

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

/**
 * Props for the marketing Footer.
 *
 * @startingPoint section="Navigation" subtitle="Marketing footer — light & dark" viewport="1100x520"
 */
export interface FooterProps {
  /** `light` for the cream canvas, `dark` for aurora surfaces. */
  theme?: 'light' | 'dark';
  /** Brand tagline under the rocket mark. */
  tagline?: string;
  /** Link columns (Product / Resources / Company …). */
  columns?: FooterColumn[];
  bottomLeft?: string;
  bottomRight?: string;
  style?: React.CSSProperties;
}

/**
 * Marketing footer: rocket brand + tagline, link columns, and a colophon row.
 */
export function Footer(props: FooterProps): JSX.Element;
