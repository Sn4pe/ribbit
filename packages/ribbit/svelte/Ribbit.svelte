<script lang="ts">
import {
	type Palette,
	type Pattern,
	render,
	type Shape,
	toSeed,
} from "../dist/index.js";

interface Props {
	/** Any string or number. The same seed always yields the same mark. */
	seed: string | number;
	/** Logical pixel size of the square mark. */
	size?: number;
	/** Which generative pattern to draw. */
	pattern?: Pattern;
	/** Full rectangle or a transparent circular crop. */
	shape?: Shape;
	/** Background and dark-to-light tonal ramp. */
	palette?: Palette;
	/** CSS border-radius for the canvas. */
	radius?: string;
	/** Run a requestAnimationFrame loop that evolves the field over time. */
	animated?: boolean;
	class?: string;
}

let {
	seed,
	size = 64,
	pattern = "dither",
	shape = "rectangle",
	palette,
	radius = "50%",
	animated = false,
	class: className = "",
}: Props = $props();

let canvas: HTMLCanvasElement;

$effect(() => {
	// Reading these makes the effect re-run when they change.
	const s = toSeed(seed);
	const px = size;
	const pat = pattern;
	const crop = shape;
	const colors = palette;
	const wantsMotion = animated;

	const dpr = Math.min(1.5, window.devicePixelRatio || 1);
	canvas.width = Math.round(px * dpr);
	canvas.height = Math.round(px * dpr);
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	const paint = (t: number) =>
		render(ctx, s, { size: px, pattern: pat, shape: crop, palette: colors, t });

	// Content is visible by default: paint one static frame immediately,
	// before any animation loop, so the mark is never gated on motion.
	paint(0);

	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (!wantsMotion || reduce) return;

	let raf = 0;
	let start = 0;
	let onScreen = true;
	const io = new IntersectionObserver(
		(entries) => {
			onScreen = entries[0]?.isIntersecting ?? true;
		},
		{ threshold: 0 },
	);
	io.observe(canvas);

	const loop = (now: number) => {
		if (!start) start = now;
		if (onScreen) paint((now - start) / 1000);
		raf = requestAnimationFrame(loop);
	};
	raf = requestAnimationFrame(loop);

	return () => {
		cancelAnimationFrame(raf);
		io.disconnect();
	};
});
</script>

<canvas
	bind:this={canvas}
	class={className}
	style="width:{size}px;height:{size}px;border-radius:{radius};display:block;background:{shape === 'circle' ? 'transparent' : '#0a0d0b'}"
	aria-hidden="true"
></canvas>
