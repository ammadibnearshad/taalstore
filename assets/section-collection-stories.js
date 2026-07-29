/* Celebrity stories — bubble strip + fullscreen story viewer */
(function () {
  'use strict';

  var SEEN_KEY = 't4s:stories:seen';
  var HOLD_MS = 180;
  var SWIPE_PX = 45;

  function readSeen() {
    try {
      return JSON.parse(window.localStorage.getItem(SEEN_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function writeSeen(map) {
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(map));
    } catch (e) {
      /* private mode — ignore */
    }
  }

  class StoryReels extends HTMLElement {
    connectedCallback() {
      if (this.initialised) return;
      this.initialised = true;

      this.bubbles = Array.prototype.slice.call(this.querySelectorAll('[data-story-open]'));
      this.viewer = this.querySelector('[data-story-viewer]');
      if (!this.bubbles.length || !this.viewer) return;

      this.slides = Array.prototype.slice.call(this.viewer.querySelectorAll('[data-story-slide]'));
      this.fills = Array.prototype.slice.call(this.viewer.querySelectorAll('[data-story-fill]'));
      this.who = this.viewer.querySelector('[data-story-who]');
      this.soundBtn = this.viewer.querySelector('[data-story-sound]');
      this.stage = this.viewer.querySelector('[data-story-track]').parentNode;

      this.imageDuration = (parseFloat(this.dataset.imageDuration) || 5) * 1000;
      this.rememberSeen = this.dataset.rememberSeen === 'true';
      this.muted = this.dataset.startMuted !== 'false';

      this.index = -1;
      this.paused = false;
      this.startedAt = 0;
      this.elapsed = 0;
      this.rafId = null;
      this.opener = null;

      this.buildTapZones();
      this.bind();
      this.paintSeen();

      // Escape any ancestor transform/overflow that would clip a fixed overlay.
      document.body.appendChild(this.viewer);
    }

    disconnectedCallback() {
      this.close();
      if (this.viewer && this.viewer.parentNode === document.body) {
        document.body.removeChild(this.viewer);
      }
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('visibilitychange', this.onVisibility);
    }

    buildTapZones() {
      var prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 't4s-story-viewer__zone t4s-story-viewer__zone--prev';
      prev.setAttribute('aria-label', 'Previous story');
      prev.setAttribute('data-story-prev', '');

      var next = document.createElement('button');
      next.type = 'button';
      next.className = 't4s-story-viewer__zone t4s-story-viewer__zone--next';
      next.setAttribute('aria-label', 'Next story');
      next.setAttribute('data-story-next', '');

      this.stage.appendChild(prev);
      this.stage.appendChild(next);
    }

    bind() {
      var self = this;

      this.bubbles.forEach(function (bubble) {
        bubble.addEventListener('click', function () {
          self.open(parseInt(bubble.dataset.index, 10) || 0, bubble);
        });
      });

      this.onViewerClick = function (event) {
        if (event.target.closest('[data-story-close]')) return self.close();
        if (event.target.closest('[data-story-prev]')) return self.go(-1);
        if (event.target.closest('[data-story-next]')) return self.go(1);
        if (event.target.closest('[data-story-sound]')) return self.toggleSound();
      };
      this.viewer.addEventListener('click', this.onViewerClick);

      // Hold to pause — a long press should not also navigate.
      this.onPointerDown = function (event) {
        if (event.target.closest('a, [data-story-products], [data-story-sound], [data-story-close]')) return;
        self.pointerStart = { x: event.clientX, y: event.clientY, t: Date.now() };
        self.holdTimer = window.setTimeout(function () {
          self.holding = true;
          self.pause();
        }, HOLD_MS);
      };
      this.onPointerUp = function (event) {
        window.clearTimeout(self.holdTimer);

        // A hold (pause) or a swipe must not also fire the tap-zone click that follows.
        if (self.holding) {
          self.holding = false;
          self.pointerStart = null;
          self.resume();
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
      this.viewer.addEventListener('pointerdown', this.onPointerDown);
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
          self.paused ? self.resume() : self.pause();
        }
      };
      document.addEventListener('keydown', this.onKeydown);

      this.onVisibility = function () {
        if (self.viewer.hidden) return;
        document.hidden ? self.pause() : self.resume();
      };
      document.addEventListener('visibilitychange', this.onVisibility);

      this.slides.forEach(function (slide) {
        var video = slide.querySelector('[data-story-video]');
        if (!video) return;
        video.addEventListener('ended', function () {
          if (slide.classList.contains('is-active')) self.go(1);
        });
      });
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

    paintSeen() {
      if (!this.rememberSeen) return;
      var seen = readSeen();
      this.bubbles.forEach(function (bubble) {
        if (seen[bubble.dataset.key]) bubble.dataset.seen = '1';
      });
    }

    markSeen(index) {
      if (!this.rememberSeen) return;
      var bubble = this.bubbles[index];
      if (!bubble) return;
      bubble.dataset.seen = '1';
      var seen = readSeen();
      seen[bubble.dataset.key] = 1;
      writeSeen(seen);
    }

    open(index, opener) {
      this.opener = opener || null;
      this.viewer.hidden = false;
      document.body.classList.add('t4s-story-open');
      // Force a frame so the opacity transition runs.
      window.requestAnimationFrame(
        function () {
          this.viewer.classList.add('is-open');
        }.bind(this)
      );
      this.syncSound();
      this.show(index);
      var closeBtn = this.viewer.querySelector('[data-story-close]');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    }

    close() {
      if (!this.viewer || this.viewer.hidden) return;
      this.stop();
      this.slides.forEach(function (slide) {
        slide.classList.remove('is-active');
        var video = slide.querySelector('[data-story-video]');
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
      });
      this.viewer.classList.remove('is-open');
      this.viewer.hidden = true;
      this.index = -1;
      document.body.classList.remove('t4s-story-open');
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
      var self = this;
      this.stop();

      this.slides.forEach(function (slide, i) {
        var isActive = i === index;
        slide.classList.toggle('is-active', isActive);
        var video = slide.querySelector('[data-story-video]');
        if (video && !isActive) {
          video.pause();
          video.currentTime = 0;
        }
      });

      this.index = index;
      this.paused = false;
      this.elapsed = 0;
      this.markSeen(index);

      var slide = this.slides[index];
      this.fills.forEach(function (fill, i) {
        fill.style.transform = 'scaleX(' + (i < index ? 1 : 0) + ')';
      });
      if (this.who) this.who.textContent = slide.dataset.name || '';

      var prevBtns = this.viewer.querySelectorAll('.t4s-story-viewer__nav--prev');
      Array.prototype.forEach.call(prevBtns, function (btn) {
        btn.disabled = index === 0;
      });

      this.current = {
        el: slide,
        type: slide.dataset.type,
        video: slide.querySelector('[data-story-video]'),
        duration: (parseFloat(slide.dataset.duration) || 0) * 1000 || this.imageDuration
      };

      if (this.current.video) {
        var video = this.current.video;
        video.muted = this.muted;
        video.currentTime = 0;
        var play = video.play();
        if (play && typeof play.catch === 'function') {
          play.catch(function () {
            // Autoplay with sound was blocked — fall back to muted.
            video.muted = true;
            self.muted = true;
            self.syncSound();
            video.play().catch(function () {});
          });
        }
      }

      this.startedAt = performance.now();
      this.tick();
    }

    tick() {
      var self = this;
      this.rafId = window.requestAnimationFrame(function (now) {
        if (self.paused || !self.current) return;

        var progress;
        if (self.current.video) {
          var video = self.current.video;
          var total = video.duration;
          progress = total && isFinite(total) ? video.currentTime / total : 0;
        } else {
          progress = (self.elapsed + (now - self.startedAt)) / self.current.duration;
        }

        progress = Math.max(0, Math.min(1, progress));
        var fill = self.fills[self.index];
        if (fill) fill.style.transform = 'scaleX(' + progress + ')';

        if (progress >= 1 && !self.current.video) return self.go(1);
        self.tick();
      });
    }

    stop() {
      if (this.rafId) window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    pause() {
      if (this.paused || !this.current) return;
      this.paused = true;
      this.elapsed += performance.now() - this.startedAt;
      this.stop();
      if (this.current.video) this.current.video.pause();
    }

    resume() {
      if (!this.paused || !this.current) return;
      this.paused = false;
      this.startedAt = performance.now();
      if (this.current.video) this.current.video.play().catch(function () {});
      this.tick();
    }

    toggleSound() {
      this.muted = !this.muted;
      this.syncSound();
      if (this.current && this.current.video) {
        this.current.video.muted = this.muted;
        if (!this.muted) this.current.video.play().catch(function () {});
      }
    }

    syncSound() {
      if (!this.soundBtn) return;
      this.soundBtn.setAttribute('aria-pressed', String(!this.muted));
      this.soundBtn.setAttribute('aria-label', this.muted ? 'Unmute' : 'Mute');
    }
  }

  if (!window.customElements.get('t4s-story-reels')) {
    window.customElements.define('t4s-story-reels', StoryReels);
  }
})();
