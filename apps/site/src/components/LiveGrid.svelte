<script lang="ts">
import { PALETTES, type Pattern, render, toSeed } from "ribbit-canvas";
import { tick } from "svelte";

interface Tile {
	seed: string;
	pattern: Pattern;
}

const tiles: Tile[] = [
	{ seed: "croak", pattern: "dither" },
	{ seed: "marsh", pattern: "glyph" },
	{ seed: "lily", pattern: "wave" },
	{ seed: "frogspawn", pattern: "dither" },
	{ seed: "reed", pattern: "glyph" },
	{ seed: "pond", pattern: "wave" },
	{ seed: "null-frog", pattern: "dither" },
	{ seed: "ripple", pattern: "glyph" },
	{ seed: "moss", pattern: "wave" },
	{ seed: "spore", pattern: "dither" },
	{ seed: "heron", pattern: "glyph" },
	{ seed: "bog", pattern: "wave" },
	{ seed: "fen", pattern: "dither" },
	{ seed: "cattail", pattern: "glyph" },
	{ seed: "murk", pattern: "wave" },
	{ seed: "glint", pattern: "dither" },
	{ seed: "brook", pattern: "glyph" },
	{ seed: "algae", pattern: "wave" },
	{ seed: "dragonfly", pattern: "dither" },
	{ seed: "mire", pattern: "glyph" },
	{ seed: "willow", pattern: "wave" },
	{ seed: "dew", pattern: "glyph" },
	{ seed: "fern", pattern: "dither" },
	{ seed: "wisp", pattern: "glyph" },
	{ seed: "gloam", pattern: "wave" },
	{ seed: "brack", pattern: "glyph" },
	{ seed: "ribbit-1", pattern: "glyph" },
	{ seed: "sedge", pattern: "dither" },
	{ seed: "moss-2", pattern: "glyph" },
	{ seed: "nixie", pattern: "wave" },
];

let selected = $state<Tile | null>(null);
let framework = $state<"react" | "svelte">("react");
let copied = $state(false);
let dialog: HTMLDialogElement;

let snippet = $derived(
	selected
		? framework === "react"
			? `import { RibbitAvatar } from "ribbit-canvas/react";

export function Avatar() {
  return <RibbitAvatar seed="${selected.seed}" pattern="${selected.pattern}" size={96} />;
}`
			: `<script>
  import RibbitAvatar from "ribbit-canvas/svelte";
<${"/"}script>

<RibbitAvatar seed="${selected.seed}" pattern="${selected.pattern}" size={96} />`
		: "",
);

async function open(tile: Tile) {
	selected = tile;
	copied = false;
	await tick();
	dialog.showModal();
}

function close() {
	dialog.close();
}

function handleDialogClick(event: MouseEvent) {
	if (event.target === dialog) close();
}

async function copySnippet() {
	await navigator.clipboard.writeText(snippet);
	copied = true;
}

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
		render(ctx, toSeed(tile.seed), {
			size: css,
			pattern: tile.pattern,
			palette: PALETTES.moss,
			t,
		});
	};

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
			<button type="button" class="block w-full text-left" onclick={() => open(tile)} aria-label="Open {tile.seed} component example">
				<canvas
					use:mark={tile}
					class="aspect-square w-full cursor-pointer rounded-card border border-line transition-colors group-hover:border-line-strong"
					style:background={PALETTES.moss.background}
					aria-label="Generative mark for the seed {tile.seed}"
				></canvas>
			</button>
			<figcaption class="mono mt-2 truncate text-xs text-faint transition-colors group-hover:text-muted">{tile.seed}</figcaption>
		</figure>
	{/each}
</div>

{#if selected}
	<dialog bind:this={dialog} class="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-card border border-line-strong bg-surface p-0 text-fg shadow-2xl shadow-black/50 backdrop:bg-black/80" onclose={() => (selected = null)} onclick={handleDialogClick}>
		<div class="grid gap-6 p-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:p-7">
			<canvas
				use:mark={selected}
				class="aspect-square w-full rounded-card border border-line"
				style:background={PALETTES.moss.background}
				aria-label="Generative mark for the seed {selected.seed}"
			></canvas>
			<div>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="mono text-xs text-brand">{selected.pattern}</p>
						<h3 class="mt-1 text-xl font-semibold">{selected.seed}</h3>
					</div>
					<button type="button" class="text-xl leading-none text-faint transition-colors hover:text-fg" onclick={close} aria-label="Close component example">×</button>
				</div>
				<p class="mt-4 text-sm leading-relaxed text-muted">Use this deterministic mark directly as an avatar component.</p>
				<div class="mt-5 flex gap-2" role="tablist" aria-label="Component framework">
					<button type="button" class="rounded-full border px-3 py-1 text-xs transition-colors {framework === 'react' ? 'border-brand text-brand-bright' : 'border-line text-faint hover:text-fg'}" onclick={() => (framework = "react")}>React</button>
					<button type="button" class="rounded-full border px-3 py-1 text-xs transition-colors {framework === 'svelte' ? 'border-brand text-brand-bright' : 'border-line text-faint hover:text-fg'}" onclick={() => (framework = "svelte")}>Svelte</button>
				</div>
				<pre class="mono mt-3 overflow-x-auto rounded-card border border-line bg-bg p-4 text-xs leading-relaxed text-muted"><code>{snippet}</code></pre>
				<button type="button" class="mt-3 rounded-card border border-line px-3 py-2 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg" onclick={copySnippet}>{copied ? "Copied" : "Copy component"}</button>
			</div>
		</div>
	</dialog>
{/if}
