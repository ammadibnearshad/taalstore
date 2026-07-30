/* ===========================================================================
   <cart-timer> custom element
   ---------------------------------------------------------------------------
   Powers the cart expiry / urgency banner rendered by snippets/cart-timer.liquid
   inside the cart drawer (snippets/cart-drawer.liquid).

   Lives in a global, defer-loaded file (not inline) because the cart drawer is
   re-rendered via Shopify's Section Rendering API and injected with innerHTML —
   inline <script> tags do NOT execute that way. Registering the element here
   means it auto-upgrades whenever <cart-timer> appears, on initial load OR on
   any AJAX re-render of the drawer.

   Two modes (data-mode):
     - "minutes": counts down N minutes (data-minutes). The end time is
       persisted in localStorage so the countdown stays consistent across
       drawer re-renders and page reloads instead of resetting each time.
     - "date": counts down to an absolute instant (data-end-epoch, UNIX
       seconds emitted by Liquid in the store timezone, so every visitor
       counts to the same moment regardless of their own timezone).

   On expiry (data-on-expiry): "restart" (minutes only), "freeze" (show 00:00),
   or "hide".
   =========================================================================== */
(function () {
  if (typeof customElements === 'undefined') return;
  if (customElements.get('cart-timer')) return;

  const STORAGE_KEY = 'taal:cartTimerEnd';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function format(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (days > 0) return days + ':' + pad(hours) + ':' + pad(mins) + ':' + pad(secs);
    if (hours > 0) return pad(hours) + ':' + pad(mins) + ':' + pad(secs);
    return pad(mins) + ':' + pad(secs);
  }

  function readStore() {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      return v ? parseInt(v, 10) : null;
    } catch (e) {
      return null;
    }
  }

  function writeStore(ms) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(ms));
    } catch (e) {
      /* storage unavailable (private mode) — timer still runs for this render */
    }
  }

  function clearStore() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* no-op */
    }
  }

  class CartTimer extends HTMLElement {
    connectedCallback() {
      this.valueEl = this.querySelector('.cart-timer__value');
      this.mode = this.getAttribute('data-mode') || 'minutes';
      this.onExpiry = this.getAttribute('data-on-expiry') || 'restart';
      this.minutes = parseInt(this.getAttribute('data-minutes'), 10) || 10;

      this.targetMs = this.resolveTarget();

      // Invalid / missing config (e.g. date mode with no end date) — stay hidden.
      if (!this.targetMs) {
        this.hidden = true;
        return;
      }

      this.hidden = false;
      this.tick();
      this.intervalId = setInterval(this.tick.bind(this), 1000);
    }

    disconnectedCallback() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }

    resolveTarget() {
      if (this.mode === 'date') {
        const epoch = parseInt(this.getAttribute('data-end-epoch'), 10);
        if (!epoch) return null;
        return epoch * 1000;
      }
      // minutes mode — reuse a persisted, still-future end time if one exists.
      const now = Date.now();
      const stored = readStore();
      if (stored && stored > now) return stored;
      const end = now + this.minutes * 60000;
      writeStore(end);
      return end;
    }

    tick() {
      const now = Date.now();
      let diffMs = this.targetMs - now;

      if (diffMs <= 0) {
        if (this.mode === 'minutes' && this.onExpiry === 'restart') {
          this.targetMs = now + this.minutes * 60000;
          writeStore(this.targetMs);
          diffMs = this.targetMs - now;
        } else if (this.onExpiry === 'hide') {
          if (this.valueEl) this.valueEl.textContent = format(0);
          this.hidden = true;
          this.disconnectedCallback();
          if (this.mode === 'minutes') clearStore();
          return;
        } else {
          // freeze
          if (this.valueEl) this.valueEl.textContent = format(0);
          this.disconnectedCallback();
          if (this.mode === 'minutes') clearStore();
          return;
        }
      }

      if (this.valueEl) {
        this.valueEl.textContent = format(Math.floor(diffMs / 1000));
      }
    }
  }

  customElements.define('cart-timer', CartTimer);
})();
