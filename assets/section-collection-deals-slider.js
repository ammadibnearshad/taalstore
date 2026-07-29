/* section-collection-deals-slider.js
   Drives the collection deals slider: arrow nav, mouse drag, disabled states
   and the draggable scroll progress bar. Scrolling itself is native (CSS
   scroll-snap) — this only reads/writes scroll position, so it stays cheap
   and keeps working for touch users before JS runs.

   Ported from the Be Yours reference theme (assets/section-cl-deals-slider.js).
   Internal class names stay in the `cl-deals` namespace — this file depends on
   them, so don't rename them in the CSS/Liquid without updating here.
*/

class ClDealsSlider extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('.cl-deals__track');
    if (!this.track) return;

    this.prevButton = this.querySelector('.cl-deals__arrow--prev');
    this.nextButton = this.querySelector('.cl-deals__arrow--next');
    this.progressBar = this.querySelector('.cl-deals__progress');
    this.progressThumb = this.querySelector('.cl-deals__progress-thumb');

    this.rtl = document.documentElement.getAttribute('dir') === 'rtl';
    this.stepMode = this.dataset.scrollStep === 'page' ? 'page' : 'slide';
    this.slideDuration = parseInt(this.dataset.slideDuration, 10) || 600;
    this.ticking = false;
    this.drag = null;
    this.scrubId = null;
    this.suppressClick = false;
    this.animationId = null;

    this.onScroll = this.handleScroll.bind(this);
    this.onArrowClick = this.handleArrowClick.bind(this);
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onClick = this.handleClick.bind(this);
    this.onDragStart = this.handleDragStart.bind(this);
    this.onScrubDown = this.handleScrubDown.bind(this);
    this.onScrubMove = this.handleScrubMove.bind(this);
    this.onScrubUp = this.handleScrubUp.bind(this);

    this.onWheel = () => this.cancelAnimation();

    this.track.addEventListener('scroll', this.onScroll, { passive: true });
    this.track.addEventListener('wheel', this.onWheel, { passive: true });
    this.track.addEventListener('pointerdown', this.onPointerDown);
    this.track.addEventListener('click', this.onClick, true);
    this.track.addEventListener('dragstart', this.onDragStart);
    if (this.prevButton) this.prevButton.addEventListener('click', this.onArrowClick);
    if (this.nextButton) this.nextButton.addEventListener('click', this.onArrowClick);
    if (this.progressBar) this.progressBar.addEventListener('pointerdown', this.onScrubDown);

    this.resizeObserver = new ResizeObserver(() => this.update());
    this.resizeObserver.observe(this.track);

    if (window.Shopify && window.Shopify.designMode) {
      this.onBlockSelect = this.handleBlockSelect.bind(this);
      document.addEventListener('shopify:block:select', this.onBlockSelect);
    }

    this.update();
  }

  disconnectedCallback() {
    this.cancelAnimation();
    if (this.track) {
      this.track.removeEventListener('scroll', this.onScroll);
      this.track.removeEventListener('wheel', this.onWheel);
      this.track.removeEventListener('pointerdown', this.onPointerDown);
      this.track.removeEventListener('pointermove', this.onPointerMove);
      this.track.removeEventListener('pointerup', this.onPointerUp);
      this.track.removeEventListener('pointercancel', this.onPointerUp);
      this.track.removeEventListener('click', this.onClick, true);
      this.track.removeEventListener('dragstart', this.onDragStart);
    }
    if (this.progressBar) {
      this.progressBar.removeEventListener('pointerdown', this.onScrubDown);
      this.progressBar.removeEventListener('pointermove', this.onScrubMove);
      this.progressBar.removeEventListener('pointerup', this.onScrubUp);
      this.progressBar.removeEventListener('pointercancel', this.onScrubUp);
    }
    if (this.prevButton) this.prevButton.removeEventListener('click', this.onArrowClick);
    if (this.nextButton) this.nextButton.removeEventListener('click', this.onArrowClick);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.onBlockSelect) document.removeEventListener('shopify:block:select', this.onBlockSelect);
  }

  /* Theme editor: bring the block the merchant just selected into view */
  handleBlockSelect(event) {
    if (!this.contains(event.target)) return;

    const slide = event.target.closest('.cl-deals__slide');
    if (!slide) return;

    slide.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' });
  }

  get maxScroll() {
    return Math.max(0, this.track.scrollWidth - this.track.clientWidth);
  }

  /* RTL reports scrollLeft as 0..-max in Chromium/Firefox; normalise to 0..max */
  get position() {
    return Math.min(Math.abs(this.track.scrollLeft), this.maxScroll);
  }

  handleScroll() {
    if (this.ticking) return;
    this.ticking = true;

    requestAnimationFrame(() => {
      this.ticking = false;
      this.update();
    });
  }

  handleArrowClick(event) {
    event.preventDefault();

    const direction = event.currentTarget.name === 'next' ? 1 : -1;
    const amount = this.getStep() * direction * (this.rtl ? -1 : 1);

    this.animateScrollTo(this.track.scrollLeft + amount);
  }

  /* ---------- Eased scrolling ----------
     Native `scroll-behavior: smooth` gives no control over duration and lands
     abruptly. This drives scrollLeft over a fixed duration with an ease-out so
     arrows, snapping and flicks all decelerate the same way. */

  get reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  animateScrollTo(target, duration) {
    this.cancelAnimation();

    const start = this.track.scrollLeft;
    const distance = target - start;
    if (Math.abs(distance) < 1) return;

    if (this.reducedMotion) {
      this.track.scrollLeft = target;
      return;
    }

    const total = duration || this.slideDuration;
    const startTime = performance.now();

    /* Snapping and native smooth scroll both fight a scrollLeft written every
       frame, so they stay off until the animation finishes. */
    this.classList.add('is-animating');

    const step = (now) => {
      const progress = Math.min((now - startTime) / total, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.track.scrollLeft = start + distance * eased;

      if (progress < 1) {
        this.animationId = requestAnimationFrame(step);
      } else {
        this.animationId = null;
        this.classList.remove('is-animating');
      }
    };

    this.animationId = requestAnimationFrame(step);
  }

  cancelAnimation() {
    if (!this.animationId) return;
    cancelAnimationFrame(this.animationId);
    this.animationId = null;
    this.classList.remove('is-animating');
  }

  /* ---------- Drag the track ----------
     Touch and pen already scroll the track natively, so only a mouse needs
     help here. The gesture writes scrollLeft directly and snaps on release. */

  handlePointerDown(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (this.maxScroll < 2) return;

    this.cancelAnimation();

    this.drag = {
      id: event.pointerId,
      startX: event.clientX,
      startScroll: this.track.scrollLeft,
      moved: false,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0
    };

    this.track.addEventListener('pointermove', this.onPointerMove);
    this.track.addEventListener('pointerup', this.onPointerUp);
    this.track.addEventListener('pointercancel', this.onPointerUp);
  }

  handlePointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.id) return;

    const delta = event.clientX - this.drag.startX;

    /* A few pixels of slop so a shaky click still opens the collection. */
    if (!this.drag.moved) {
      if (Math.abs(delta) < 4) return;
      this.drag.moved = true;
      this.classList.add('is-dragging');
      this.track.setPointerCapture(this.drag.id);
    }

    event.preventDefault();
    this.track.scrollLeft = this.drag.startScroll - delta;

    /* Scroll-axis velocity in px/ms, used to project a flick past the card
       the pointer happened to stop on. */
    const now = performance.now();
    const elapsed = now - this.drag.lastTime;
    if (elapsed > 0) {
      this.drag.velocity = (this.drag.lastX - event.clientX) / elapsed;
      this.drag.lastX = event.clientX;
      this.drag.lastTime = now;
    }
  }

  handlePointerUp(event) {
    if (!this.drag || event.pointerId !== this.drag.id) return;

    this.track.removeEventListener('pointermove', this.onPointerMove);
    this.track.removeEventListener('pointerup', this.onPointerUp);
    this.track.removeEventListener('pointercancel', this.onPointerUp);

    if (this.drag.moved) {
      if (this.track.hasPointerCapture(this.drag.id)) {
        this.track.releasePointerCapture(this.drag.id);
      }
      this.classList.remove('is-dragging');
      /* The pointer comes up on a card link — swallow the click it fires. */
      this.suppressClick = true;

      /* A quick flick should carry past the nearest edge; a slow drag shouldn't.
         Cap the throw so one gesture never skips the whole track. */
      const throw_ = Math.max(Math.min(this.drag.velocity * 220, this.track.clientWidth), -this.track.clientWidth);
      this.snapToNearest(this.track.scrollLeft + throw_);
    }

    this.drag = null;
  }

  handleClick(event) {
    if (!this.suppressClick) return;
    this.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  handleDragStart(event) {
    event.preventDefault();
  }

  /* ---------- Drag the progress bar ---------- */

  handleScrubDown(event) {
    if (this.maxScroll < 2) return;

    this.cancelAnimation();
    this.scrubId = event.pointerId;
    this.classList.add('is-scrubbing');
    this.progressBar.setPointerCapture(event.pointerId);
    this.progressBar.addEventListener('pointermove', this.onScrubMove);
    this.progressBar.addEventListener('pointerup', this.onScrubUp);
    this.progressBar.addEventListener('pointercancel', this.onScrubUp);

    event.preventDefault();
    this.scrubTo(event.clientX);
  }

  handleScrubMove(event) {
    if (event.pointerId !== this.scrubId) return;
    event.preventDefault();
    this.scrubTo(event.clientX);
  }

  handleScrubUp(event) {
    if (event.pointerId !== this.scrubId) return;

    this.progressBar.removeEventListener('pointermove', this.onScrubMove);
    this.progressBar.removeEventListener('pointerup', this.onScrubUp);
    this.progressBar.removeEventListener('pointercancel', this.onScrubUp);
    if (this.progressBar.hasPointerCapture(this.scrubId)) {
      this.progressBar.releasePointerCapture(this.scrubId);
    }

    this.scrubId = null;
    this.classList.remove('is-scrubbing');
    this.snapToNearest();
  }

  /* Inverse of update(): the thumb centre tracks the pointer, so the usable
     travel is the bar minus the thumb's own width. */
  scrubTo(clientX) {
    const rect = this.progressBar.getBoundingClientRect();
    if (!rect.width) return;

    const thumb = Math.max(this.track.clientWidth / this.track.scrollWidth, 0.1);
    const denominator = 1 - thumb;

    let ratio = (clientX - rect.left) / rect.width;
    ratio = denominator > 0 ? (ratio - thumb / 2) / denominator : 0;
    ratio = Math.min(Math.max(ratio, 0), 1);

    const target = ratio * this.maxScroll;
    this.track.scrollLeft = this.rtl ? -target : target;
  }

  /* Land on a card edge once a free-form gesture ends. `from` lets a flick
     aim at where the throw would have carried it, not where the finger left. */
  snapToNearest(from) {
    const slides = this.track.querySelectorAll('.cl-deals__slide');
    if (slides.length < 2) return;

    const origin = slides[0].offsetLeft;
    const max = this.maxScroll;
    const current = from === undefined ? this.track.scrollLeft : from;

    let best = 0;
    let bestDistance = Infinity;

    slides.forEach((slide) => {
      const raw = slide.offsetLeft - origin;
      const left = this.rtl ? Math.max(raw, -max) : Math.min(raw, max);
      const distance = Math.abs(left - current);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = left;
      }
    });

    this.animateScrollTo(best);
  }

  getStep() {
    const slides = this.track.querySelectorAll('.cl-deals__slide');
    if (slides.length < 2) return this.track.clientWidth;

    const offset = Math.abs(slides[1].offsetLeft - slides[0].offsetLeft);
    if (!offset) return this.track.clientWidth;

    if (this.stepMode === 'page') {
      return Math.max(1, Math.floor(this.track.clientWidth / offset)) * offset;
    }

    return offset;
  }

  update() {
    const max = this.maxScroll;
    const isStatic = max < 2;

    this.classList.toggle('is-static', isStatic);

    if (this.prevButton) this.prevButton.toggleAttribute('disabled', isStatic || this.position <= 1);
    if (this.nextButton) this.nextButton.toggleAttribute('disabled', isStatic || this.position >= max - 1);

    if (!this.progressThumb) return;

    const ratio = isStatic ? 0 : this.position / max;
    const thumb = isStatic ? 1 : Math.max(this.track.clientWidth / this.track.scrollWidth, 0.1);

    this.progressThumb.style.setProperty('--cl-progress-w', `${thumb * 100}%`);
    this.progressThumb.style.setProperty('--cl-progress-x', `${ratio * (1 - thumb) * 100}%`);
  }
}

if (!customElements.get('cl-deals-slider')) {
  customElements.define('cl-deals-slider', ClDealsSlider);
}
