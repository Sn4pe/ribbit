<script lang="ts">
import {
	PALETTES,
	type PaletteName,
	type Pattern,
	type Preset,
	render,
	type Shape,
	toBlob,
	toSeed,
	toWebM,
} from "ribbit-canvas";

const PATTERNS: Pattern[] = ["dither", "glyph", "wave"];
const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];
const POOL = [
	"null-frog",
	"ribbit",
	"croak",
	"moss-01",
	"heron",
	"dusk",
	"lily-pad",
	"spore",
	"dragonfly",
	"peat",
	"glint",
	"reed",
];

let seed = $state("null-frog");
let pattern = $state<Pattern>("dither");
let paletteName = $state<PaletteName>("moss");
let size = $state(256);
let format = $state<Preset>("avatar");
let shape = $state<Shape>("circle");
let animated = $state(false);
let busy = $state<"png" | "webm" | null>(null);
let progress = $state(0);
let exportError = $state("");

let canvas: HTMLCanvasElement;

$effect(() => {
	const s = toSeed(seed || " ");
	const pat = pattern;
	const colors = PALETTES[paletteName];
	const px = size;
	const output = format;
	const crop = shape;
	const wantsMotion = animated;

	const dpr = Math.min(1.5, window.devicePixelRatio || 1);
	const draw = (t: number) => {
		const cssWidth = canvas.clientWidth || px;
		const cssHeight = output === "og" ? cssWidth * (630 / 1200) : cssWidth;
		canvas.width = Math.round(cssWidth * dpr);
		canvas.height = Math.round(cssHeight * dpr);
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		render(ctx, s, {
			width: cssWidth,
			height: cssHeight,
			pattern: pat,
			palette: colors,
			shape: output === "avatar" ? crop : "rectangle",
			t,
		});
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
	seed =
		pick === seed ? `${pick}-${Math.floor(Math.random() * 90 + 10)}` : pick;
}

async function exportPng() {
	busy = "png";
	exportError = "";
	try {
		const blob = await toBlob(seed || "ribbit", {
			pattern,
			palette: PALETTES[paletteName],
			preset: format,
			size,
			shape: format === "avatar" ? shape : "rectangle",
		});
		download(blob, "png");
	} catch (error) {
		exportError = error instanceof Error ? error.message : "PNG export failed";
	} finally {
		busy = null;
	}
}

async function exportWebm() {
	busy = "webm";
	progress = 0;
	exportError = "";
	try {
		const palette = PALETTES[paletteName];
		const blob = await toWebM(seed || "ribbit", {
			pattern,
			palette,
			preset: format,
			size,
			shape: format === "avatar" ? shape : "rectangle",
			duration: 5,
			fps: 30,
			matte: palette.background,
			videoBitsPerSecond: format === "og" ? 4_000_000 : 2_000_000,
			onProgress: (value) => (progress = value),
		});
		download(blob, "webm");
	} catch (error) {
		exportError = error instanceof Error ? error.message : "WebM export failed";
	} finally {
		busy = null;
		progress = 0;
	}
}

async function exportCurrent() {
	if (animated) await exportWebm();
	else await exportPng();
}

function download(blob: Blob, extension: "png" | "webm") {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `ribbit-${(seed || "ribbit").replace(/[^a-z0-9-]/gi, "_")}-${paletteName}-${format}${format === "avatar" ? `-${shape}` : ""}.${extension}`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
</script>

<div class="grid gap-6 rounded-card border border-line bg-surface/60 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
	<div class="flex min-h-80 items-center justify-center rounded-card border border-line bg-[#080b09] p-6">
		<canvas
			bind:this={canvas}
			class="w-full"
			class:max-w-[22rem]={format === "avatar"}
			class:max-w-[40rem]={format === "og"}
			class:rounded-full={format === "avatar" && shape === "circle"}
			class:rounded-card={format === "og" || shape === "rectangle"}
			style:aspect-ratio={format === "og" ? "1200/630" : "1/1"}
			style:background-color={PALETTES[paletteName].background}
			aria-label="Live {format} preview of the mark for seed {seed}, pattern {pattern}, palette {paletteName}"
		></canvas>
	</div>

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
			<span class="mono text-xs uppercase tracking-wider text-faint">format</span>
			<div class="mt-2 grid grid-cols-2 gap-1 rounded-card border border-line-strong bg-bg p-1" role="group" aria-label="Output format">
				{#each ["avatar", "og"] as output (output)}
					<button
						type="button"
						class="mono rounded-[0.35rem] px-2 py-1.5 text-sm transition-colors"
						class:bg-brand-dim={format === output}
						class:text-fg={format === output}
						class:text-muted={format !== output}
						aria-pressed={format === output}
						onclick={() => (format = output as Preset)}
					>{output === "og" ? "OG · 1200×630" : "avatar"}</button>
				{/each}
			</div>
		</div>

		{#if format === "avatar"}
			<div>
				<span class="mono text-xs uppercase tracking-wider text-faint">shape</span>
				<div class="mt-2 grid grid-cols-2 gap-1 rounded-card border border-line-strong bg-bg p-1" role="group" aria-label="Avatar shape">
					{#each ["circle", "rectangle"] as crop (crop)}
						<button
							type="button"
							class="mono rounded-[0.35rem] px-2 py-1.5 text-sm transition-colors"
							class:bg-brand-dim={shape === crop}
							class:text-fg={shape === crop}
							class:text-muted={shape !== crop}
							aria-pressed={shape === crop}
							onclick={() => (shape = crop as Shape)}
						>{crop === "rectangle" ? "square" : crop}</button>
					{/each}
				</div>
			</div>
		{/if}

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

		<div>
			<span class="mono text-xs uppercase tracking-wider text-faint">palette</span>
			<div class="mt-2 grid grid-cols-2 gap-1 rounded-card border border-line-strong bg-bg p-1" role="group" aria-label="Color palette">
				{#each PALETTE_NAMES as name (name)}
					<button
						type="button"
						class="mono flex items-center justify-between gap-2 rounded-[0.35rem] px-2 py-1.5 text-xs transition-colors"
						class:bg-surface-2={paletteName === name}
						class:text-fg={paletteName === name}
						class:text-muted={paletteName !== name}
						aria-pressed={paletteName === name}
						onclick={() => (paletteName = name)}
					>
						{name}
						<span class="flex -space-x-0.5" aria-hidden="true">
							{#each PALETTES[name].ramp.slice(-3) as color (color)}
								<span class="size-2.5 rounded-full border border-bg" style:background-color={color}></span>
							{/each}
						</span>
					</button>
				{/each}
			</div>
		</div>

		{#if format === "avatar"}
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
		{:else}
			<div class="mono flex items-center justify-between text-xs uppercase tracking-wider text-faint">
				<span>export size</span><span class="text-muted">1200 × 630px</span>
			</div>
		{/if}

		<div class="flex items-center justify-between">
			<span class="mono text-xs uppercase tracking-wider text-faint">animate</span>
			<button
				type="button"
				role="switch"
				aria-checked={animated}
				aria-label="Animate the field"
				class="relative h-6 w-11 rounded-full border border-line-strong transition-colors disabled:opacity-50"
				class:bg-brand-dim={animated}
				class:bg-bg={!animated}
				onclick={() => (animated = !animated)}
				disabled={busy !== null}
			>
				<span
					class="absolute top-0.5 h-4 w-4 rounded-full bg-fg transition-all"
					class:left-6={animated}
					class:left-0.5={!animated}
				></span>
			</button>
		</div>

		<div class="mt-1">
			<button
				type="button"
				class="mono w-full rounded-card border border-brand-dim bg-brand-dim/20 px-3 py-2.5 text-xs text-brand-bright transition-colors hover:bg-brand-dim/35 disabled:opacity-50"
				onclick={exportCurrent}
				disabled={busy !== null}
			>{animated
				? busy === "webm"
					? `recording ${Math.round(progress * 100)}%`
					: "export WebM · 5s"
				: busy === "png"
					? "exporting..."
					: "export PNG"}</button>
		</div>
		{#if exportError}
			<p class="mono -mt-3 text-xs text-[#d98b78]" role="alert">{exportError}</p>
		{/if}
	</div>
</div>
