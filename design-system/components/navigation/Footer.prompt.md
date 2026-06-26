Marketing footer with the rocket brand + tagline, link columns, and a colophon row — themed for light or dark surfaces.

```jsx
<Footer
  theme="light"
  columns={[
    { title: 'Product', links: [{label:'Publishers',href:'#'},{label:'SuperBoost',href:'#'}] },
    { title: 'Company', links: [{label:'About',href:'#'},{label:'Trust center',href:'#'}] },
  ]}
/>
```

Props:
- `theme`: `light` (white on cream) or `dark` (transparent on aurora).
- `tagline`: brand line under the rocket mark.
- `columns`: array of `{ title, links: [{label, href}] }` — renders after the brand column.
- `bottomLeft` / `bottomRight`: the colophon row (copyright + tagline).

Imports `RocketMark` from `Navbar.jsx`. Pair `theme="dark"` with the dark hero pages and `theme="light"` with the cream homepage.
