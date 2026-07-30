if (!customElements.get('footer-menu-accordion')) {
  customElements.define(
    'footer-menu-accordion',
    class FooterMenuAccordion extends HTMLElement {
      constructor() {
        super();
        this.toggle = this.querySelector('.footer-block__accordion-toggle');
        this.panel = this.querySelector('.footer-block__accordion-panel');
        this.mediaQuery = window.matchMedia('(max-width: 749px)');
        this.onToggleClick = this.onToggleClick.bind(this);
        this.onBreakpointChange = this.onBreakpointChange.bind(this);
      }

      connectedCallback() {
        if (!this.toggle || !this.panel) return;

        this.toggle.addEventListener('click', this.onToggleClick);
        this.mediaQuery.addEventListener('change', this.onBreakpointChange);
        this.onBreakpointChange();
      }

      disconnectedCallback() {
        if (this.toggle) this.toggle.removeEventListener('click', this.onToggleClick);
        this.mediaQuery.removeEventListener('change', this.onBreakpointChange);
      }

      onBreakpointChange() {
        if (this.mediaQuery.matches) {
          this.setAttribute('data-collapsible', '');
          this.setExpanded(this.hasAttribute('data-open'));
        } else {
          this.removeAttribute('data-collapsible');
          this.toggle.setAttribute('aria-expanded', 'true');
        }
      }

      onToggleClick() {
        this.setExpanded(this.toggle.getAttribute('aria-expanded') !== 'true');
      }

      setExpanded(expanded) {
        this.toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        this.toggleAttribute('data-open', expanded);
      }
    }
  );
}
