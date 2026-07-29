/* Colourway swatches — keep the selected size when switching colour (Dawn port).
   Each swatch link carries data-sizes='{"41":123,"42":124}' (available variants of
   that sibling). When the shopper picks a size we point every swatch at the matching
   ?variant= so the size survives the jump to the sibling product.

   Dawn wiring: reads the current size from <variant-selects> — the checked radio /
   swatch input, or the <select> value, of the option whose label matches /size/. */
(function () {
  var SIZE_RE = /size|größe/i;

  function currentSize() {
    var root = document.querySelector('variant-selects');
    if (!root) return '';
    var groups = root.querySelectorAll('.product-form__input, fieldset');
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var label = g.querySelector('legend, .form__label, label');
      var name = label ? label.textContent : '';
      if (!SIZE_RE.test(name)) continue;
      var checked = g.querySelector('input[type="radio"]:checked');
      if (checked) return (checked.value || '').trim();
      var sel = g.querySelector('select');
      if (sel) return (sel.value || '').trim();
    }
    return '';
  }

  function sync() {
    var size = currentSize();
    var links = document.querySelectorAll('.t4s-cg__item[data-sizes]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var base = a.getAttribute('data-url');
      if (!base) continue;
      var map;
      try { map = JSON.parse(a.getAttribute('data-sizes')); } catch (e) { continue; }
      a.setAttribute('href', size && map[size] ? base + '?variant=' + map[size] : base);
    }
  }

  // Dawn dispatches 'change' on the variant inputs/select when the shopper picks a size.
  document.addEventListener('change', function (e) {
    if (e.target && e.target.closest && e.target.closest('variant-selects')) {
      setTimeout(sync, 0);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }
})();
