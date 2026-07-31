# Performance CHANGELOG

Companion to `PERFORMANCE_AUDIT.md`. Every change below is on branch **`perf/theme-optimizations`**, one optimization per commit.

**Rollback anything instantly:**
- Single change → `git revert <sha>`
- Everything → `git checkout main`, or restore from `d:\projects\taalnew\theme\taalstore.backup`
- Baseline tag → `perf-baseline-5233ea4`

**`shopify theme check` held at 38 offences (30 errors / 8 warnings) after every single commit** — identical to the pre-change baseline. All 38 are pre-existing (30 × `MatchingTranslations`, 3 × `UndefinedObject`, 2 × `VariableName`, 2 × `UnusedAssign`, 1 × `RemoteAsset`). None are in the performance category.

---

## Changes

### 1. `900a5c7` — Only load cart-notification assets when cart type is notification

**Files:** `sections/header.liquid`

`sections/header.liquid:506` renders the cart notification only when `settings.cart_type == 'notification'`, but the stylesheet (`:10-15`) and script (`:293`) loaded unconditionally. The store runs `cart_type: drawer`, so on **every page** `cart-notification.js` (3.3 KB) was downloaded, parsed, and registered a custom element with no matching markup, and `component-cart-notification.css` (3.3 KB) was fetched for nothing.

Both are now behind the same guard as the markup.

**Expected effect:** ~6.6 KB and one script parse removed from every page. Small TBT win.

**Why it's safe:** every consumer already falls back to the drawer when the element is absent — `product-form.js:11` and `quick-add.js:15` use `querySelector('cart-notification') || querySelector('cart-drawer')`, and `cart-disclosure-modal.js:165` uses optional chaining. Verified by grep before the edit.

**Rollback:** `git revert 900a5c7`

---

### 2. `6121a4f` — Mark the PDP first gallery image as the LCP candidate

**Files:** `snippets/product-thumbnail.liquid`, `snippets/product-media-gallery.liquid`, `sections/main-product.liquid`

The gallery already loaded its first media eagerly and lazy-loaded the rest, but gave the browser no priority signal — so the PDP's LCP image competed on equal footing with fonts, the logo preload and every stylesheet.

`product-thumbnail.liquid` now accepts an optional `fetch_priority` (default `'auto'`, so every existing caller renders identically). `product-media-gallery.liquid` threads it to the one eagerly loaded slide only. `main-product.liquid` opts in with `'high'`.

**Expected effect:** earlier start on the PDP LCP image. Medium LCP win on product pages.

**Deliberate omission:** `featured-product.liquid` shares the gallery snippet but does **not** opt in — it is not guaranteed to be above the fold, and only the true LCP element should be prioritised.

**Rollback:** `git revert 6121a4f`

---

### 3. `e428d73` — Eager-load the first row of story avatars

**Files:** `sections/collection-stories.liquid`

`collection-stories` is section 1 on the product template and section 2 on the collection template, so its avatar strip renders inside the initial viewport on both — yet every avatar was `loading="lazy"`.

The first six avatars now load eagerly; the rest stay lazy because the strip scrolls horizontally.

**Expected effect:** faster visual completeness above the fold on PDP and PLP. Small-to-medium.

**Untouched:** the story-viewer images (`:157-163`) and thumbnails (`:188-191`) further down the section remain lazy.

**Rollback:** `git revert e428d73`

---

### 4. `220f093` — Defer footer CSS

**Files:** `snippets/stylesheet-deferred.liquid` *(new)*, `sections/footer.liquid`

The footer emitted five render-blocking stylesheets — `section-footer.css` 12.9 KB, `component-newsletter.css`, `component-list-menu.css`, `component-list-payment.css`, `component-list-social.css` (**15.2 KB total**) — for content that is, by definition, the last thing on the page.

Adds `snippets/stylesheet-deferred.liquid`, which wraps the `media="print" onload="this.media='all'"` swap **already used** by `layout/theme.liquid:282` and `sections/header.liquid:1-3`, and adds the `<noscript>` fallback those two lack.

**Expected effect:** 5 stylesheets off the render-blocking path on every page. `component-list-menu.css` and `component-list-social.css` are also requested by the header, which already loads them deferred — so this removes the blocking copy rather than adding a request.

**Rollback:** `git revert 220f093`. The snippet is additive; nothing else depends on it once reverted.

---

### 5. `b5db770` — Defer icon-benefits CSS; document why the marquee CSS must stay blocking

**Files:** `sections/icon-benefits.liquid`, `sections/reviews-marquee.liquid`

`icon-benefits` is a pure CSS grid with no JavaScript, so its 2.9 KB stylesheet is safe to defer. Guarded on `section.index > 2` so it reverts to blocking if a merchant moves it to the top of a template.

**`reviews-marquee` was evaluated for the same treatment and rejected.** `assets/section-reviews-marquee.js:54-79` measures card widths in `connectedCallback` to derive the marquee duration and clone count, and its `ResizeObserver` early-returns when the viewport width is unchanged (`:171`). Deferring the stylesheet only resizes the marquee's *children*, so the observer would never fire — the marquee would run at the wrong speed with a visible gap at the loop seam, and never self-correct. A comment recording this is now in the section so it is not retried.

**Rollback:** `git revert b5db770`

---

### 6. `5b96b33` — Defer cart drawer inner styles

**Files:** `snippets/cart-drawer.liquid`

The cart drawer renders on every page in drawer mode and emitted four render-blocking stylesheets — `component-card.css` 14.3 KB, `quantity-popover.css` 3.3 KB, `component-cart-free-ship.css`, `component-cart-timer.css` (**19.5 KB total**) — for content hidden until the shopper opens the drawer.

**`component-cart-drawer.css` deliberately stays blocking.** It supplies the `position: fixed` that takes the drawer out of the document flow. The inline `.drawer { visibility: hidden }` at `snippets/cart-drawer.liquid` hides the drawer but **still reserves layout space**, so deferring that file would drop the entire drawer into normal flow on every page load and snap it out when the CSS landed — a severe CLS regression. A comment in the file records this.

**Verified before editing:** no drawer JS reads layout at load — no `getBoundingClientRect` / `clientWidth` / `offsetWidth` in `cart.js`, `cart-drawer.js`, `cart-timer.js` or `quantity-popover.js`.

**Rollback:** `git revert 5b96b33`

---

### 7. Un-gate the LCP element from the scroll-reveal animation *(approved by developer)*

**Files:** `sections/image-banner.liquid`, `snippets/product-media-gallery.liquid`

**The single largest LCP item in the audit.** `settings.animations_reveal_on_scroll` is `true`, and `assets/base.css:3272-3275` holds `.scroll-trigger.animate--fade-in` at `opacity: 0.01`. The class was on the homepage hero and on the PDP's first gallery slide — so both stayed effectively invisible until `animations.js` downloaded, `DOMContentLoaded` fired, an `IntersectionObserver` was constructed and its first callback ran. A browser will not count an invisible element as an LCP paint, so **LCP was pinned to script execution rather than image decode.**

- `image-banner.liquid` — new `reveal_media` flag, `false` when `section.index == 1`. Applied to the banner wrapper and all three `.banner__media` variants.
- `product-media-gallery.liquid` — new `reveal_featured` / `reveal_item` flags, `false` only for the one eagerly loaded slide, and only when the calling section opted into `fetch_priority: 'high'`.

**Expected effect:** removes the JS dependency from the LCP paint on the homepage and PDP. This is the change most likely to show up in the PSI *LCP breakdown → element render delay* figure.

**Visual change (the approved one):** the homepage hero image and the PDP's first product image now appear immediately instead of fading in.

**Explicitly preserved:**
- The hero's **text content still slides in** — `image-banner.liquid:166` keeps `animate--slide-in` untouched.
- Any image-banner that is **not** the first section still fades in normally.
- `featured-product.liquid` shares the gallery snippet but never opts into `'high'`, so its animation is unchanged.
- The `image_behavior` animations (ambient / fixed / zoom-in) are a separate mechanism and are untouched.
- All other sections keep their reveals.

**Verified:** `scroll-trigger` carries no layout CSS in `section-image-banner.css`, `section-main-product.css` or `component-slider.css` — it is purely an animation hook, so removing it cannot shift layout. `animations.js` simply observes fewer elements.

**Not included — collection page:** `sections/main-collection-product-grid.liquid:166` puts `scroll-trigger animate--slide-in` with `data-cascade` on every product card, so the PLP's LCP is gated the same way. It was left alone because it has a design wrinkle the hero does not — see R8 below.

**Rollback:** `git revert <sha>`

---

## Net effect

| | |
|---|---|
| Render-blocking stylesheets removed from the critical path | **10 files, ≈37.6 KB uncompressed** |
| Dead assets no longer requested | 6.6 KB (cart-notification JS + CSS) |
| LCP priority signals added | PDP first gallery image |
| Above-fold images un-lazied | first 6 story avatars |
| LCP elements un-gated from JS-dependent reveal | homepage hero, PDP first gallery image |
| Visual changes | **one, approved** — hero and PDP first image no longer fade in (change 7) |
| Behavioural changes | **none** |
| Schema setting `id`s changed | **none** |
| Files under `assets/` modified | **none** |
| Dawn core files modified | **none** (`base.css`, `global.js` untouched) |

**Set expectations honestly:** all theme assets are served over a single HTTP/2 connection from `cdn.shopify.com` with Brotli, so ≈37.6 KB uncompressed is roughly 6–8 KB on the wire and the 10 requests were multiplexed, not 10 round trips. This is a solid, safe improvement to *Eliminate render-blocking resources* (a GTmetrix **Structure** item, listed file-by-file in PSI) — expect a few points, not a transformation.

**The two changes that would materially move LCP are still outstanding and both need your decision** — see the developer-review list below.

---

## Developer-review list — deliberately NOT applied

### ~~R1. Hero / LCP scroll-reveal animation~~ — **approved and shipped, see change 7 above** (homepage + PDP)

### R8. Collection-page cards are still gated by the scroll reveal

`sections/main-collection-product-grid.liquid:166` puts `scroll-trigger animate--slide-in` plus `data-cascade` and `--animation-order` on every product card `<li>`, so the PLP's LCP card sits at `opacity: 0.01` until `animations.js` runs — the same defect change 7 fixed on the homepage and PDP.

**Why it was not done with the others.** The hero is a single element, so un-gating it is clean. The grid is a *staggered cascade*, and un-gating only the eager cards would look broken: `lazy_load` goes eager for `forloop.index <= 2`, so on a 4-column desktop row cards 1–2 would appear instantly while cards 3–4 slid in beside them.

**The fix that would work** is to skip the reveal for the first `section.settings.columns_desktop` cards instead of the first 2 — that un-gates exactly one full row on desktop, and two full rows on mobile where `columns_mobile` is 2. Rows stay internally consistent at both breakpoints, so there is no ragged edge.

**What would make it safe:** your call on the visual delta — the first row (desktop) / first two rows (mobile) of every collection page would appear immediately rather than cascading in. Say the word and it is a one-line change.

### R2. Remaining render-blocking CSS (audit F3, second half)

Not deferred, and why:
- `component-card.css` / `component-card-cro.css` from `featured-collection` and `card-product` — `main-collection-product-grid.liquid:2` loads `component-card.css` blocking for cards that **are** above the fold on the PLP. Deferring it per-section needs a viewport-aware rule this codebase does not have.
- `section-collection-deals-slider.css` (11.2 KB) — sits at index 3 on the homepage, directly under the hero. On a tall desktop viewport it may be partially visible, and its JS is a slider that may measure.
- `section-reviews-marquee.css` (12.9 KB) — blocked by the measurement bug in R3.

**What would make these safe:** a real-device check of exactly where the fold falls on the live homepage at 375 px and 1440 px.

### R3. Make the reviews marquee deferrable (audit F14)

Have `section-reviews-marquee.js` wait for its stylesheet before measuring — e.g. re-run `layout()` on the `<link>`'s `load` event, or observe a child instead of the viewport. Unlocks 12.9 KB. **What would make it safe:** a behavioural change to working JS, so it needs a real-device test of the marquee speed and seam at several breakpoints.

### R4. `content-visibility: auto` on below-fold sections (audit F9)

Genuinely hazardous here: it breaks in-page anchors and find-in-page for skipped content, and a wrong `contain-intrinsic-size` *causes* CLS instead of avoiding it. The marquee and deals slider are horizontally scrolling containers whose intrinsic size is hard to predict, and it interacts with the `IntersectionObserver`s in `section-reviews-marquee.js` and `pdp-sticky-atc.js`. **What would make it safe:** apply to the footer only (fixed height, no anchors), verified on a real device.

### R5. Drop the logo preload (audit F10)

`sections/header.liquid:369`/`:412` pass `preload: true`. The logo is never the LCP. **What would make it safe:** measure both ways after R1 lands — do not change it blind.

### R6. Collapse duplicated mobile/desktop nav DOM (audit F11)

`sections/header.liquid:340` renders the full mobile nav and `:384`/`:386` the full desktop nav. Collapsing them would touch the mega-menu layouts, drawer layouts, `menu-drawer-columns.js`, `menu-drawer-search.js`, `header-menu-hover.js` and five custom stylesheets. **Recommendation: don't.** The DOM saving does not justify the regression surface.

### R7. Minify custom CSS/JS (audit F12)

~150 KB of custom assets ship unminified, consistent with Dawn itself. Shopify serves everything Brotli-compressed, which recovers most of what minification would. **Recommendation: don't** — an enormous unreviewable diff and a real chance of introducing a syntax error, for a small post-compression gain.

---

## Post-upload test checklist

Re-zip the folder, upload, and preview **before publishing**. Test on **mobile and desktop**.

### Highest priority — what these changes actually touched

- [ ] **Cart drawer opens and is fully styled** (change 6). Add to cart from a product card, from the PDP, and from a quick-add button. The drawer must slide in correctly styled — item rows, thumbnails, quantity stepper, free-shipping bar, countdown timer, subtotal.
- [ ] **No layout jump on page load.** Watch the top of the homepage as it loads on a throttled connection. The cart drawer must never appear in the page flow, even for a frame.
- [ ] **Footer renders fully styled** (change 4) on homepage, PDP, PLP, cart and a blog article — menus, newsletter form, payment icons, social icons.
- [ ] **Footer with JavaScript disabled** — the `<noscript>` fallback should keep it styled.
- [ ] **PDP first image still loads and displays**, gallery arrows/thumbnails work, zoom opens (change 2).
- [ ] **Story strip** on PDP and collection page — first avatars visible immediately, tapping opens the story viewer, video stories play (change 3).
- [ ] **Reviews marquee scrolls at the correct speed with no gap at the loop seam** on homepage and PDP — this is the regression that change 5 deliberately avoided; confirm it is still correct.
- [ ] **icon-benefits section renders styled** on the homepage (change 5).
- [ ] **Homepage hero appears immediately, does not fade in** — this is the intended change. Its **text still slides in** (change 7).
- [ ] **PDP first product image appears immediately**; the rest of the gallery still fades in as you scroll (change 7).
- [ ] **Add a second image-banner further down the homepage** in the theme editor and confirm it *still fades in* — only the first section is un-gated (change 7).
- [ ] **Every other section still animates on scroll** — trust bar, deals slider, featured collections, icon benefits, collection cards (change 7).

### Regression sweep

- [ ] **Home** — sections render in order, deals slider scrolls, marquee runs, popups fire, announcement bar cycles.
- [ ] **Collection** — products load, filters apply and clear, sort works, pagination / load-more works, quick-add works, collection switcher works.
- [ ] **PDP** — variant switch updates price / image / availability / SKU, sold-out states, quantity rules, add to cart, sticky ATC appears on scroll, accordions and size guide open, related products render.
- [ ] **Cart** — drawer qty change, remove, note, discount field, subtotal updates, checkout link resolves (**do not place an order**).
- [ ] **Header/footer** — mobile menu, submenus, mega menu, predictive search, sticky behaviour, cart-count badge, newsletter form.
- [ ] **Theme editor** — add / reorder / select each touched section (header, footer, icon-benefits, collection-stories, reviews-marquee, main-product) and confirm it re-renders and responds to setting changes.
- [ ] **Switch `cart_type` to "notification"** in theme settings, confirm the notification appears and is styled, then switch back to "drawer" (validates change 1's guard).
- [ ] Check every storefront language if the store is multilingual.

### Then measure

- [ ] GTmetrix, mobile and desktop, **twice each**, compare to baseline.
- [ ] PageSpeed Insights, mobile and desktop, **twice each**. Judge on **lab** data — CrUX field data lags ~28 days and will not reflect this upload yet.
- [ ] Specifically re-check PSI's *Eliminate render-blocking resources* list: `section-footer.css`, `component-newsletter.css`, `component-list-payment.css`, `component-card.css`, `quantity-popover.css`, `component-cart-timer.css`, `component-cart-free-ship.css`, `component-list-menu.css`, `component-list-social.css` and `section-icon-benefits.css` should no longer be listed.
