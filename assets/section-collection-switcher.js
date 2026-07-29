/* Collection switcher tabs — centers the active tab, arrow scrolling on desktop.
   Dawn port: sticky offset reads the real header height (Dawn has no --header-height). */
(function () {
  class CollectionSwitcher extends HTMLElement {
    connectedCallback() {
      this.viewport = this.querySelector('[data-cswitch-viewport]');
      this.prevBtn = this.querySelector('[data-cswitch-prev]');
      this.nextBtn = this.querySelector('[data-cswitch-next]');
      if (!this.viewport) return;

      this.onScroll = this.throttle(this.updateArrows.bind(this));
      this.onResize = this.throttle(this.updateArrows.bind(this));
      this.onPrev = () => this.scrollByStep(-1);
      this.onNext = () => this.scrollByStep(1);

      this.viewport.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize, { passive: true });
      if (this.prevBtn) this.prevBtn.addEventListener('click', this.onPrev);
      if (this.nextBtn) this.nextBtn.addEventListener('click', this.onNext);

      this.revealActive();
      this.updateArrows();
      this.setupSticky();
    }

    disconnectedCallback() {
      if (this.viewport) this.viewport.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onResize);
      if (this.prevBtn) this.prevBtn.removeEventListener('click', this.onPrev);
      if (this.nextBtn) this.nextBtn.removeEventListener('click', this.onNext);
      if (this.rebuildSticky) window.removeEventListener('resize', this.rebuildSticky);
      if (this.stickyObserver) this.stickyObserver.disconnect();
      if (this.sentinel && this.sentinel.parentNode) this.sentinel.parentNode.removeChild(this.sentinel);
    }

    /* Dawn's sticky header is <sticky-header>/.section-header; measure it at runtime
       (Dawn does not expose a --header-height CSS var). Falls back to the var if set. */
    headerHeight() {
      const el = document.querySelector('sticky-header, .section-header, #shopify-section-header');
      let h = el ? el.offsetHeight : 0;
      if (!h) {
        h = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height'), 10) || 0;
      }
      return h;
    }

    /* Toggle .is--stuck (for the shadow) once the bar pins under the header.
       A zero-height sentinel sits just above the bar; when it scrolls past the
       header line the bar is stuck. */
    setupSticky() {
      if (!this.classList.contains('t4s-cswitch--sticky-mb')) return;
      if (!('IntersectionObserver' in window) || !this.parentNode) return;

      this.sentinel = document.createElement('span');
      this.sentinel.setAttribute('aria-hidden', 'true');
      this.sentinel.style.cssText = 'display:block;height:0;width:0;pointer-events:none;';
      this.parentNode.insertBefore(this.sentinel, this);

      const build = () => {
        if (this.stickyObserver) this.stickyObserver.disconnect();
        const h = this.headerHeight();
        this.stickyObserver = new IntersectionObserver(
          (entries) => {
            this.classList.toggle('is--stuck', entries[0].intersectionRatio === 0);
          },
          { rootMargin: '-' + h + 'px 0px 0px 0px', threshold: [0, 1] }
        );
        this.stickyObserver.observe(this.sentinel);
      };
      build();
      this.rebuildSticky = this.throttle(build);
      window.addEventListener('resize', this.rebuildSticky, { passive: true });
    }

    throttle(fn) {
      let ticking = false;
      return () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          fn();
        });
      };
    }

    /* Bring the current collection's tab into view without scrolling the page itself. */
    revealActive() {
      const active = this.querySelector('[data-cswitch-active]');
      if (!active) return;
      const target = active.offsetLeft - (this.viewport.clientWidth - active.offsetWidth) / 2;
      const max = this.viewport.scrollWidth - this.viewport.clientWidth;
      this.viewport.scrollLeft = Math.max(0, Math.min(target, max));
    }

    scrollByStep(direction) {
      this.viewport.scrollBy({
        left: direction * Math.round(this.viewport.clientWidth * 0.7),
        behavior: 'smooth',
      });
    }

    updateArrows() {
      if (!this.prevBtn || !this.nextBtn) return;
      const max = this.viewport.scrollWidth - this.viewport.clientWidth;
      const overflows = max > 2;
      const left = this.viewport.scrollLeft;
      this.prevBtn.hidden = !overflows || left <= 2;
      this.nextBtn.hidden = !overflows || left >= max - 2;
    }
  }

  if (!customElements.get('collection-switcher')) {
    customElements.define('collection-switcher', CollectionSwitcher);
  }
})();
