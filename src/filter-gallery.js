/**
 * Filter gallery with FLIP-style reflow.
 *
 * When a filter changes:
 *   - cards that stay glide from their old position to their new one,
 *   - cards that leave fade and shrink out where they were,
 *   - cards that arrive fade and grow in,
 *   - the wrapper's height eases between the old and new layouts,
 *     so the page below never jumps.
 *
 * Clicking again mid-animation settles the current animation immediately,
 * so the gallery never ends up half-moved. Reduced-motion users get an instant switch.
 *
 * Markup contract:
 *   [data-filter-gallery]  root element
 *   [data-filter]          filter buttons (value = tag, or "all")
 *   [data-fg-wrap]         wrapper that clips the grid and animates its height
 *   [data-fg-grid]         list of items; each item has a data-tag attribute
 *   [data-fg-status]       optional polite live region for the visible count
 */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const LAYOUT_PROPS = ['position', 'left', 'top', 'width', 'height'];

export function initFilterGallery(root, options = {}) {
  const timing = { exitMs: 280, moveMs: 550, enterMs: 450, ...options };

  const wrap = root.querySelector('[data-fg-wrap]');
  const grid = root.querySelector('[data-fg-grid]');
  const buttons = [...root.querySelectorAll('[data-filter]')];
  const status = root.querySelector('[data-fg-status]');
  const items = [...grid.children];

  let animations = [];
  let currentRun = null;

  /** Ends any running animation at once and restores the resting state. */
  function settle() {
    animations.forEach(animation => animation.cancel());
    animations = [];
    items.forEach(item => {
      item.classList.remove('is-exiting');
      LAYOUT_PROPS.forEach(prop => item.style.removeProperty(prop));
    });
    wrap.style.removeProperty('height');
    currentRun = null;
  }

  function applyFilter(filter) {
    settle();

    buttons.forEach(button => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const matches = item => filter === 'all' || item.dataset.tag === filter;
    if (status) {
      const count = items.filter(matches).length;
      status.textContent = `Showing ${count} of ${items.length} projects`;
    }

    if (reduceMotion.matches || !grid.animate) {
      items.forEach(item => { item.hidden = !matches(item); });
      return;
    }

    // FIRST: record where every visible item is now
    const gridBox = grid.getBoundingClientRect();
    const first = new Map(
      items.filter(item => !item.hidden).map(item => [item, item.getBoundingClientRect()])
    );
    const firstHeight = wrap.getBoundingClientRect().height;
    wrap.style.height = `${firstHeight}px`; // hold the old height while the layout changes

    // LAST: apply the new visibility and sort items into groups
    const leaving = [];
    const staying = [];
    const entering = [];
    items.forEach(item => {
      const wasVisible = first.has(item);
      const isVisible = matches(item);
      if (wasVisible && !isVisible) leaving.push(item);
      else if (wasVisible && isVisible) staying.push(item);
      else if (!wasVisible && isVisible) entering.push(item);
      item.hidden = !isVisible;
    });

    // Leaving items stay on screen, pinned to where they were, while they fade out
    leaving.forEach(item => {
      const box = first.get(item);
      item.classList.add('is-exiting');
      Object.assign(item.style, {
        left: `${box.left - gridBox.left}px`,
        top: `${box.top - gridBox.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`
      });
    });

    // Measure the new layout (leaving items are already out of the flow)
    const gridAfter = grid.getBoundingClientRect();
    const run = {};
    currentRun = run;

    staying.forEach((item, i) => {
      const before = first.get(item);
      const after = item.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (!dx && !dy) return;
      animations.push(item.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: timing.moveMs, easing: EASE, delay: Math.min(i * 18, 180) }
      ));
    });

    leaving.forEach((item, i) => {
      animations.push(item.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.9)' }],
        { duration: timing.exitMs, easing: 'ease-out', delay: Math.min(i * 25, 250), fill: 'both' }
      ));
    });

    entering.forEach((item, i) => {
      animations.push(item.animate(
        [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: timing.enterMs, easing: EASE, delay: 200 + Math.min(i * 40, 320), fill: 'both' }
      ));
    });

    const newHeight = gridAfter.height;
    if (newHeight !== firstHeight) {
      // fill: 'forwards' holds the new height until the run finishes. Without it, the wrapper
      // snaps back to the pinned old height when this short animation ends, clipping the new rows.
      animations.push(wrap.animate(
        [{ height: `${firstHeight}px` }, { height: `${newHeight}px` }],
        { duration: timing.moveMs, easing: EASE, fill: 'forwards' }
      ));
    }

    if (!animations.length) { settle(); return; }

    // Tidy up once everything has finished (unless another click has already taken over)
    Promise.all(animations.map(a => a.finished.catch(() => {}))).then(() => {
      if (currentRun === run) settle();
    });
  }

  const onButtonClick = event => applyFilter(event.currentTarget.dataset.filter);
  buttons.forEach(button => button.addEventListener('click', onButtonClick));
  window.addEventListener('resize', settle);

  return {
    /** Programmatically switch to a filter (e.g. from a link or a URL parameter). */
    apply: applyFilter,
    /** Removes listeners and stops any running animation. */
    destroy() {
      settle();
      buttons.forEach(button => button.removeEventListener('click', onButtonClick));
      window.removeEventListener('resize', settle);
    }
  };
}
