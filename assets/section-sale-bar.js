/* Sale bar countdown — Taal Store PDP
   Reads data-end ("YYYY-MM-DD HH:MM", real sale end) or data-loop (seconds, repeating).
   data-end wins when both are set. */
(function () {
  if (customElements.get('sale-bar')) return;

  class SaleBar extends HTMLElement {
    connectedCallback() {
      this.elH = this.querySelector('[data-h]');
      this.elM = this.querySelector('[data-m]');
      this.elS = this.querySelector('[data-s]');
      this.loop = parseInt(this.dataset.loop || '0', 10);
      this.hideEnded = this.dataset.hideEnded === 'true';

      var end = (this.dataset.end || '').trim();
      this.target = end ? new Date(end.replace(' ', 'T')).getTime() : 0;
      if ((!this.target || isNaN(this.target)) && this.loop > 0) {
        this.target = Date.now() + this.loop * 1000;
      }
      if (!this.target || isNaN(this.target)) return; // nothing valid to count

      this._tick = this.tick.bind(this);
      this.tick();
      this.timer = setInterval(this._tick, 1000);
    }

    tick() {
      var diff = Math.floor((this.target - Date.now()) / 1000);
      if (diff <= 0) {
        if (this.loop > 0) {
          this.target = Date.now() + this.loop * 1000;
          diff = this.loop;
        } else {
          return this.finish();
        }
      }
      var h = Math.floor(diff / 3600);
      var m = Math.floor((diff % 3600) / 60);
      var s = diff % 60;
      if (this.elH) this.elH.textContent = this.pad(h);
      if (this.elM) this.elM.textContent = this.pad(m);
      if (this.elS) this.elS.textContent = this.pad(s);
    }

    pad(n) { return n < 10 ? '0' + n : '' + n; }

    finish() {
      clearInterval(this.timer);
      if (this.elH) this.elH.textContent = '00';
      if (this.elM) this.elM.textContent = '00';
      if (this.elS) this.elS.textContent = '00';
      if (this.hideEnded) {
        var bar = this.closest('[data-sale-bar]');
        if (bar) bar.style.display = 'none';
      }
    }

    disconnectedCallback() { clearInterval(this.timer); }
  }

  customElements.define('sale-bar', SaleBar);
})();
