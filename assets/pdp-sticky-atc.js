/* Sticky add-to-cart bar — Taal Store PDP (Dawn).
   Reveals a fixed bottom bar once the real buy button scrolls out of view; its
   button re-triggers Dawn's own product-form submit (no custom cart logic). */
(function () {
  if (customElements.get('pdp-sticky-atc')) return;

  class PdpStickyAtc extends HTMLElement {
    connectedCallback() {
      this.target = document.querySelector(this.getAttribute('data-observe') || 'product-form');
      this.btn = this.querySelector('[data-sticky-add]');
      if (this.btn) {
        this.onClick = this.trigger.bind(this);
        this.btn.addEventListener('click', this.onClick);
      }
      if (!this.target || !('IntersectionObserver' in window)) return;

      this.io = new IntersectionObserver(
        (entries) => {
          var e = entries[0];
          var scrolledPast = e.boundingClientRect.top < 0;
          this.classList.toggle('is--visible', !e.isIntersecting && scrolledPast);
        },
        { threshold: 0 }
      );
      this.io.observe(this.target);
    }

    realButton() {
      if (!this._real) {
        this._real = document.querySelector('product-form .product-form__submit, .product-form__submit');
      }
      return this._real;
    }

    trigger(e) {
      if (e) e.preventDefault();
      var real = this.realButton();
      if (real && !real.disabled) real.click();
    }

    disconnectedCallback() {
      if (this.io) this.io.disconnect();
      if (this.btn && this.onClick) this.btn.removeEventListener('click', this.onClick);
    }
  }

  customElements.define('pdp-sticky-atc', PdpStickyAtc);
})();
