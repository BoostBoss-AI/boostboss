Small label primitive for eyebrows, status pills, and live chips — use it for section eyebrows, campaign status, and "now live" indicators.

```jsx
<Badge tone="pink" uppercase>For publishers</Badge>
<Badge tone="success">Active</Badge>
<Badge tone="cyan" dot>Now live on MCP</Badge>
```

Props:
- `tone`: `pink` | `cyan` | `yellow` | `success` | `warn` | `neutral`.
- `variant`: `soft` (tinted, default) | `solid` (brand fill) | `outline`.
- `uppercase`: eyebrow styling (wider tracking, square corners) — use above section headings.
- `dot`: adds a leading pulsing dot for "live" chips.

Use `uppercase` soft badges as section eyebrows (pink/cyan/yellow). Use `success`/`warn` for campaign status pills (Active / Paused).
