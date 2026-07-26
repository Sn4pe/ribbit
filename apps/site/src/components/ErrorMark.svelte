<script lang="ts">
import { PATTERNS, type Pattern, render, toSeed } from "ribbit-canvas";

const PALETTE = {
	background: "#16251a",
	ramp: ["#2f5738", "#4a8552", "#6cb46a", "#93d886", "#c2f2a8", "#e2ffd0"],
};

interface Props {
	/** Text cut out of the field, and the seed itself, e.g. "404". */
	code: string;
	/** Defaults to a random pattern per page load. */
	pattern?: Pattern;
}

let { code, pattern }: Props = $props();

const W = 1200;
const H = 630;

let current = $state<Pattern>(
	pattern ?? PATTERNS[Math.floor(Math.random() * PATTERNS.length)] ?? "glyph",
);
const FS = H * 0.8;
const svgMask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2 + FS * 0.36}" fill="#fff" font-family="ui-monospace,monospace" font-weight="700" font-size="${FS}" textLength="${W * 0.92}" lengthAdjust="spacingAndGlyphs" text-anchor="middle">${code}</text></svg>`;
const mask = `url("data:image/svg+xml,${encodeURIComponent(svgMask)}") center/contain no-repeat`;

let canvas: HTMLCanvasElement;
let warp = 0;
let repaint: ((t: number) => void) | null = null;

const cycle = () => {
	current =
		PATTERNS[(PATTERNS.indexOf(current) + 1) % PATTERNS.length] ?? "glyph";
};

const track = (e: PointerEvent) => {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const r = canvas.getBoundingClientRect();
	warp = ((e.clientX - r.left) / r.width + (e.clientY - r.top) / r.height) * 3;
	if (!raf) repaint?.(0);
};

let raf = 0;

$effect(() => {
	const seed = toSeed(code);
	const pat = current;

	const dpr = Math.min(1.5, window.devicePixelRatio || 1);
	canvas.width = Math.round(W * dpr);
	canvas.height = Math.round(H * dpr);
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const paint = (t: number) => {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		render(ctx, seed, {
			width: W,
			height: H,
			pattern: pat,
			palette: PALETTE,
			t: t + warp,
		});
	};

	repaint = paint;
	paint(0);
	document.fonts?.ready.then(() => paint(0));

	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	let start = 0;
	const loop = (now: number) => {
		if (!start) start = now;
		paint((now - start) / 1000);
		raf = requestAnimationFrame(loop);
	};
	raf = requestAnimationFrame(loop);
	return () => {
		cancelAnimationFrame(raf);
		raf = 0;
	};
});
</script>

<figure>
	<button
		type="button"
		class="block w-full cursor-pointer"
		onclick={cycle}
		onpointermove={track}
		aria-label="Error {code}, {current} pattern. Click for the next pattern."
	>
		<canvas
			bind:this={canvas}
			style="width:100%;aspect-ratio:{W}/{H};display:block;mask:{mask};-webkit-mask:{mask}"
			aria-hidden="true"
		></canvas>
	</button>
	<figcaption class="mono mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-faint">
		<span>seed {code} · {current}</span>
		<span class="text-brand-dim">click to change lens</span>
	</figcaption>
</figure>
