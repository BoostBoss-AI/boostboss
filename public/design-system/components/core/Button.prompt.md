Brand action button — a hot-pink primary CTA with ghost/outline/white variants for light and dark surfaces; use it for every clickable call-to-action.

```jsx
<Button variant="primary" size="lg" href="/publish/signup" iconRight="→">
  Start monetizing
</Button>
```

Variants & sizes:
- `variant`: `primary` (default pink fill), `outline` (ink border, inverts on hover), `ghost` (subtle bordered, light surfaces), `ghostDark` (translucent white — use on dark hero sections), `white` (white fill + pink text — use inside pink CTA boxes).
- `size`: `sm`, `md` (default), `lg` (hero CTAs).
- Set `href` to render an `<a>`; otherwise it's a `<button>` (pass `onClick`).
- `iconRight` / `iconLeft` accept any node — commonly the `"→"` arrow. `disabled` dims to 50%.

On dark hero surfaces pair `primary` with `ghostDark`. On the pink CTA box pair `white` with a clear/ghostDark button.
