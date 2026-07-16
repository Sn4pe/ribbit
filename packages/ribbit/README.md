# ribbit

Turn any seed into deterministic generative art on a canvas. One string in, the
same mark out, every time. Framework-agnostic core, zero runtime dependencies,
tiny.

```sh
bun add ribbit
```

## Core

```ts
import { render, toBlob, toSVG } from "ribbit";

// Paint onto a canvas element (or an existing 2D context).
render(canvas, "null-frog", { size: 256, pattern: "wave" });

// t is time. 0 is a static frame, advancing it evolves the field.
render(ctx, 42, { pattern: "dither", t: performance.now() / 1000 });

// Static exports.
const svg = toSVG("ribbit", { pattern: "glyph", preset: "avatar", size: 128 });
const png = await toBlob("ribbit", { preset: "og" }); // 1200x630 Blob
```

### API

- `seedFromString(s)` and `toSeed(input)` normalize a string or number to a uint32 seed.
- `render(target, seed, options?)` where `target` is a canvas or a 2D context.
- `drawDither(ctx, seed, size, t?)`, `drawGlyph(...)`, `drawWave(...)` draw one pattern.
- `toDataURL(seed, options?)` and `toBlob(seed, options?)` produce a PNG.
- `toSVG(seed, options?)` produces a standalone SVG string.
- `RAMP` and `BG` are the palette.

`options`: `{ size?, pattern?: "dither" | "glyph" | "wave", t? }`. Export helpers
also take `preset?: "og" | "avatar"`.

## Svelte

`svelte` is an optional peer dependency.

```svelte
<script>
  import Ribbit from "ribbit/svelte";
</script>

<Ribbit seed="null-frog" size={64} pattern="dither" radius="50%" animated />
```

Renders one static frame on mount, so the mark is always visible. `animated`
runs a `requestAnimationFrame` loop that is paused when offscreen and forced
static under `prefers-reduced-motion`. Device pixel ratio is capped at 1.5.

## License

MIT (c) Null-Frog
