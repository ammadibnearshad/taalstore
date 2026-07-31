# Merchant actions — things that cannot be fixed in theme code

Everything here lives **outside** the theme files. No amount of editing `sections/`, `snippets/` or `assets/` will change any of it. These will still appear in GTmetrix / PageSpeed after the re-upload, and that is expected — they are not theme bugs.

Ordered by likely impact.

---

## 1. App scripts and app embeds — usually the single biggest remaining cost

**What was found in the theme code:** three `apps` sections are placed in the templates —

| Template | Position | Section id |
|---|---|---|
| `templates/index.json` | 8 of 10 | `17854013001c83a40a` |
| `templates/index.json` | 10 of 10 | `17854013788d1c91d6` |
| `templates/product.json` | 4 of 5 | `1785407577cbfdaf87` |

Each is an app block container. **What they load is not visible in the theme files** — the app injects it at render time.

Separately, every installed app with an "app embed" enabled injects script tags through `{{ content_for_header }}` (`layout/theme.liquid:66`), which is likewise invisible here.

**What to do (Shopify admin):**
1. **Online Store → Themes → Customize** — look at each `apps` block above and ask whether that app still earns its place. Removing an unused app block is a one-click change with a large payoff.
2. **Settings → Apps and sales channels** — uninstall apps you no longer use. *Deactivating* is not enough; uninstall to stop the injection.
3. **Online Store → Themes → Customize → App embeds** (bottom of the left panel) — toggle off embeds you do not need. Review widgets, upsell popups, chat widgets and trackers are the usual offenders.
4. After each removal, re-run PageSpeed to see what it actually bought.

**Why the theme can't fix it:** deleting app blocks or app-injected scripts from theme code breaks the app and they are re-injected on the next render anyway. This is admin-side only.

---

## 2. "Serve static assets with an efficient cache policy"

**This will keep failing and it is not fixable.** Shopify's CDN sets cache headers on theme assets automatically and correctly. Every entry in this PSI audit will be a **third-party or app-hosted script** whose cache headers belong to that vendor, not to you.

**What to do:** use the list as evidence for item 1 — if a third-party script shows up here and you cannot identify which app it belongs to, that is a strong signal to audit your app list. Otherwise ignore this audit.

---

## 3. Field data ("Discover what your real users are experiencing") will not move yet

PageSpeed's field data comes from the Chrome UX Report, which is a **rolling 28-day average**. It will not reflect this upload for about four weeks, and it may look unchanged or briefly worse while the window rolls over.

**Judge this upload on the lab data** (the "Diagnose performance issues" section) and on GTmetrix, both of which test the page live.

---

## 4. Image source quality — worth a look

The homepage hero desktop image is `Gemini_Generated_Image_f4ylt2f4ylt2f4yl.png`.

Shopify automatically converts to WebP/AVIF and resizes on delivery, so **the PNG source is not itself a performance problem** and no theme change is needed. But two things are worth checking in **Content → Files**:

- If the source PNG is very large in pixel dimensions (well over 3000 px wide), you are storing and transcoding more than any device will use.
- AI-generated PNGs are often uncompressed. Re-uploading a reasonably sized, compressed source costs nothing and slightly reduces transcode time.

The mobile hero is already a `.webp`. Good.

---

## 5. Theme settings you could change without any code

Two live settings have a measurable cost:

**`animations_reveal_on_scroll` is ON.** This is the single largest LCP cost identified in the whole audit — it holds the hero, the first PDP gallery image and every collection card at `opacity: 0.01` until JavaScript runs. Turning it off in **Customize → Theme settings → Animations** would remove that cost immediately, store-wide, with no code change.

That is a bigger visual change than the targeted code fix proposed in `CHANGELOG.md` (R1), which only affects the first section's media and leaves every other animation intact. **Prefer the targeted fix.** The toggle is listed here because it is the zero-code option if you want to A/B the impact quickly.

**`predictive_search_enabled` is ON.** Costs `predictive-search.js` (9.4 KB) plus a stylesheet on every page. It is a genuine conversion feature — keep it unless search is unused in your analytics.

---

## 6. Not fixable, no action possible

For completeness, these appear in reports and are Shopify platform behaviour:

- Shopify's own `standard-events.js` analytics module (`layout/theme.liquid:31-50`)
- `{{ content_for_header }}` platform scripts
- Consent / tracking APIs
- Checkout redirects and `checkout.liquid` (out of scope by policy — untouched)
