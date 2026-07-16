<script lang="ts">
import { type Pattern, render, toSeed } from "ribbit";

// A field of deterministic marks that grows as you scroll. Each tile is a
// static render of a seed; hover brings a single tile to life. Motion is never
// required to see a tile, and it is suppressed under reduced-motion.

const WORDS = [
	"croak", "ribbit", "frogspawn", "lily", "pond", "hop", "null-frog",
	"tadpole", "marsh", "reed", "dusk", "moss", "spore", "newt", "bog",
	"fen", "murk", "glint", "ripple", "silt", "algae", "heron", "dragonfly",
	"cattail", "brook", "mire", "peat", "willow", "dew", "fern", "sedge",
	"nixie", "wisp", "gloam", "brack",
];
const PATTERNS: Pattern[] = ["dither", "glyph", "wave"];
const BATCH = 12;
// ponytail: hard cap so the "infinite" scroll cannot leak canvases forever.
const MAX = 240;

interface Tile {
	seed: string;
	pattern: Pattern;
}

function tileAt(i: number): Tile {
	const word = WORDS[i % WORDS.length];
	const cycle = Math.floor(i / WORDS.length);
	return {
		seed: cycle === 0 ? word : `${word}-${cycle}`,
		pattern: PATTERNS[i % PATTERNS.length],
	};
}

let count = $state(BATCH * 2);
let tiles = $derived(Array.from({ length: count }, (_, i) => tileAt(i)));
let sentinel: HTMLDivElement;

$effect(() => {
	if (!sentinel) return;
	const io = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting && count < MAX) {
				count = Math.min(MAX, count + BATCH);
			}
		},
		{ rootMargin: "600px" },
	);
	io.observe(sentinel);
	return () => io.disconnect();
});

// Canvas action: paint one static frame, and animate only while hovered.
function mark(node: HTMLCanvasElement, tile: Tile) {
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let raf = 0;
	let start = 0;

	const paint = (t: number) => {
		const css = node.clientWidth || 120;
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		node.width = Math.round(css * dpr);
		node.height = Math.round(css * dpr);
		const ctx = node.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		render(ctx, toSeed(tile.seed), { size: css, pattern: tile.pattern, t });
	};

	// Static first frame, once layout is known.
	requestAnimationFrame(() => paint(0));

	if (reduce) {
		return { destroy() {} };
	}

	const loop = (now: number) => {
		if (!start) start = now;
		paint((now - start) / 1000);
		raf = requestAnimationFrame(loop);
	};
	const enter = () => {
		if (!raf) {
			start = 0;
			raf = requestAnimationFrame(loop);
		}
	};
	const leave = () => {
		cancelAnimationFrame(raf);
		raf = 0;
		paint(0);
	};
	node.addEventListener("pointerenter", enter);
	node.addEventListener("pointerleave", leave);

	return {
		destroy() {
			cancelAnimationFrame(raf);
			node.removeEventListener("pointerenter", enter);
			node.removeEventListener("pointerleave", leave);
		},
	};
}
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
	{#each tiles as tile (tile.seed)}
		<figure class="group">
			<canvas
				use:mark={tile}
				class="aspect-square w-full rounded-card border border-line transition-colors group-hover:border-line-strong"
				style="background:#0a0d0b"
				aria-label="Generative mark for the seed {tile.seed}"
			></canvas>
			<figcaption class="mono mt-2 truncate text-xs text-faint transition-colors group-hover:text-muted">{tile.seed}</figcaption>
		</figure>
	{/each}
</div>
<div bind:this={sentinel} class="h-px w-full" aria-hidden="true"></div>
{#if count >= MAX}
	<p class="mono mt-8 text-center text-xs text-faint">Showing {MAX} marks. The seed space is unbounded.</p>
{/if}
