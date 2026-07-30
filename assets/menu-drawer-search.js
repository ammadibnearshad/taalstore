/*
 * Wrapper for the search field that sits at the top of the mobile menu drawer.
 *
 * MenuDrawer (global.js) binds every <button> inside the drawer to its
 * "close the open submenu" handler:
 *
 *   this.querySelectorAll('button:not(.localization-selector)...')
 *     .forEach((button) => button.addEventListener('click', this.onCloseButtonClick...))
 *
 * The search field's submit and clear buttons are inside the drawer, so without
 * this a tap on either resolves `closest('details')` to the drawer's own
 * <details> and collapses the whole drawer.
 *
 * Stopping the click in the capture phase keeps it from ever reaching that
 * listener, while leaving the button's native submit/reset behaviour — and
 * therefore SearchForm / PredictiveSearch — untouched.
 */
if (!customElements.get('menu-drawer-search')) {
  customElements.define(
    'menu-drawer-search',
    class MenuDrawerSearch extends HTMLElement {
      constructor() {
        super();
        this.onCapturedClick = this.onCapturedClick.bind(this);
      }

      connectedCallback() {
        this.addEventListener('click', this.onCapturedClick, true);
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onCapturedClick, true);
      }

      onCapturedClick(event) {
        if (event.target.closest('button')) event.stopPropagation();
      }
    }
  );
}
