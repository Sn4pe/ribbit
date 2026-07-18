![ribbit](https://raw.githubusercontent.com/Sn4pe/ribbit/main/banner.svg)

# ribbit

[![npm version](https://img.shields.io/npm/v/ribbit-canvas.svg)](https://www.npmjs.com/package/ribbit-canvas)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![zero deps](https://img.shields.io/badge/dependencies-zero-blue.svg)](https://github.com/Sn4pe/ribbit)

Turn any seed into deterministic generative art on a canvas. One string in, the
same mark out, every time. Framework-agnostic core, zero runtime dependencies,
tiny.

```sh
bun add ribbit-canvas
```

![sample marks: wave, glyph and dither patterns across different seeds](https://raw.githubusercontent.com/Sn4pe/ribbit/main/samples.svg)

## Core

```ts
import { PALETTES, render, toBlob, toSVG, toWebM } from "ribbit-canvas";

// Paint onto a canvas element (or an existing 2D context).
render(canvas, "null-frog", { size: 256, pattern: "wave" });

// Built-in or fully custom palettes work in Canvas, PNG and SVG.
render(canvas, "null-frog", {
  size: 256,
  pattern: "wave",
  palette: PALETTES.tide,
});

// Any aspect ratio, plus a true transparent circular crop.
render(wideCanvas, "null-frog", { width: 640, height: 360, pattern: "glyph" });
const avatar = await toBlob("ribbit", {
  preset: "avatar",
  size: 256,
  shape: "circle",
});

// t is time. 0 is a static frame, advancing it evolves the field.
render(ctx, 42, { pattern: "dither", t: performance.now() / 1000 });

// Static exports.
const svg = toSVG("ribbit", { pattern: "glyph", preset: "avatar", size: 128 });
const png = await toBlob("ribbit", { preset: "og" }); // 1200x630 Blob
const webm = await toWebM("ribbit", {
  preset: "og",
  pattern: "wave",
  duration: 5,
  fps: 30,
}); // animated WebM Blob, recorded in real time
```

### API

- `seedFromString(s)` and `toSeed(input)` normalize a string or number to a uint32 seed.
- `render(target, seed, options?)` where `target` is a canvas or a 2D context.
- `drawDither(ctx, seed, size, t?, palette?)`, `drawGlyph(...)`, `drawWave(...)` draw one pattern.
- `toDataURL(seed, options?)` and `toBlob(seed, options?)` produce a PNG.
- `toWebM(seed, options?)` records an animated WebM in the browser.
- `toSVG(seed, options?)` produces a standalone SVG string.
- `PALETTES` provides moss, tide, ember and mono; `RAMP` and `BG` alias moss.

`options`: `{ size?, width?, height?, pattern?, shape?, palette?, t? }`.
Export helpers also take `preset?: "og" | "avatar"`; OG is always 1200x630.

## Framework adapters

The renderer is framework-agnostic. The optional adapters make the common
avatar case a one-line component; `radius` controls display clipping, while
the core's `shape: "circle"` is reserved for exports with transparent corners.

### React

`react >= 18` is an optional peer dependency.

```tsx
import { RibbitAvatar } from "ribbit-canvas/react";

<RibbitAvatar seed={user.id} size={40} />
<RibbitAvatar seed="null-frog" size={96} radius={16} pattern="wave" />
```

### Svelte

`svelte` is an optional peer dependency.

```svelte
<script>
  import RibbitAvatar from "ribbit-canvas/svelte";
</script>

<RibbitAvatar seed="null-frog" size={64} pattern="dither" animated />
```

Renders one static frame on mount, so the mark is always visible. `animated`
runs a `requestAnimationFrame` loop that is paused when offscreen and forced
static under `prefers-reduced-motion`. Device pixel ratio is capped at 1.5.
