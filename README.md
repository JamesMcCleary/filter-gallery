# Filter Gallery with Animated Reflow

A dependency-free filterable gallery. When a filter changes, cards glide into their new positions, cards that leave fade out in place, and new cards grow in. The page below never jumps while it happens.

**Live demo:** https://jamesmccleary.github.io/filter-gallery/
**Used on:** https://jamesmccleary.com/portfolio/ (the same technique, with the portfolio's own styling)

![Filter gallery demo](docs/demo.gif)

<!-- Add docs/demo.gif: record a 5 to 8 second clip of a filter change (for example with Kap on macOS or ScreenToGif on Windows), export as GIF under 5 MB, and save it as docs/demo.gif. -->

## The UX problem

Filtering usually swaps the whole grid at once. The page jumps, the visitor loses their place, and it is hard to tell which items were added, removed or kept. This component makes the change readable: items that stay visibly move, items that leave visibly go, and items that arrive visibly appear. The visitor can follow what changed without re-scanning the grid.

## Key design decisions

**Interaction**
- Clicking a filter again mid-animation settles the current motion immediately, so rapid clicking never leaves cards half-moved or stuck at partial opacity.
- Filter buttons use `aria-pressed`, so the active filter is announced to screen readers and shown visually.

**Motion**
- Three groups of motion, each with its own timing: movers glide (550 ms), leavers fade and shrink (280 ms), arrivals fade and grow (450 ms).
- Stagger is capped, so a grid of 30 items does not take 3 seconds to settle.
- Easing is `cubic-bezier(0.22, 1, 0.36, 1)`, a fast start with a soft landing.

**Responsive behavior**
- The grid moves from 3 columns to 2 at 900 px and to 1 column at 560 px.
- Positions are measured in the grid's own coordinate space, so page scrolling does not affect the animation.
- A resize cancels the animation and settles the layout.

**Accessibility**
- Filters are real `<button>` elements with a visible focus ring.
- A polite live region announces "Showing 3 of 9 projects" after each change.
- `prefers-reduced-motion` switches instantly, with no animation at all.

## How it is built

This is a FLIP animation (First, Last, Invert, Play), using the Web Animations API:

1. **First.** Measure where every visible card is now. Hold the wrapper at its current height so the page does not jump.
2. **Last.** Apply the new filter, then measure where the remaining cards are.
3. **Invert.** For each card that stays, compute the offset from its old position to its new one, then animate from that offset back to zero. Cards that leave are pinned to their old coordinates with `position: absolute`, so the rest of the grid can reflow while they fade.
4. **Play.** Run the animations, and animate the wrapper's height between the old and new layouts.

Notable techniques:
- **No layout thrash.** All reads happen before writes, so the browser computes layout once per change.
- **Cancellation.** Every run is tracked, so `settle()` can end the current animation and restore the resting state in one step.
- **No libraries.** The Web Animations API is supported in all current browsers.

## Using it in your own project

```html
<link rel="stylesheet" href="src/filter-gallery.css">

<section class="fg" data-filter-gallery>
  <div class="fg-filters" role="group" aria-label="Filter projects">
    <button class="fg-filter is-active" type="button" data-filter="all" aria-pressed="true">All</button>
    <button class="fg-filter" type="button" data-filter="product" aria-pressed="false">Product</button>
  </div>
  <div class="fg-wrap" data-fg-wrap>
    <ul class="fg-grid" data-fg-grid>
      <li class="fg-item" data-tag="product"> ... your card ... </li>
    </ul>
  </div>
  <p class="fg-status" data-fg-status aria-live="polite"></p>
</section>

<script type="module">
  import { initFilterGallery } from './src/filter-gallery.js';
  initFilterGallery(document.querySelector('[data-filter-gallery]'));
</script>
```

Set the `--fg-*` custom properties on `.fg` to match your palette. Use `data-tag` on each item to match the button's `data-filter` value. Pass `{ exitMs, moveMs, enterMs }` as a second argument to change the timings.

## Files

| Path | Purpose |
|---|---|
| `src/filter-gallery.js` | The component: one exported function, about 150 lines |
| `src/filter-gallery.css` | Layout, card styles, and theme tokens |
| `index.html` | A standalone demo page |

## Browser support

Current Chrome, Edge, Firefox and Safari. Browsers without the Web Animations API switch filters instantly.

## License

MIT. See `LICENSE`.
