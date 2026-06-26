import * as React from 'react';

/**
 * Props for the Badge.
 *
 * @startingPoint section="Core" subtitle="Eyebrows, status pills & live chips" viewport="760x540"
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  /** Color tone. */
  tone?: 'pink' | 'cyan' | 'yellow' | 'success' | 'warn' | 'neutral';
  /** Fill style: tinted `soft` (default), `solid` brand fill, or `outline`. */
  variant?: 'soft' | 'solid' | 'outline';
  /** Show a leading pulsing dot (the "live" chip treatment). */
  dot?: boolean;
  /** Uppercase eyebrow styling (wider tracking, square corners). */
  uppercase?: boolean;
  style?: React.CSSProperties;
}

/**
 * Tinted eyebrows, status pills (active/paused), and live-dot chips.
 */
export function Badge(props: BadgeProps): JSX.Element;
