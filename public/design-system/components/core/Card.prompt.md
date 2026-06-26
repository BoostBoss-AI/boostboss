Surface container in the brand's three card languages — use it to group content on light and dark surfaces.

```jsx
<Card variant="soft" hoverable padding={28}>
  <h3>Earning from your AI app</h3>
  <p>Native, contextual placements…</p>
</Card>
```

Variants:
- `soft` — white, hairline border, soft elevation (default; the modern-SaaS default for the redesign).
- `pop` — ink border + hard offset shadow (the neo-brutalist accent; use sparingly for emphasis cards/code wells).
- `glass` — dark translucent card with top-light inset; use on dark hero/aurora surfaces.
- `flat` — white with a 1.5px line border and no shadow; gains a pop-shadow on hover (good for step/grid cards).

Set `hoverable` for a lift + deeper shadow on hover. `padding` accepts a number (px) or any CSS length.
