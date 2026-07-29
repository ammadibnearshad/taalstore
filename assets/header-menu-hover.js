/**
 * Opens top-level header menus (dropdown + mega) on hover.
 *
 * Deliberately does NOT intercept the summary click: the native <details>
 * toggle stays authoritative, so Dawn's own aria-expanded sync in global.js,
 * the Escape handler, and HeaderMenu.onToggle (sticky-header preventHide +
 * --header-bottom-position-desktop) all keep working untouched.
 *
 * Only runs on fine-pointer devices at desktop width. Touch and coarse
 * pointers fall through to Dawn's stock click behaviour.
 */
(function () {
  if (document.documentElement.dataset.headerMenuHover === 'bound') return;
  document.documentElement.dataset.headerMenuHover = 'bound';

  const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');
  const desktop = window.matchMedia('(min-width: 990px)');

  const OPEN_DELAY = 100; // ignores menus swept past on the way to another one
  const CLOSE_DELAY = 200; // covers the gap between the links and the mega panel

  let active = null; // menu currently held open by hover
  let suppressed = null; // menu closed by click/Escape; stays shut until the pointer leaves
  let openTimer = null;
  let closeTimer = null;

  const isEnabled = () => hoverCapable.matches && desktop.matches;

  const detailsOf = (menu) => menu.querySelector(':scope > details');

  function setOpen(menu, open) {
    const details = detailsOf(menu);
    if (!details || details.open === open) return;

    // Setting the property fires `toggle`, which is what HeaderMenu listens for.
    details.open = open;

    const summary = details.querySelector(':scope > summary');
    if (summary) summary.setAttribute('aria-expanded', String(open));
  }

  function closeOthers(except) {
    document.querySelectorAll('header-menu').forEach((menu) => {
      if (menu !== except) setOpen(menu, false);
    });
  }

  function menuFromEvent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const menu = target.closest('header-menu');
    // The drawer has its own controller; never touch menus rendered inside it.
    if (!menu || menu.closest('.menu-drawer')) return null;
    return menu;
  }

  document.addEventListener('mouseover', (event) => {
    if (!isEnabled()) return;

    const menu = menuFromEvent(event);
    if (!menu || menu === suppressed) return;

    if (menu === active) {
      clearTimeout(closeTimer);
      return;
    }

    clearTimeout(openTimer);
    clearTimeout(closeTimer);

    // Switching between menus should feel instant; the first open gets an intent delay.
    const delay = active ? 0 : OPEN_DELAY;

    openTimer = setTimeout(() => {
      closeOthers(menu);
      setOpen(menu, true);
      active = menu;
    }, delay);
  });

  document.addEventListener('mouseout', (event) => {
    if (!isEnabled()) return;

    const to = event.relatedTarget;
    const leaving = (node) => !(to instanceof Node) || !node.contains(to);

    if (suppressed && leaving(suppressed)) suppressed = null;
    if (!active || !leaving(active)) return;

    clearTimeout(openTimer);
    clearTimeout(closeTimer);

    closeTimer = setTimeout(() => {
      if (active) setOpen(active, false);
      active = null;
    }, CLOSE_DELAY);
  });

  // Keep hover state in step with a deliberate click on the summary.
  document.addEventListener('click', (event) => {
    if (!isEnabled()) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const summary = target.closest('header-menu > details > summary');
    if (!summary) return;

    const details = summary.parentElement;
    const menu = summary.closest('header-menu');

    // Read after the browser has applied its own toggle.
    requestAnimationFrame(() => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);

      if (details.open) {
        closeOthers(menu);
        active = menu;
        suppressed = null;
      } else {
        active = null;
        suppressed = menu;
      }
    });
  });

  // Dawn's onKeyUpEscape closes the menu for us — just stop hover from reopening it.
  document.addEventListener('keyup', (event) => {
    if (event.key !== 'Escape' || !active) return;
    suppressed = active;
    active = null;
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  });

  // Leaving the document entirely (e.g. to the browser chrome) closes immediately.
  document.addEventListener('mouseleave', () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    if (active) setOpen(active, false);
    active = null;
    suppressed = null;
  });

  desktop.addEventListener('change', () => {
    if (desktop.matches) return;
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    if (active) setOpen(active, false);
    active = null;
    suppressed = null;
  });
})();
