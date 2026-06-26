/* @ds-bundle: {"format":3,"namespace":"BoostBossDesignSystem_e46764","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Footer","sourcePath":"components/navigation/Footer.jsx"},{"name":"RocketMark","sourcePath":"components/navigation/Navbar.jsx"},{"name":"Navbar","sourcePath":"components/navigation/Navbar.jsx"},{"name":"LumiMark","sourcePath":"components/navigation/Navbar.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"f4cae76485f7","components/core/Button.jsx":"a58f29f2e437","components/core/Card.jsx":"5b16c296488e","components/navigation/Footer.jsx":"88234a5286a2","components/navigation/Navbar.jsx":"f861f4e9228c"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BoostBossDesignSystem_e46764 = window.BoostBossDesignSystem_e46764 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Boost Boss Badge — eyebrows, status pills, and live-dot chips.
 * Covers the tinted uppercase eyebrows, the active/paused campaign
 * pills, and the pulsing "live" chips used across the marketing surfaces.
 */
function Badge({
  children,
  tone = 'pink',
  variant = 'soft',
  dot = false,
  uppercase = false,
  style = {},
  ...rest
}) {
  const tones = {
    pink: {
      soft: ['var(--bb-pink-tint)', 'var(--bb-pink)'],
      solid: ['var(--bb-pink)', '#fff']
    },
    cyan: {
      soft: ['var(--bb-cyan-tint)', 'var(--bb-cyan-deep)'],
      solid: ['var(--bb-cyan-link)', 'var(--bb-ink)']
    },
    yellow: {
      soft: ['var(--bb-yellow-tint)', 'var(--bb-yellow-deep)'],
      solid: ['var(--bb-yellow)', 'var(--bb-ink)']
    },
    success: {
      soft: ['var(--bb-success-bg)', 'var(--bb-success-fg)'],
      solid: ['var(--bb-success)', '#fff']
    },
    warn: {
      soft: ['var(--bb-warn-bg)', 'var(--bb-warn)'],
      solid: ['var(--bb-warn)', '#fff']
    },
    neutral: {
      soft: ['rgba(15,15,26,0.06)', 'var(--bb-ink-soft)'],
      solid: ['var(--bb-ink)', '#fff']
    }
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
    ...style
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: composed
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: 'currentColor',
      boxShadow: '0 0 0 0 currentColor',
      animation: 'bbBadgePulse 1.8s var(--ease-out) infinite'
    }
  }) : null, children, /*#__PURE__*/React.createElement("style", null, '@keyframes bbBadgePulse{0%{box-shadow:0 0 0 0 rgba(0,255,224,.5)}70%{box-shadow:0 0 0 7px rgba(0,255,224,0)}100%{box-shadow:0 0 0 0 rgba(0,255,224,0)}}'));
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Boost Boss Button — the brand's primary action primitive.
 * Renders an <a> when `href` is set, otherwise a <button>.
 * Variants and sizes mirror the marketing surfaces (pink CTA,
 * ghost, outline, dark-ghost for dark heroes, white for pink boxes).
 */
function Button({
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
    transition: 'transform var(--dur-fast) var(--ease-snappy), background var(--dur-fast), box-shadow var(--dur-fast), border-color var(--dur-fast)'
  };
  const sizes = {
    sm: {
      padding: '7px 14px',
      fontSize: '13.5px',
      borderRadius: 'var(--r-xs)'
    },
    md: {
      padding: '9px 18px',
      fontSize: '14.5px',
      borderRadius: 'var(--r-sm)'
    },
    lg: {
      padding: '14px 26px',
      fontSize: '15.5px',
      borderRadius: 'var(--r-md)'
    }
  };
  const variants = {
    primary: {
      rest: {
        background: 'var(--bb-pink)',
        color: '#fff',
        borderColor: 'var(--bb-pink)',
        boxShadow: '0 6px 20px rgba(255,45,120,0.32)'
      },
      hover: {
        background: 'var(--bb-pink-dark)',
        borderColor: 'var(--bb-pink-dark)',
        boxShadow: 'var(--glow-pink)'
      }
    },
    outline: {
      rest: {
        background: '#fff',
        color: 'var(--bb-ink)',
        borderColor: 'var(--bb-ink-800)'
      },
      hover: {
        background: 'var(--bb-ink)',
        color: '#fff',
        borderColor: 'var(--bb-ink)'
      }
    },
    ghost: {
      rest: {
        background: 'transparent',
        color: 'var(--bb-ink)',
        borderColor: 'rgba(15,15,26,0.18)'
      },
      hover: {
        background: 'rgba(15,15,26,0.04)',
        borderColor: 'rgba(15,15,26,0.32)'
      }
    },
    ghostDark: {
      rest: {
        background: 'rgba(255,255,255,0.05)',
        color: '#fff',
        borderColor: 'rgba(255,255,255,0.18)'
      },
      hover: {
        background: 'rgba(255,255,255,0.10)',
        borderColor: 'rgba(255,255,255,0.32)'
      }
    },
    white: {
      rest: {
        background: '#fff',
        color: 'var(--bb-pink)',
        borderColor: '#fff'
      },
      hover: {
        background: 'var(--bb-ink)',
        color: '#fff',
        borderColor: 'var(--bb-ink)'
      }
    }
  };
  const v = variants[variant] || variants.primary;
  const lift = variant === 'ghost' || variant === 'outline' ? {} : {
    transform: 'translateY(-2px)'
  };
  const composed = {
    ...base,
    ...sizes[size],
    ...v.rest,
    ...(hover && !disabled ? {
      ...v.hover,
      ...lift
    } : null),
    ...(active && !disabled ? {
      transform: 'scale(0.97)'
    } : null),
    ...style
  };
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false)
  };
  const inner = /*#__PURE__*/React.createElement(React.Fragment, null, iconLeft ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, iconLeft) : null, children, iconRight ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, iconRight) : null);
  if (href && !disabled) {
    return /*#__PURE__*/React.createElement("a", _extends({
      href: href,
      style: composed,
      onClick: onClick
    }, handlers, rest), inner);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    style: composed,
    disabled: disabled,
    onClick: onClick
  }, handlers, rest), inner);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Boost Boss Card — the surface container in three brand languages:
 * `soft` (modern SaaS: white, hairline border, soft shadow),
 * `pop` (neo-brutalist accent: ink border + hard offset shadow), and
 * `glass` (dark translucent card for dark hero surfaces).
 */
function Card({
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
        boxShadow: 'var(--shadow-md)'
      },
      hover: {
        transform: 'translateY(-3px)',
        boxShadow: 'var(--shadow-lg)'
      }
    },
    pop: {
      rest: {
        background: 'var(--bb-bg-soft)',
        border: '1.5px solid var(--border-ink)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-pop)'
      },
      hover: {
        transform: 'translateY(-3px)',
        boxShadow: 'var(--shadow-pop-lg)'
      }
    },
    glass: {
      rest: {
        background: 'linear-gradient(160deg, rgba(28,28,43,0.92), rgba(15,15,26,0.92))',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.06)',
        color: 'var(--text-on-dark)'
      },
      hover: {
        transform: 'translateY(-3px)',
        boxShadow: 'var(--shadow-xl)',
        borderColor: 'rgba(255,255,255,0.22)'
      }
    },
    flat: {
      rest: {
        background: 'var(--surface-card)',
        border: '1.5px solid var(--bb-line)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'none'
      },
      hover: {
        transform: 'translateY(-3px)',
        boxShadow: 'var(--shadow-pop)',
        borderColor: 'var(--border-ink)'
      }
    }
  };
  const v = variants[variant] || variants.soft;
  const composed = {
    padding: typeof padding === 'number' ? `${padding}px` : padding,
    transition: 'transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base), border-color var(--dur-base)',
    ...v.rest,
    ...(hoverable && hover ? v.hover : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: composed,
    onMouseEnter: hoverable ? () => setHover(true) : undefined,
    onMouseLeave: hoverable ? () => setHover(false) : undefined
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Navbar.jsx
try { (() => {
/** The Boost Boss rocket mark (inline so the nav is self-contained). */
function RocketMark({
  size = 34,
  glow = true
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 80 80",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    style: glow ? {
      filter: 'drop-shadow(0 4px 12px rgba(255,45,120,0.35))'
    } : undefined,
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 66 8 L 68.5 3 L 71 8 L 76 10.5 L 71 13 L 68.5 18 L 66 13 L 61 10.5 Z",
    fill: "#FFE600",
    stroke: "#1A1A2E",
    strokeWidth: "1.5",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "14",
    y1: "28",
    x2: "24",
    y2: "28",
    stroke: "#1A1A2E",
    strokeWidth: "3",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "40",
    x2: "24",
    y2: "40",
    stroke: "#1A1A2E",
    strokeWidth: "3",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "52",
    x2: "24",
    y2: "52",
    stroke: "#1A1A2E",
    strokeWidth: "3",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 30 50 L 21 67 L 32 62 Z",
    fill: "#04BEFE",
    stroke: "#1A1A2E",
    strokeWidth: "3",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 52 50 L 61 67 L 50 62 Z",
    fill: "#04BEFE",
    stroke: "#1A1A2E",
    strokeWidth: "3",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "30",
    y: "26",
    width: "22",
    height: "36",
    fill: "#FF2D78",
    stroke: "#1A1A2E",
    strokeWidth: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 30 26 L 41 7 L 52 26 Z",
    fill: "#FFE600",
    stroke: "#1A1A2E",
    strokeWidth: "3",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "41",
    cy: "35",
    r: "5.5",
    fill: "#04BEFE",
    stroke: "#1A1A2E",
    strokeWidth: "2.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "30",
    y1: "44",
    x2: "52",
    y2: "44",
    stroke: "#1A1A2E",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("text", {
    x: "41",
    y: "58",
    textAnchor: "middle",
    fontFamily: "Arial Black, sans-serif",
    fontSize: "13",
    fontWeight: "900",
    fill: "white",
    letterSpacing: "-0.5"
  }, "BB"), /*#__PURE__*/React.createElement("path", {
    d: "M 31 62 L 36 77 L 41 66 L 46 77 L 51 62 Z",
    fill: "#FFE600",
    stroke: "#1A1A2E",
    strokeWidth: "2.5",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 36 62 L 41 72 L 46 62 Z",
    fill: "#FF2D78"
  }));
}

/**
 * Boost Boss marketing Navbar — fixed, frosted-on-scroll top bar with the
 * rocket brand, centered/left links, and right-aligned CTAs. Works on both
 * dark hero surfaces (`theme="dark"`) and the cream canvas (`theme="light"`).
 */
function Navbar({
  links = [{
    label: 'Publishers',
    href: '#'
  }, {
    label: 'SuperBoost Ads',
    href: '#'
  }, {
    label: 'BBX',
    href: '#'
  }, {
    label: 'Live Demo ↗',
    href: '#'
  }],
  brandHref = '/',
  lumiMark = false,
  theme = 'dark',
  cta = {
    label: 'Start free',
    href: '#'
  },
  secondary = {
    label: 'Sign in',
    href: '#'
  },
  scrolled = true,
  style = {}
}) {
  const dark = theme === 'dark';
  const inkText = dark ? '#fff' : 'var(--bb-ink)';
  const linkText = dark ? 'rgba(244,244,248,0.82)' : 'var(--bb-ink-soft)';
  const navStyle = {
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: scrolled ? dark ? 'var(--glass-dark-bg)' : 'var(--glass-bg)' : 'transparent',
    backdropFilter: scrolled ? 'var(--glass-blur)' : 'none',
    WebkitBackdropFilter: scrolled ? 'var(--glass-blur)' : 'none',
    borderBottom: scrolled ? dark ? 'var(--glass-dark-border)' : 'var(--glass-border)' : '1px solid transparent',
    ...style
  };
  return /*#__PURE__*/React.createElement("nav", {
    style: navStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 'var(--nav-h)',
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: '0 var(--gutter)'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: brandHref,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement(RocketMark, null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: 'var(--ls-tight)',
      color: inkText,
      whiteSpace: 'nowrap'
    }
  }, "Boost Boss"), lumiMark ? /*#__PURE__*/React.createElement(LumiMark, null) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '26px',
      alignItems: 'center'
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l.label,
    href: l.href,
    style: {
      fontSize: '14.5px',
      fontWeight: 600,
      color: linkText,
      textDecoration: 'none',
      whiteSpace: 'nowrap'
    }
  }, l.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    }
  }, secondary ? /*#__PURE__*/React.createElement(NavButton, {
    href: secondary.href,
    variant: dark ? 'ghostDark' : 'ghost'
  }, secondary.label) : null, cta ? /*#__PURE__*/React.createElement(NavButton, {
    href: cta.href,
    variant: "primary"
  }, cta.label) : null)));
}

/** Lumi SDK shimmer wordmark used on publisher surfaces. */
function LumiMark() {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      marginLeft: '12px',
      paddingLeft: '12px',
      borderLeft: '1px solid rgba(255,255,255,0.16)',
      fontFamily: 'var(--font-display)',
      fontSize: '15px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      backgroundImage: 'linear-gradient(90deg,#FF2D78 0%,#D946EF 25%,#00FFE0 50%,#D946EF 75%,#FF2D78 100%)',
      backgroundSize: '220% 100%',
      backgroundPosition: '0% 50%',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      animation: 'bbLumiShimmer 4s linear infinite'
    }
  }, "Lumi SDK", /*#__PURE__*/React.createElement("span", {
    style: {
      WebkitTextFillColor: 'var(--bb-yellow)',
      color: 'var(--bb-yellow)',
      fontSize: '16px'
    }
  }, "\u2726"), /*#__PURE__*/React.createElement("style", null, '@keyframes bbLumiShimmer{0%{background-position:0% 50%}100%{background-position:220% 50%}}'));
}
function NavButton({
  children,
  href,
  variant
}) {
  const [hover, setHover] = React.useState(false);
  const map = {
    primary: {
      rest: {
        background: 'var(--bb-pink)',
        color: '#fff',
        borderColor: 'var(--bb-pink)',
        boxShadow: '0 6px 20px rgba(255,45,120,0.32)'
      },
      hover: {
        background: 'var(--bb-pink-dark)',
        borderColor: 'var(--bb-pink-dark)'
      }
    },
    ghostDark: {
      rest: {
        background: 'rgba(255,255,255,0.05)',
        color: '#fff',
        borderColor: 'rgba(255,255,255,0.18)'
      },
      hover: {
        background: 'rgba(255,255,255,0.10)'
      }
    },
    ghost: {
      rest: {
        background: 'transparent',
        color: 'var(--bb-ink)',
        borderColor: 'rgba(15,15,26,0.18)'
      },
      hover: {
        background: 'rgba(15,15,26,0.04)'
      }
    }
  };
  const v = map[variant] || map.primary;
  return /*#__PURE__*/React.createElement("a", {
    href: href,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      fontSize: '14.5px',
      padding: '9px 18px',
      borderRadius: 'var(--r-sm)',
      border: '1.5px solid transparent',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      transition: 'background var(--dur-fast), border-color var(--dur-fast)',
      ...v.rest,
      ...(hover ? v.hover : null)
    }
  }, children);
}
Object.assign(__ds_scope, { RocketMark, Navbar, LumiMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Navbar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Footer.jsx
try { (() => {
/**
 * Boost Boss marketing Footer — brand + tagline column followed by link
 * columns, with a legal/colophon bottom row. Themes for light (cream) or
 * dark (aurora) surfaces.
 */
function Footer({
  theme = 'light',
  tagline = 'The MCP-powered ad network for AI applications. Built for developers. Designed for advertisers.',
  columns = [{
    title: 'Product',
    links: [{
      label: 'Publishers',
      href: '#'
    }, {
      label: 'SuperBoost',
      href: '#'
    }, {
      label: 'BBX Exchange',
      href: '#'
    }, {
      label: 'Pricing',
      href: '#'
    }, {
      label: 'Live demo',
      href: '#'
    }]
  }, {
    title: 'Resources',
    links: [{
      label: 'Documentation',
      href: '#'
    }, {
      label: 'API reference',
      href: '#'
    }, {
      label: 'Benna whitepaper',
      href: '#'
    }]
  }, {
    title: 'Company',
    links: [{
      label: 'About',
      href: '#'
    }, {
      label: 'Trust center',
      href: '#'
    }, {
      label: 'Contact',
      href: '#'
    }]
  }],
  bottomLeft = '© 2026 Boost Boss · All rights reserved.',
  bottomRight = 'Made for the AI era.',
  style = {}
}) {
  const dark = theme === 'dark';
  const titleColor = dark ? 'rgba(244,244,248,0.45)' : 'var(--bb-muted)';
  const linkColor = dark ? 'rgba(244,244,248,0.66)' : 'var(--bb-ink-soft)';
  const tagColor = dark ? 'rgba(244,244,248,0.6)' : 'var(--bb-ink-soft)';
  const brandColor = dark ? '#fff' : 'var(--bb-ink)';
  const border = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--bb-line)';
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: dark ? 'transparent' : '#fff',
      borderTop: border,
      padding: '56px 0 34px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: '0 var(--gutter)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      gap: '44px',
      paddingBottom: '40px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '14px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.RocketMark, {
    size: 30,
    glow: false
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: 'var(--ls-tight)',
      color: brandColor
    }
  }, "Boost Boss")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '14px',
      color: tagColor,
      lineHeight: 1.6,
      maxWidth: '300px'
    }
  }, tagline)), columns.map(col => /*#__PURE__*/React.createElement("div", {
    key: col.title
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '12px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.9px',
      color: titleColor,
      marginBottom: '14px'
    }
  }, col.title), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '9px'
    }
  }, col.links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l.label
  }, /*#__PURE__*/React.createElement(FooterLink, {
    href: l.href,
    color: linkColor
  }, l.label))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      paddingTop: '22px',
      borderTop: border,
      fontSize: '13px',
      color: titleColor
    }
  }, /*#__PURE__*/React.createElement("span", null, bottomLeft), /*#__PURE__*/React.createElement("span", null, bottomRight))));
}
function FooterLink({
  children,
  href,
  color
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("a", {
    href: href,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      fontSize: '14px',
      color: hover ? 'var(--bb-pink)' : color,
      textDecoration: 'none',
      transition: 'color var(--dur-fast)'
    }
  }, children);
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Footer.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.RocketMark = __ds_scope.RocketMark;

__ds_ns.Navbar = __ds_scope.Navbar;

__ds_ns.LumiMark = __ds_scope.LumiMark;

})();
