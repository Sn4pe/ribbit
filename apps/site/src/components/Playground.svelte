<script lang="ts">
import { type Pattern, render, toBlob, toSeed } from "ribbit";

const PATTERNS: Pattern[] = ["dither", "glyph", "wave"];
const POOL = [
	"null-frog", "ribbit", "croak", "moss-01", "heron", "dusk", "lily-pad",
	"spore", "dragonfly", "peat", "glint", "reed",
];

let seed = $state("null-frog");
let pattern = $state<Pattern>("dither");
let size = $state(256);
let animated = $state(false);
let busy = $state(false);

let canvas: HTMLCanvasElement;

$effect(() => {
	// Deps: seed, pattern, size, animated.
	const s = toSeed(seed || " ");
	const pat = pattern;
	const px = size;
	const wantsMotion = animated;

	const dpr = Math.min(1.5, window.devicePixelRatio || 1);
	const draw = (t: number) => {
		const css = canvas.clientWidth || px;
		canvas.width = Math.round(css * dpr);
		canvas.height = Math.round(css * dpr);
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		render(ctx, s, { size: css, pattern: pat, t });
	};

	draw(0);

	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (!wantsMotion || reduce) return;

	let raf = 0;
	let startT = 0;
	const loop = (now: number) => {
		if (!startT) startT = now;
		draw((now - startT) / 1000);
		raf = requestAnimationFrame(loop);
	};
	raf = requestAnimationFrame(loop);
	return () => cancelAnimationFrame(raf);
});

function randomize() {
	const pick = POOL[Math.floor(Math.random() * POOL.length)];
	seed = pick === seed ? `${pick}-${Math.floor(Math.random() * 90 + 10)}` : pick;
}

async function exportPng() {
	busy = true;
	try {
		const blob = await toBlob(seed || "ribbit", {
			pattern,
			preset: "avatar",
			size,
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `ribbit-${(seed || "ribbit").replace(/[^a-z0-9-]/gi, "_")}.png`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	} finally {
		busy = false;
	}
}
</script>

<div class="grid gap-6 rounded-card border border-line bg-surface/60 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
	<!-- Preview -->
	<div class="flex items-center justify-center rounded-card border border-line bg-[#080b09] p-6">
		<canvas
			bind:this={canvas}
			class="w-full max-w-[22rem] rounded-card"
			style="aspect-ratio:1/1;background:#0a0d0b"
			aria-label="Live preview of the mark for seed {seed}, pattern {pattern}"
		></canvas>
	</div>

	<!-- Controls -->
	<div class="flex flex-col gap-6">
		<label class="block">
			<span class="mono text-xs uppercase tracking-wider text-faint">seed</span>
			<div class="mt-2 flex gap-2">
				<input
					class="mono min-w-0 flex-1 rounded-card border border-line-strong bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand"
					type="text"
					bind:value={seed}
					spellcheck="false"
					autocomplete="off"
					placeholder="type anything"
				/>
				<button
					type="button"
					class="mono rounded-card border border-line-strong bg-surface-2 px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
					onclick={randomize}
					aria-label="Random seed"
				>&#8635;</button>
			</div>
		</label>

		<div>
			<span class="mono text-xs uppercase tracking-wider text-faint">pattern</span>
			<div class="mt-2 grid grid-cols-3 gap-1 rounded-card border border-line-strong bg-bg p-1" role="group" aria-label="Pattern">
				{#each PATTERNS as p (p)}
					<button
						type="button"
						class="mono rounded-[0.35rem] px-2 py-1.5 text-sm transition-colors"
						class:bg-brand-dim={pattern === p}
						class:text-fg={pattern === p}
						class:text-muted={pattern !== p}
						aria-pressed={pattern === p}
						onclick={() => (pattern = p)}
					>{p}</button>
				{/each}
			</div>
		</div>

		<label class="block">
			<span class="mono flex items-center justify-between text-xs uppercase tracking-wider text-faint">
				<span>size</span><span class="text-muted">{size}px</span>
			</span>
			<input
				class="mt-3 w-full accent-[var(--brand)]"
				type="range"
				min="64"
				max="512"
				step="16"
				bind:value={size}
			/>
		</label>

		<div class="flex items-center justify-between">
			<span class="mono text-xs uppercase tracking-wider text-faint">animate</span>
			<button
				type="button"
				role="switch"
				aria-checked={animated}
				aria-label="Animate the field"
				class="relative h-6 w-11 rounded-full border border-line-strong transition-colors"
				class:bg-brand-dim={animated}
				class:bg-bg={!animated}
				onclick={() => (animated = !animated)}
			>
				<span
					class="absolute top-0.5 h-4 w-4 rounded-full bg-fg transition-all"
					class:left-6={animated}
					class:left-0.5={!animated}
				></span>
			</button>
		</div>

		<button
			type="button"
			class="mono mt-1 rounded-card border border-brand-dim bg-brand-dim/20 px-4 py-2.5 text-sm text-brand-bright transition-colors hover:bg-brand-dim/35 disabled:opacity-50"
			onclick={exportPng}
			disabled={busy}
		>{busy ? "exporting..." : "export PNG"}</button>
	</div>
</div>
