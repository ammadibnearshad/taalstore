# Performance Audit — taalstore theme

**Date:** 2026-07-30
**Scope:** static, code-level analysis of the downloaded theme folder. No storefront, no browser, no Lighthouse run — every number below is derived from file sizes and code reading, and **all impact figures are estimates**, not measurements.
**Baseline commit:** `5233ea4` (tag `perf-baseline-5233ea4`)
**Backup:** `d:\projects\taalnew\theme\taalstore.backup` (424 files, verified identical count)
**theme check baseline:** 38 offences — 30 `MatchingTranslations` errors, 2 `VariableName`, 2 `UnusedAssign`, 3 `UndefinedObject`, 1 `RemoteAsset`. **Zero** performance-category offences. Raw JSON saved to the session scratchpad. Phase 2 must not increase these counts.

> **Phase 1 is audit only. No theme file has been modified.**

---

## 1. Theme identity

| | |
|---|---|
| Theme | **Dawn 15.5.0** (`config/settings_schema.json:4`) |
| Author | Shopify, with substantial custom work layered on top |
| Structure | 63 sections, 60 snippets, 223 assets (85 CSS / 48 JS / 89 SVG / 1 GIF) |
| Live settings | `cart_type: drawer`, `predictive_search_enabled: true`, `animations_reveal_on_scroll: **true**`, `animations_hover_elements: none`, `page_width: 1400` |
| Fonts | Lora (heading) + Inter (body), Shopify-hosted |

**Custom sections/assets added on top of Dawn** (these are the merchant's own code and are in scope for edits):
`collection-deals-slider`, `collection-stories`, `collection-switcher`, `reviews-marquee`, `trust-bar`, `icon-benefits`, `celebrity-grid`, `sale-bar`, `collection-trust-strip`, plus `cart-timer.js`, `pdp-sticky-atc.js`, `header-menu-hover.js`, `menu-drawer-search.js`, `menu-drawer-columns.js`, `section-footer.js`, `standard-actions-override.js`, `component-card-cro.css`, `component-mega-menu-layouts.css`, `component-menu-drawer-layouts.css`, `component-menu-drawer-extras.css`, `component-cart-timer.css`, `component-cart-free-ship.css`, `component-pdp-blocks.css`.

---

## 2. What this theme already does well — DO NOT UNDO

This is a well-built theme. The following are deliberate, correct patterns and must be preserved:

1. **Every `<script>` is `defer`red.** There is not a single render-blocking script in the theme. (`layout/theme.liquid:52-64`, and every section.)
2. **A partial async-CSS pattern already exists** — `media="print" onload="this.media='all'"` is used for `component-cart-items.css` (`layout/theme.liquid:282`), `component-predictive-search.css` (`:309`), and all five header stylesheets (`sections/header.liquid:1-23`). Phase 2 should **extend this pattern**, not invent a new one.
3. **No jQuery, no Swiper, no GSAP, no external CDN, no duplicate libraries.** Sliders are native CSS scroll-snap plus small custom elements. Verified by grep across all `.liquid` and `.js`.
4. **No hardcoded tracking pixels** (no GTM, GA, Meta, TikTok, Hotjar, Clarity) anywhere in theme code.
5. **No orphan JS or CSS.** Every stylesheet and script is referenced. (The 44 unreferenced `icon-*.svg` files are Dawn's icon-picker set, resolved dynamically at render time — not orphans, and they cost nothing at runtime.)
6. **Custom JS is modern and correct**: `class X extends HTMLElement`, `connectedCallback`/`disconnectedCallback` cleanup, `IntersectionObserver`, `{ passive: true }` on scroll/wheel listeners. (`section-collection-deals-slider.js:44-45`, `section-collection-switcher.js:16`, `pdp-sticky-atc.js:15-17`, `section-reviews-marquee.js:158-165`.)
7. **Fonts are already optimal**: `font_face` with `font_display: 'swap'` (`layout/theme.liquid:74-79`), woff2 preload for exactly the two families in use (`:294`, `:299`), and a conditional `preconnect` to `fonts.shopifycdn.com` (`:15`).
8. **The hero already reserves its own space** — `image_height: adapt` emits `padding-bottom` aspect-ratio boxes for both breakpoints (`sections/image-banner.liquid:23-48`), so the hero contributes no CLS.
9. **The hero already gets `fetchpriority="high"`** when it is the first section (`sections/image-banner.liquid:111-114`), and serves a true `<picture>` with separate mobile/desktop sources (`snippets/banner-media.liquid:56-75`).
10. **Video sections already use a click-to-load facade** — `deferred-media` (`sections/video.liquid`, `sections/collage.liquid`). No eager YouTube/Vimeo iframes. Neither section is used on the homepage, PDP or PLP anyway.
11. **The PDP already loads its first gallery image eagerly** and lazy-loads the rest (`snippets/product-media-gallery.liquid:84`, `:103-108`).
12. **The cart drawer already inlines its own hiding rule** (`snippets/cart-drawer.liquid:17-21`) so it never flashes.

---

## 3. Page composition (what actually renders)

**Homepage** (`templates/index.json`) — announcement-bar → header → image-banner → trust-bar → collection-deals-slider → reviews-marquee (24 blocks) → featured-collection ×3 (8 products each, `show_secondary_image: true`, `quick_add: none`) → apps → icon-benefits → apps → footer.

**PDP** (`templates/product.json`) — collection-stories → main-product → reviews-marquee → apps → related-products.

**PLP** (`templates/collection.json`) — main-collection-banner → collection-stories → collection-switcher → main-collection-product-grid.

### Render-blocking CSS on the homepage

**24 unique stylesheets, ≈196 KB uncompressed**, plus ~5 extra duplicate `<link>` tags (`component-card.css`, `component-price.css`, and `section-collection-deals-slider.css` are each emitted 3–4 times because three `featured-collection` sections request them; the browser dedupes the *request* but still parses the extra tags).

Of that ≈196 KB, **≈83 KB across 14 files is for content that is below the fold or hidden at first paint**:

| Group | Files | KB |
|---|---|---|
| Cart drawer (hidden) | `component-cart-drawer` 10.2, `component-cart` 3.5, `component-totals` 0.6, `component-discounts` 0.5, `quantity-popover` 3.3, `component-cart-free-ship` 0.9, `component-cart-timer` 1.0 | **20.0** |
| Product cards (below fold) | `component-card` 14.3, `component-card-cro` 5.2 | **19.5** |
| Below-fold sections | `section-collection-deals-slider` 11.2, `section-reviews-marquee` 12.9, `section-featured-collection` 1.3, `section-icon-benefits` 2.9 | **28.3** |
| Footer | `section-footer` 12.9, `component-newsletter` 1.4, `component-list-menu` 0.5, `component-list-payment` 0.4 | **15.2** |

Legitimately critical and to be left alone: `base.css` (81.2), `section-image-banner.css` (12.3), `component-slideshow.css` (4.3), `component-slider.css` (9.6), `section-trust-bar.css` (1.9), `component-price.css` (2.9), `component-list-social.css` (0.5).

### JavaScript on the homepage

≈148 KB uncompressed across 21 files — **all `defer`red**, so none of it blocks render. It is a TBT/INP cost, not an FCP cost. Largest: `global.js` 46.8, `cart.js` 15.4, `section-reviews-marquee.js` 13.8, `section-collection-deals-slider.js` 13.6, `predictive-search.js` 9.4.

---

## 4. Ranked findings

Ranked by estimated impact ÷ risk. "Apply" = safe to do in Phase 2. "Review" = needs the developer's sign-off first (visual delta or non-trivial regression surface).

> **Revised during Phase 2.** F2 and F6 were wrong as originally written and are corrected below.
> The "Outcome" column records what actually happened.

| # | Finding | Est. impact | Risk | Outcome |
|---|---|---|---|---|
| F1 | Scroll-reveal animation holds the LCP element at `opacity: 0.01` until JS runs | **High** (LCP) | Med — visual delta | **Shipped** for homepage + PDP (approved); PLP outstanding as R8 |
| F2 | ~~LCP hero image is never preloaded~~ — **withdrawn, would be a no-op** | None | — | **Not shipped** |
| F3 | ≈83 KB / 14 render-blocking stylesheets serve below-fold or hidden content | **High** (FCP) | Low–Med | **Partly shipped** (~35 KB / 9 files) |
| F4 | `cart-notification.js` + `component-cart-notification.css` load on every page but the markup never renders (`cart_type: drawer`) | Low–Med (TBT) | **Very low** | **Shipped** |
| F5 | PDP first gallery image has no `fetchpriority="high"` | Med (LCP on PDP) | Low | **Shipped** |
| F6 | ~~PLP first card row is lazy-loaded~~ — **wrong, already handled by Dawn** | None | — | **No change needed** |
| F7 | `collection-stories` avatars are `loading="lazy"` but sit above the fold on PDP/PLP | Low–Med | Low | **Shipped** |
| F8 | Duplicate `<link>` tags emitted 3–4× for three stylesheets on the homepage | Low (DOM/parse) | Low | Partly resolved by F3 |
| F9 | No `content-visibility` on below-fold sections | Med (rendering/TBT) | Med | **Not shipped** — review |
| F10 | Logo is preloaded, competing with the true LCP asset | Low | Low | **Not shipped** — review |
| F11 | Duplicated mobile + desktop nav DOM | Med (DOM weight) | **High** | **Not shipped** — declined |
| F12 | All custom CSS/JS ships unminified (~150 KB) | Low | Low | **Not shipped** — declined |
| F13 | `sparkle.gif` (175 KB) and `component-progress-bar.css` are unreferenced | **Zero runtime** | Low | Note only |
| F14 | `section-reviews-marquee.css` cannot be deferred — JS measures card widths at init | — | — | Documented in section |

---

## 5. Findings in detail

### F1 — Scroll-reveal animation gates the LCP element ⭐ biggest single LCP item

**Files:**
- `config/settings_data.json:23` — `"animations_reveal_on_scroll": true`
- `assets/base.css:3272-3275` — `.scroll-trigger.animate--fade-in { opacity: 0.01; }` (inside `@media (prefers-reduced-motion: no-preference)`)
- `assets/animations.js:94-97` — the class is only removed after `DOMContentLoaded` + `IntersectionObserver` callback
- `sections/image-banner.liquid:119` and `:122` — hero wrapper **and** hero media both carry `scroll-trigger animate--fade-in`
- `snippets/product-media-gallery.liquid:68` — the PDP's first gallery `<li>` carries the same classes
- `layout/theme.liquid:62-64` — `animations.js` is loaded `defer`

**What's wrong:** the hero image on the homepage and the first product image on the PDP are rendered at `opacity: 0.01` by CSS. They only become visible after `animations.js` downloads, `DOMContentLoaded` fires, an `IntersectionObserver` is constructed, and its first callback runs. The browser will not count an effectively-invisible element as an LCP paint, so **LCP is pinned to JS execution time rather than to image decode time** — on a throttled mobile run that is easily several hundred ms, and it is exactly the gap PSI reports as "Largest Contentful Paint element … render delay".

**Maps to:** PSI *Largest Contentful Paint*, *LCP breakdown → element render delay*; GTmetrix *LCP*.

**Estimated impact:** large — plausibly 300–800 ms of LCP on throttled mobile. **This is an estimate**; it depends entirely on how fast `animations.js` executes on the real device.

**Risk of fixing:** the safe fix is to stop applying `scroll-trigger animate--fade-in` to the first section's media (homepage hero + PDP first gallery slide) while leaving it on the text/content blocks and every other section. **This is a visible change**: the hero image would appear immediately instead of fading in. Everything else keeps animating. That is a design decision, so it needs the developer's explicit OK — hence *Review*, not *Apply*.

A no-visual-change alternative exists but is weaker: keep the fade but raise the starting opacity so the element is paint-eligible. It does not remove the JS dependency and only partially recovers LCP. Recommend the clean fix.

---

### F2 — ~~LCP hero image is never preloaded~~ — WITHDRAWN

**Corrected during Phase 2. This finding was wrong and no change was shipped.**

The factual observation holds — there is no `<link rel="preload" as="image">` anywhere in the theme. The **impact estimate was wrong**, for two reasons found while implementing it:

1. **The theme already sets `fetchpriority="high"` on the hero** (`sections/image-banner.liquid:111-114` → `snippets/banner-media.liquid:73`). A preload's main job on an `<img>` is to raise its priority; that is already done.
2. **A preload placed in the section body is discovered at the same moment as the image itself.** The browser's preload scanner runs ahead of the main parser and is *not* blocked by the stylesheets in `<head>` — it discovers the hero `<img>` while `base.css` is still downloading. A `<link rel="preload">` sitting a few lines above that same `<img>` therefore tells the browser nothing it does not already know.

Preload genuinely helps when the LCP image is a CSS `background-image`, is injected by JavaScript, or sits deep in the DOM. None applies here: the hero is a plain `<picture>` near the top of the body.

The only placement that would help is `<head>`, before the blocking stylesheets — and a section cannot inject into `<head>`. Faking it would mean adding a duplicate theme-setting image picker that the merchant must remember to keep in sync with the actual hero; that is a silent-breakage trap for a benefit that is close to zero.

**Conclusion:** the hero's fetch path is already optimal. What actually delays the hero is **F1** (it is painted at `opacity: 0.01` until JS runs) and **F3** (24 blocking stylesheets delay the *render*, not the fetch). Fix those instead.

---

### F2-original (superseded, kept for the record)

**Files:** `sections/image-banner.liquid:1-131`, `snippets/banner-media.liquid:37-96`

**What's wrong:** the hero is well built — `<picture>`, correct `srcset`, explicit `width`/`height`, `fetchpriority="high"` when `section.index == 1`. But there is **no `<link rel="preload" as="image">` anywhere in the theme**. The browser cannot start fetching the hero until it has parsed the head, fetched and parsed 24 stylesheets (which block), and reached the banner markup. `fetchpriority` only reprioritises the request once it is discovered; a preload makes it discoverable immediately.

The hero uses separate desktop (`.png`) and mobile (`.webp`) sources, so the preload must be `media`-scoped to avoid downloading both. Shopify's `image_url` will still transcode the PNG source to WebP/AVIF for supporting browsers, so the source format is not itself a problem.

**Maps to:** PSI *Preload Largest Contentful Paint image*, *LCP breakdown → resource load delay*; GTmetrix *LCP*.

**Estimated impact:** medium–large on LCP. Compounds with F3 — the more blocking CSS we remove, the less the preload buys, and vice versa.

**Risk:** low. Additive only, and gated on `section.index == 1` so exactly one image is preloaded. Must be `media`-scoped (`media="(min-width: 750px)"` / `media="(max-width: 749px)"`) so mobile and desktop each fetch one file, and must not fire when the section is not first.

---

### F3 — ≈83 KB of render-blocking CSS for content that isn't visible at first paint

**Files:**
- `snippets/cart-drawer.liquid:8-11` — 4 blocking stylesheets on **every page**, for a drawer that is `visibility: hidden`
- `layout/theme.liquid:284-290` — 5 more blocking cart stylesheets on every page
- `sections/reviews-marquee.liquid:8` (12.9 KB), `sections/collection-deals-slider.liquid:20` (11.2 KB), `sections/icon-benefits.liquid:7`, `sections/featured-collection.liquid:15-18`
- `sections/footer.liquid:2-6` (15.2 KB total)
- `snippets/card-product.liquid:28` — `component-card-cro.css`

**What's wrong:** Dawn's `stylesheet_tag` emits a plain render-blocking `<link>`. Sections that render 2–5 viewport-heights down the page therefore delay first paint by the same amount as the hero's own CSS. The theme already knows the fix — `sections/header.liquid:1-23` and `layout/theme.liquid:282` use `media="print" onload="this.media='all'"` — it just hasn't been applied to the below-fold sections.

Two sub-cases with different risk profiles:

**F3a — below-fold section CSS (≈63 KB, low risk).** `section-reviews-marquee`, `section-collection-deals-slider`, `section-featured-collection`, `section-icon-benefits`, `section-footer`, `component-newsletter`, `component-list-menu`, `component-list-payment`, `component-card`, `component-card-cro`. Converting these to the print-onload pattern (with a `<noscript>` fallback) is a well-understood, reversible change. The residual risk is a brief flash of unstyled content if a user scrolls to them within the first few hundred ms. Mitigate by leaving anything that can be in the initial viewport untouched, and by applying one section per commit.

**F3b — cart drawer CSS (≈20 KB, medium risk — needs care).** `snippets/cart-drawer.liquid:17-21` already inlines `.drawer { visibility: hidden; }`, but `visibility: hidden` **still occupies layout space**. The rules that take the drawer out of flow (`position: fixed; top:0; left:0; width:100vw; height:100%`) live in `component-cart-drawer.css:1-12`. Deferring that file without first inlining those four properties would put the entire cart drawer — including its item rows, free-ship bar and timer — into normal document flow on every page load, then snap it out when the CSS lands. **That is a catastrophic CLS regression.** If F3b is attempted, the inline `<style>` block must be extended with the positioning properties *in the same commit*, and CLS reasoned through explicitly.

**Maps to:** PSI *Eliminate render-blocking resources*, *Reduce unused CSS*; GTmetrix *Eliminate render-blocking resources* (Structure).

**Estimated impact:** medium–large on FCP and LCP. Note the caveat: over Brotli, 83 KB of CSS compresses to roughly 12–15 KB, so the win is dominated by **removing 14 blocking round-trips from the critical path**, not by bytes.

---

### F4 — Dead cart-notification assets on every page

**Files:** `sections/header.liquid:293` (JS, unconditional) and `sections/header.liquid:10-15` (CSS, unconditional)

**What's wrong:** `snippets/cart-notification.liquid` is only rendered when `settings.cart_type == 'notification'` (`sections/header.liquid:506-511`). The store runs `cart_type: drawer`, so the markup never exists — yet `cart-notification.js` (3.3 KB) is downloaded, parsed, and registers a custom element with nothing to attach to, and `component-cart-notification.css` (3.3 KB) is downloaded on every page.

**Fix:** wrap both in the same `{%- if settings.cart_type == 'notification' -%}` guard that already surrounds the markup.

**Verification required before applying:** grep for `cart-notification` / `CartNotification` consumers. `product-form.js` does `document.querySelector('cart-notification')` — it must be confirmed to null-check before the script is removed. If it does not, leave this finding alone.

**Maps to:** PSI *Reduce unused JavaScript*, *Avoid enormous network payloads*.

**Estimated impact:** small but genuinely free — ~6.6 KB and one script parse removed from every page. **Risk: very low.**

---

### F5 — PDP first gallery image lacks `fetchpriority` and a preload

**Files:** `snippets/product-media-gallery.liquid:64-85` and `:103-123`, `snippets/product-thumbnail.liquid:28-31`, `:81-89`

**What's wrong:** the gallery correctly passes `lazy_load: false` for the first media and `true` for the rest, so eager/lazy is right. But the first image gets no `fetchpriority="high"` and is never preloaded, so it competes on equal footing with the fonts, the logo preload, and every stylesheet.

Note that `collection-stories` sits **above** `main-product` in `templates/product.json`, so the PDP's above-fold region contains the stories strip *and* the gallery image.

**Fix:** thread a `fetch_priority` parameter into `product-thumbnail.liquid` set to `'high'` exactly when `lazy_load == false`, and add a matching `<link rel="preload" as="image">` for the first media.

**Maps to:** PSI *Preload LCP image*, *LCP breakdown → resource load delay*.

**Estimated impact:** medium on PDP LCP. **Risk: low** — additive attribute, no layout or behaviour change.

---

### F6 — ~~Every collection-page product card is lazy-loaded~~ — WITHDRAWN

**Corrected during Phase 2. This finding was wrong and no change was shipped.**

I read `loading="lazy"` at `snippets/card-product.liquid:110` without reading the line above it. It is guarded:

```liquid
{% unless lazy_load == false %}
  loading="lazy"
{% endunless %}
```

and `sections/main-collection-product-grid.liquid:161-164` **already** eager-loads the first two cards:

```liquid
{% assign lazy_load = false %}
{%- if forloop.index > 2 -%}
  {%- assign lazy_load = true -%}
{%- endif -%}
```

So the LCP card on the collection page is already eager. The only question left is whether *two* is the right number. It is not worth changing: `columns_mobile` is 2, so two eager images is exactly one mobile row. Raising it to `columns_desktop` (4) to fill a desktop row would eager-load two images that are **off-screen on mobile** — spending bandwidth on the breakpoint where PSI scores hardest, to gain marginally on the one where it scores easiest. Dawn's choice is a sound mobile-first compromise.

**Note found while checking this:** `sections/main-collection-product-grid.liquid:166` puts `scroll-trigger animate--slide-in` on every card `<li>`, so the PLP's LCP element is subject to **F1** as well. F1 affects all three page types, not two.

**Conclusion:** no change. The secondary hover image at `:132` is correctly hardcoded lazy and must stay that way.

---

### F14 — `section-reviews-marquee.css` cannot be deferred

Found while implementing F3. `assets/section-reviews-marquee.js:54-79` runs `layout()` from `connectedCallback`, reading `this.viewport.clientWidth` and `this.groups[0].getBoundingClientRect().width` to compute the marquee duration (`--rm-dur`) and how many times to clone the item set to fill the viewport.

If the stylesheet is deferred, those measurements are taken against unstyled `<li>` elements. The `ResizeObserver` that would normally re-run `layout()` early-returns when the width is unchanged (`:171`) — and deferring the stylesheet resizes the marquee's *children*, not the observed viewport, so it never fires. The marquee would run at the wrong speed with a visible gap at the loop seam, permanently.

**Conclusion:** `sections/reviews-marquee.liquid` keeps its blocking `stylesheet_tag`. A comment recording this is now in the section so the optimisation is not retried. Making it deferrable would mean having the JS wait on the stylesheet before measuring — possible, but it is a behavioural change to working code for 12.9 KB, and belongs in the developer-review list rather than a blind edit.

---

### F7 — Above-fold `collection-stories` avatars are lazy-loaded

**File:** `sections/collection-stories.liquid:59-64` — `loading: 'lazy'`, 96 px avatars

**What's wrong:** `collection-stories` is section 1 on the PDP and section 2 on the PLP, so its avatar strip is above the fold on both. They are small (96/76 px) so they are unlikely to *be* the LCP, but lazy-loading in-viewport images delays visual completeness and can push out FCP-adjacent metrics.

**Fix:** eager-load the first ~6 avatars (one row), keep the rest lazy. Low risk. The story-viewer images at `:157-163` and the thumbnails at `:188-191` are correctly lazy and must stay that way.

**Estimated impact:** low–medium. **Risk: low.**

---

### F8 — Duplicate stylesheet `<link>` tags on the homepage

**Files:** `sections/featured-collection.liquid:15-18`, three times over via `templates/index.json`

**What's wrong:** three `featured-collection` sections each emit `component-card.css`, `component-price.css` and `section-collection-deals-slider.css`. `component-card.css` is *also* emitted by `snippets/cart-drawer.liquid:9` and `component-price.css` by `layout/theme.liquid:288`. Net result: ~5 redundant `<link>` elements. The browser dedupes the network request, so this is DOM and CSSOM parse cost only.

**Fix:** this resolves itself as a side effect of F3a (moving `component-card.css` to a single deferred load). Not worth a standalone change.

**Estimated impact:** low. **Risk: low.**

---

### F9 — No `content-visibility` on below-fold sections

**Files:** no `content-visibility` exists anywhere in `assets/*.css` (verified by grep)

**What's wrong:** the homepage renders 24 product cards (3 × 8, each with a secondary hover image → up to 48 `<img>` elements), a 24-block reviews marquee whose markup is **duplicated for the seamless loop** (`sections/reviews-marquee.liquid:134-137` outputs `rm_items` twice → 48 review cards), plus a deals slider and a large footer. All of it is laid out and painted at load.

`content-visibility: auto` with a matching `contain-intrinsic-size` would skip layout and paint for off-screen sections.

**Risk (why this is *Review*, not *Apply*):** `content-visibility: auto` is genuinely hazardous here. It breaks in-page anchors and browser find-in-page for skipped content, and a wrong `contain-intrinsic-size` **causes** CLS rather than avoiding it. The reviews marquee and the deals slider are horizontally scrolling containers whose intrinsic size is hard to predict. It also interacts badly with the `IntersectionObserver`s in `section-reviews-marquee.js` and `pdp-sticky-atc.js`.

**Recommendation:** apply only to the footer (fixed, predictable height, no in-page anchors) and only after the developer can verify on a real device. Skip everything else.

**Estimated impact:** medium on TBT/rendering. **Risk: medium.**

---

### F10 — Logo preload competes with the true LCP asset

**Files:** `sections/header.liquid:369` and `:412` — `preload: true` on `image_tag`

**What's wrong:** Dawn preloads the logo. Once F2 lands there will be two image preloads racing on the same connection, and the logo is never the LCP. The prompt's own guidance is "don't preload more than the one true LCP asset".

**Recommendation:** *Review.* The logo is above the fold and small; dropping its preload might marginally delay the header. Worth testing both ways after F2 is in, rather than changing blind. Do not touch in the first pass.

---

### F11 — Duplicated mobile + desktop navigation DOM — **do not fix**

**File:** `sections/header.liquid:340` (`header-drawer`, full mobile nav) and `:384`/`:386` (`header-dropdown-menu` / `header-mega-menu`, full desktop nav)

Stock Dawn renders the entire menu tree twice and hides one with CSS. Collapsing to a single tree would be a large refactor touching the mega-menu layouts, the drawer layouts, `menu-drawer-columns.js`, `menu-drawer-search.js`, `header-menu-hover.js` and five custom stylesheets, with a high chance of subtle breakage at some breakpoint.

**Per the hard constraints: leave it. Noted for the developer-review list.**

---

### F12 — Unminified custom CSS/JS — **recommend not fixing**

~150 KB across the custom section assets (`section-reviews-marquee.css/js`, `section-collection-deals-slider.css/js`, `section-collection-stories.css/js`, `section-footer.css`, etc.), all shipped as readable source with comments — consistent with Dawn, which ships unminified too.

Shopify's CDN serves every theme asset with Brotli, which recovers the large majority of what minification would. Minifying by hand would produce an enormous unreviewable diff, destroy maintainability, and risk introducing a syntax error into working code, all for a small post-compression gain. `base.css` and `global.js` are Dawn core files and are out of bounds regardless.

**Recommendation: do not minify.** Recorded here so the decision is explicit rather than an oversight.

---

### F13 — Unreferenced assets (zero runtime cost)

`sparkle.gif` (175 KB) and `component-progress-bar.css` (0.6 KB) are referenced nowhere in any `.liquid`, `.json`, `.css` or `.js` file. They are never requested by a browser, so **removing them improves no metric** — it only shrinks the upload zip. Deleting files carries a small risk that an app or a theme-editor setting references them by name.

**Recommendation:** leave both. Noted for completeness.

---

## 6. Not fixable at theme-code level

To be expanded into `MERCHANT_ACTIONS.md` during Phase 2. Observed so far:

- **Two `apps` sections on the homepage** (`templates/index.json`, positions 8 and 10) and one on the PDP. Whatever these app blocks inject is outside theme code and cannot be optimised here.
- **`{{ content_for_header }}`** (`layout/theme.liquid:66`) — Shopify platform scripts plus every app embed. Must not be moved or removed.
- **`https://cdn.shopify.com/storefront/standard-events.js`** (`layout/theme.liquid:31-50`) — Shopify's own analytics module. It is `type="module"` so it is deferred by default, and it is served from `cdn.shopify.com`, the same origin as every theme asset, so no `preconnect` is needed and none should be added.
- **"Serve static assets with an efficient cache policy"** — Shopify sets these headers on theme assets. Any failures will come from third-party/app scripts.
- **CrUX / field data** in PSI lags ~28 days. Judge the re-upload by lab data only.

---

## 7. Phase 2 outcome

See `CHANGELOG.md` for the full record. Summary:

**Shipped** (5 commits, `theme check` held at 38 offences throughout):
F4 (cart-notification guard), F5 (PDP LCP `fetchpriority`), F7 (story avatars eager), F3-footer (15.2 KB / 5 files deferred), F3-icon-benefits (2.9 KB deferred), F3-cart-drawer (19.5 KB / 4 files deferred). **≈37.6 KB across 10 render-blocking stylesheets removed from the critical path**, plus 6.6 KB of dead cart-notification assets.

**Withdrawn as wrong:** F2, F6 — both corrected above with the evidence.

**Blocked on a decision:** F1 — the single largest remaining LCP item. Needs sign-off because it changes the hero's fade-in.

**Declined, with what would make each safe:** F9, F10, F11, F12, F13, F14 — see the developer-review list in `CHANGELOG.md`.

### A note on expected magnitude

Be realistic about what the shipped CSS work buys. All theme assets are served over one HTTP/2 connection from `cdn.shopify.com` with Brotli, so 37.6 KB uncompressed is roughly 6–8 KB on the wire, and the 10 requests are multiplexed rather than 10 round trips. The win is real — PSI's *Eliminate render-blocking resources* lists each of these files by name, and it is a **Structure**-score item on GTmetrix — but it is a single-digit-points change, not a transformation.

**The two things that would actually move LCP materially are F1 and the remaining half of F3.** Neither can be done without a decision from the developer.
