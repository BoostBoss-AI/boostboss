import * as React from 'react';

/**
 * Props for the Card.
 *
 * @startingPoint section="Core" subtitle="Surface cards — soft, pop & dark glass" viewport="760x540"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /**
   * Surface language:
   * - `soft`  — white, hairline border, soft shadow (default, modern SaaS)
   * - `pop`   — ink border + hard offset shadow (neo-brutalist accent)
   * - `glass` — dark translucent card for dark hero surfaces
   * - `flat`  — white, 1.5px line border, no shadow (gains pop-shadow on hover)
   */
  variant?: 'soft' | 'pop' | 'glass' | 'flat';
  /** Lift + deepen shadow on hover. */
  hoverable?: boolean;
  /** Inner padding in px (number) or any CSS length string. */
  padding?: number | string;
  style?: React.CSSProperties;
}

/**
 * Surface container in the brand's three card languages (soft / pop / glass).
 */
export function Card(props: CardProps): JSX.Element;
