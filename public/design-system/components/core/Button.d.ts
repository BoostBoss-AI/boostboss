import * as React from 'react';

/**
 * Props for the Boost Boss action button.
 *
 * @startingPoint section="Core" subtitle="Brand buttons — pink CTA + ghost/outline/white" viewport="760x540"
 */
export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** Button label / content. */
  children?: React.ReactNode;
  /**
   * Visual style.
   * - `primary`   — hot-pink filled CTA (default)
   * - `outline`   — ink border on white, inverts on hover (light surfaces)
   * - `ghost`     — bordered transparent (light surfaces)
   * - `ghostDark` — translucent white on dark hero surfaces
   * - `white`     — white fill / pink text for use inside pink CTA boxes
   */
  variant?: 'primary' | 'outline' | 'ghost' | 'ghostDark' | 'white';
  /** Size. `lg` is the hero CTA size. */
  size?: 'sm' | 'md' | 'lg';
  /** When set, renders an <a> instead of a <button>. */
  href?: string;
  /** Optional node placed after the label (e.g. an arrow "→"). */
  iconRight?: React.ReactNode;
  /** Optional node placed before the label. */
  iconLeft?: React.ReactNode;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/**
 * The Boost Boss action button: pink primary CTA plus ghost/outline/white
 * variants for light and dark surfaces.
 */
export function Button(props: ButtonProps): JSX.Element;
