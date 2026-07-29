/* Accordion for the "Columns + promo images" mega menu inside the mobile drawer.

   Not <details>/<summary>: Dawn's MenuDrawer (global.js) binds a click handler to
   every summary in the drawer and focus-traps its next sibling — behaviour meant
   for the sliding second-level panels, which would fight an in-place accordion.

   The open/close animation is CSS (grid-template-rows 0fr -> 1fr); this only
   flips the state class and aria-expanded. */

class DrawerAccordion extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('.menu-drawer__group-toggle');
    this.panel = this.querySelector('.menu-drawer__group-panel');
    if (!this.button || !this.panel) return;

    this.onClick = this.handleClick.bind(this);
    this.button.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    if (this.button && this.onClick) this.button.removeEventListener('click', this.onClick);
  }

  get isOpen() {
    return this.classList.contains('is-open');
  }

  handleClick(event) {
    event.preventDefault();
    this.toggle(!this.isOpen);
  }

  toggle(open) {
    this.classList.toggle('is-open', open);
    this.button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

if (!customElements.get('drawer-accordion')) {
  customElements.define('drawer-accordion', DrawerAccordion);
}
