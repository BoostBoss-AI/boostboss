Fixed marketing top bar with the rocket brand, links, and CTAs — frosted on scroll, themed for dark hero or light cream surfaces.

```jsx
<Navbar
  theme="dark"
  links={[{label:'Publishers',href:'/publish'},{label:'SuperBoost Ads',href:'/ads'},{label:'BBX',href:'/exchange'}]}
  secondary={{label:'Sign in', href:'/signin'}}
  cta={{label:'Start free', href:'/signup'}}
/>
```

Props:
- `theme`: `dark` (hero/aurora) or `light` (cream canvas) — sets text + frosted-glass colors.
- `links`: array of `{label, href}`.
- `lumiMark`: show the animated "Lumi SDK ✦" wordmark beside the brand (publisher pages).
- `cta` / `secondary`: right-aligned actions; pass `null` to omit.
- `scrolled`: toggle the frosted treatment (in a real page, wire this to a scroll listener).

Also exports `RocketMark` (the brand logo) and `LumiMark` (the shimmer wordmark) for standalone use.
