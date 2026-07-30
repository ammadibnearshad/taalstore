/* Review screenshots marquee — seamless marquee + story viewer */
(function () {
  'use strict';

  var HOLD_MS = 180;
  var SWIPE_PX = 45;

  class ReviewsMarquee extends HTMLElement {
    connectedCallback() {
      if (this.initialised) return;
      this.initialised = true;

      this.viewport = this.querySelector('[data-rm-viewport]');
      this.track = this.querySelector('[data-rm-track]');
      this.groups = Array.prototype.slice.call(this.querySelectorAll('[data-rm-group]'));
      this.viewer = this.querySelector('[data-rm-viewer]');
      if (!this.viewport || !this.track || !this.groups.length) return;

      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.pauseReasons = {};
      this.baseItems = this.groups.map(function (group) {
        return Array.prototype.slice.call(group.children);
      });

      // The duplicate set is decorative — keep it out of the tab order and the a11y tree.
      this.groups.slice(1).forEach(function (group) {
        Array.prototype.forEach.call(group.querySelectorAll('[data-rm-open]'), function (btn) {
          btn.setAttribute('tabindex', '-1');
        });
      });

      this.layout();
      this.classList.add('is-ready');

      this.bindMarquee();
      if (this.viewer) this.setupViewer();
    }

    disconnectedCallback() {
      if (this.viewer) this.close();
      if (this.viewer && this.viewer.parentNode === document.body) {
        document.body.removeChild(this.viewer);
      }
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.intersectionObserver) this.intersectionObserver.disconnect();
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('visibilitychange', this.onVisibility);
    }

    /* ---------- Marquee ---------- */

    // Duration is derived from the width of one set so the speed stays constant
    // whatever the item count is. The loop distance itself is CSS -50%, i.e. exact.
    layout() {
      if (this.reduceMotion) return;

      var viewportWidth = this.viewport.clientWidth;
      if (!viewportWidth) return;

      this.groups.forEach(this.resetGroup, this);

      var setWidth = this.groups[0].getBoundingClientRect().width;
      if (!setWidth) return;

      // A set narrower than the viewport would leave a visible gap at the seam.
      var copies = Math.ceil((viewportWidth * 1.15) / setWidth);
      if (copies > 1) {
        this.groups.forEach(function (group, i) {
          this.fillGroup(group, this.baseItems[i], copies - 1);
        }, this);
        setWidth = this.groups[0].getBoundingClientRect().width;
      }

      var speed = Math.max(5, parseFloat(this.dataset.speed) || 45);
      this.style.setProperty('--rm-dur', (setWidth / speed).toFixed(3) + 's');
      this.lastWidth = Math.round(viewportWidth);

      if (this.classList.contains('is-ready')) this.restartAnimation();
    }

    resetGroup(group, index) {
      var base = this.baseItems[index];
      Array.prototype.slice.call(group.children).forEach(function (child) {
        if (base.indexOf(child) === -1) group.removeChild(child);
      });
    }

    fillGroup(group, base, times) {
      var frag = document.createDocumentFragment();
      for (var n = 0; n < times; n++) {
        base.forEach(function (item) {
          var clone = item.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          Array.prototype.forEach.call(clone.querySelectorAll('[data-rm-open]'), function (btn) {
            btn.setAttribute('tabindex', '-1');
          });
          frag.appendChild(clone);
        });
      }
      group.appendChild(frag);
    }

    // Re-applying a duration mid-run would jump the track; restart the animation instead.
    restartAnimation() {
      this.track.style.animation = 'none';
      void this.track.offsetWidth;
      this.track.style.animation = '';
    }

    setPaused(reason, value) {
      if (value) {
        this.pauseReasons[reason] = true;
      } else {
        delete this.pauseReasons[reason];
      }
      this.classList.toggle('is-paused', Object.keys(this.pauseReasons).length > 0);
    }

    bindMarquee() {
      var self = this;

      if (this.dataset.pauseOnHover === 'true') {
        this.viewport.addEventListener('mouseenter', function () {
          self.setPaused('hover', true);
        });
        this.viewport.addEventListener('mouseleave', function () {
          self.setPaused('hover', false);
        });
      }

      // Touch has no hover — hold the strip still while a finger is down so the
      // card being tapped is the card that opens.
      this.viewport.addEventListener(
        'pointerdown',
        function (event) {
          if (event.pointerType === 'mouse') return;
          self.setPaused('touch', true);
        },
        { passive: true }
      );
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
        self.viewport.addEventListener(
          type,
          function () {
            self.setPaused('touch', false);
          },
          { passive: true }
        );
      });

      this.addEventListener('focusin', function () {
        self.setPaused('focus', true);
      });
      this.addEventListener('focusout', function () {
        self.setPaused('focus', false);
      });

      if ('IntersectionObserver' in window) {
        this.intersectionObserver = new IntersectionObserver(
          function (entries) {
            self.setPaused('offscreen', !entries[0].isIntersecting);
          },
          { rootMargin: '200px 0px' }
        );
        this.intersectionObserver.observe(this.viewport);
      }

      if ('ResizeObserver' in window) {
        this.resizeObserver = new ResizeObserver(function (entries) {
          var width = Math.round(entries[0].contentRect.width);
          if (width === self.lastWidth || !width) return;
          window.clearTimeout(self.resizeTimer);
          self.resizeTimer = window.setTimeout(function () {
            self.layout();
          }, 150);
        });
        this.resizeObserver.observe(this.viewport);
      }
    }

    /* ---------- Story viewer ---------- */

    setupViewer() {
      this.slides = Array.prototype.slice.call(this.viewer.querySelectorAll('[data-rm-slide]'));
      this.fills = Array.prototype.slice.call(this.viewer.querySelectorAll('[data-rm-fill]'));
      this.who = this.viewer.querySelector('[data-rm-who]');
      this.stage = this.viewer.querySelector('[data-rm-track-viewer]').parentNode;
      if (!this.slides.length) return;

      this.imageDuration = (parseFloat(this.dataset.imageDuration) || 7) * 1000;
      this.index = -1;
      this.viewerPaused = false;
      this.startedAt = 0;
      this.elapsed = 0;
      this.rafId = null;
      this.opener = null;

      this.buildTapZones();
      this.bindViewer();

      // Escape any ancestor transform/overflow that would clip a fixed overlay.
      document.body.appendChild(this.viewer);
    }

    buildTapZones() {
      var zones = [
        ['prev', 'Previous review', 'data-rm-prev'],
        ['next', 'Next review', 'data-rm-next']
      ];
      zones.forEach(function (zone) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rm-story__zone rm-story__zone--' + zone[0];
        btn.setAttribute('aria-label', zone[1]);
        btn.setAttribute(zone[2], '');
        this.stage.appendChild(btn);
      }, this);
    }

    bindViewer() {
      var self = this;

      // Delegated so cloned cards (added while filling the track) work too.
      this.viewport.addEventListener('click', function (event) {
        var card = event.target.closest('[data-rm-open]');
        if (!card) return;
        self.open(parseInt(card.dataset.index, 10) || 0, card);
      });

      this.viewer.addEventListener('click', function (event) {
        if (event.target.closest('[data-rm-close]')) return self.close();
        if (event.target.closest('[data-rm-prev]')) return self.go(-1);
        if (event.target.closest('[data-rm-next]')) return self.go(1);
      });

      // Hold to pause — a long press or a swipe must not also navigate.
      this.viewer.addEventListener('pointerdown', function (event) {
        if (event.target.closest('a, [data-rm-close]')) return;
        self.pointerStart = { x: event.clientX, y: event.clientY };
        self.holdTimer = window.setTimeout(function () {
          self.holding = true;
          self.pauseStory();
        }, HOLD_MS);
      });

      this.onPointerUp = function (event) {
        window.clearTimeout(self.holdTimer);

        if (self.holding) {
          self.holding = false;
          self.pointerStart = null;
          self.resumeStory();
          self.armSuppress();
          return;
        }

        if (!self.pointerStart) return;
        var dx = event.clientX - self.pointerStart.x;
        self.pointerStart = null;
        if (Math.abs(dx) > SWIPE_PX) {
          self.armSuppress();
          self.go(dx < 0 ? 1 : -1);
        }
      };
      this.viewer.addEventListener('pointerup', this.onPointerUp);
      this.viewer.addEventListener('pointercancel', this.onPointerUp);

      this.viewer.addEventListener(
        'click',
        function (event) {
          if (!self.suppressClick) return;
          self.suppressClick = false;
          event.stopPropagation();
          event.preventDefault();
        },
        true
      );

      this.onKeydown = function (event) {
        if (self.viewer.hidden) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          self.close();
        } else if (event.key === 'ArrowRight') {
          self.go(1);
        } else if (event.key === 'ArrowLeft') {
          self.go(-1);
        } else if (event.key === ' ' && !event.target.closest('a, button')) {
          event.preventDefault();
          self.viewerPaused ? self.resumeStory() : self.pauseStory();
        }
      };
      document.addEventListener('keydown', this.onKeydown);

      this.onVisibility = function () {
        if (self.viewer.hidden) return;
        document.hidden ? self.pauseStory() : self.resumeStory();
      };
      document.addEventListener('visibilitychange', this.onVisibility);
    }

    // Swallow exactly one click after a hold/swipe, and never leave the flag stuck.
    armSuppress() {
      var self = this;
      this.suppressClick = true;
      window.clearTimeout(this.suppressTimer);
      this.suppressTimer = window.setTimeout(function () {
        self.suppressClick = false;
      }, 300);
    }

    open(index, opener) {
      this.opener = opener || null;
      this.setPaused('viewer', true);
      this.viewer.hidden = false;
      document.body.classList.add('rm-story-open');
      window.requestAnimationFrame(
        function () {
          this.viewer.classList.add('is-open');
        }.bind(this)
      );
      this.show(index);
      var closeBtn = this.viewer.querySelector('[data-rm-close]');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    }

    close() {
      if (!this.viewer || this.viewer.hidden) return;
      this.stop();
      this.slides.forEach(function (slide) {
        slide.classList.remove('is-active');
      });
      this.viewer.classList.remove('is-open');
      this.viewer.hidden = true;
      this.index = -1;
      document.body.classList.remove('rm-story-open');
      this.setPaused('viewer', false);
      if (this.opener) {
        this.opener.focus({ preventScroll: true });
        this.opener = null;
      }
    }

    go(step) {
      var next = this.index + step;
      if (next < 0) return;
      if (next >= this.slides.length) return this.close();
      this.show(next);
    }

    show(index) {
      this.stop();

      this.slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === index);
      });

      this.index = index;
      this.viewerPaused = false;
      this.elapsed = 0;

      var slide = this.slides[index];
      this.fills.forEach(function (fill, i) {
        fill.style.transform = 'scaleX(' + (i < index ? 1 : 0) + ')';
      });
      if (this.who) this.who.textContent = slide.dataset.name || '';

      Array.prototype.forEach.call(this.viewer.querySelectorAll('.rm-story__nav--prev'), function (btn) {
        btn.disabled = index === 0;
      });

      this.preload(index);

      this.duration = (parseFloat(slide.dataset.duration) || 0) * 1000 || this.imageDuration;
      this.startedAt = performance.now();
      this.tick();
    }

    // Slides are display:none until active, so their lazy images have not been
    // fetched yet — promote the current one and its neighbours.
    preload(index) {
      for (var i = index - 1; i <= index + 1; i++) {
        var slide = this.slides[i];
        if (!slide) continue;
        var img = slide.querySelector('.rm-story__img');
        if (img && img.loading === 'lazy') img.loading = 'eager';
      }
    }

    tick() {
      var self = this;
      this.rafId = window.requestAnimationFrame(function (now) {
        if (self.viewerPaused || self.index < 0) return;

        var progress = (self.elapsed + (now - self.startedAt)) / self.duration;
        progress = Math.max(0, Math.min(1, progress));

        var fill = self.fills[self.index];
        if (fill) fill.style.transform = 'scaleX(' + progress + ')';

        if (progress >= 1) return self.go(1);
        self.tick();
      });
    }

    stop() {
      if (this.rafId) window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    pauseStory() {
      if (this.viewerPaused || this.index < 0) return;
      this.viewerPaused = true;
      this.elapsed += performance.now() - this.startedAt;
      this.stop();
    }

    resumeStory() {
      if (!this.viewerPaused || this.index < 0) return;
      this.viewerPaused = false;
      this.startedAt = performance.now();
      this.tick();
    }
  }

  if (!window.customElements.get('reviews-marquee')) {
    window.customElements.define('reviews-marquee', ReviewsMarquee);
  }
})();
