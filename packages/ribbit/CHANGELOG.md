# Changelog

All notable changes to `ribbit-canvas`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-26

### Added

- `renderReactive(target, seed, options?)` renders a mark whose cells react to a
  `pointer`. The glow is folded into the field before it is quantized, so cells
  climb the tonal ramp instead of getting an overlay, and the seed's geometry
  never moves. `glowRadius` and `glowBoost` tune reach and lift.
- `reactive` prop on the React and Svelte adapters, wiring the same effect to
  the pointer. Ignored on touch, under `prefers-reduced-motion`, and for `wave`.
- `field(seed)` exposes the deterministic scalar field behind every pattern, for
  callers who want to build their own painters on the same geometry.
- Light variants of every built-in palette: `mossLight`, `tideLight`,
  `emberLight` and `monoLight`.
- `palette.background` accepts `null` to leave the backdrop transparent. Canvas
  keeps what is behind it, `toSVG` omits its backing rect, and PNG/WebM keep the
  alpha channel unless `matte` says otherwise.

### Fixed

- Published sourcemaps resolve again. The build emitted `sourceMap` and
  `declarationMap` pointing at `../src`, but `src` was missing from the package
  files, so consumers hit "Sourcemap points to missing source files".

### Notes

- With no `pointer`, `renderReactive` is exactly `render`, so marks at rest and
  every static export are byte-for-byte what earlier versions produced.

## [1.0.2] - 2026-07-19

### Fixed

- Canvas and SVG backends no longer drift apart: dither cells share the same
  overdraw and glyph baselines match across both.
- Seeds hash their full codepoints, so distinct emoji no longer collide on the
  lead surrogate.
- Unknown patterns, non-positive dimensions and ramps with fewer than two tones
  now throw a descriptive error instead of silently falling back.

## [1.0.1] - 2026-07-18

### Fixed

- Package metadata: author handle and repository URL, needed for npm trusted
  publishing with provenance.

## [1.0.0] - 2026-07-17

### Added

- Deterministic marks from any string or number, in three patterns: `dither`,
  `glyph` and `wave`.
- Framework-agnostic core: `render` accepts a canvas element, an
  `OffscreenCanvas` or either 2D context, with no DOM-specific types.
- Exports: `toSVG`, `toDataURL`, `toBlob` and `toWebM`, with `og` and `avatar`
  presets and a truly transparent circular crop.
- React and Svelte adapters (`RibbitAvatar`), both optional peer dependencies.
- Built-in palettes: moss, tide, ember and mono.

[1.1.0]: https://github.com/Sn4pe/ribbit/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/Sn4pe/ribbit/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Sn4pe/ribbit/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Sn4pe/ribbit/releases/tag/v1.0.0
