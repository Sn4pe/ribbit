# ribbit

[![npm version](https://img.shields.io/npm/v/ribbit-canvas.svg)](https://www.npmjs.com/package/ribbit-canvas)
[![CI](https://github.com/Sn4pe/ribbit/actions/workflows/ci.yml/badge.svg)](https://github.com/Sn4pe/ribbit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Sn4pe/ribbit.svg?style=flat)](https://github.com/Sn4pe/ribbit/stargazers)

Turn any seed into deterministic generative art on a canvas. One string in, the same mark
out, every time. Framework-agnostic core, zero runtime dependencies, tiny.

This is a monorepo:

- [`packages/ribbit`](packages/ribbit) — the published package (`ribbit-canvas` on npm),
  with React and Svelte adapters. See its [README](packages/ribbit/README.md) for the API.
- [`apps/site`](apps/site) — the docs/playground site.

```sh
bun add ribbit-canvas
```

## Development

```sh
bun install
bun run test    # packages/ribbit
bun run check   # biome, all workspaces
bun run build   # package + site
bun run dev     # site dev server
```
