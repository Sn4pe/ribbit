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

function esc(s: string) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const KEYWORD = "#F97583";
const PLAIN = "#E1E4E8";
const STRING = "#9ECBFF";
const FN_NAME = "#B392F0";
const ATTR = "#B392F0";
const TAG = "#79B8FF";
const NUMBER = "#79B8FF";
const HTML_TAG = "#85E89D";

function tok(color: string, text: string) {
	return `<span style="color:${color}">${esc(text)}</span>`;
}

let snippetHtml = $derived(
	selected
		? framework === "react"
			? [
					tok(KEYWORD, "import"),
					tok(PLAIN, " { RibbitAvatar } "),
					tok(KEYWORD, "from"),
					tok(STRING, ' "ribbit-canvas/react"'),
					tok(PLAIN, ";\n\n"),
					tok(KEYWORD, "export"),
					tok(KEYWORD, " function"),
					tok(FN_NAME, " Avatar"),
					tok(PLAIN, "() {\n  "),
					tok(KEYWORD, "return"),
					tok(PLAIN, " <"),
					tok(TAG, "RibbitAvatar"),
					tok(ATTR, " seed"),
					tok(KEYWORD, "="),
					tok(STRING, `"${selected.seed}"`),
					tok(ATTR, " pattern"),
					tok(KEYWORD, "="),
					tok(STRING, `"${selected.pattern}"`),
					tok(ATTR, " size"),
					tok(KEYWORD, "="),
					tok(PLAIN, "{"),
					tok(NUMBER, "96"),
					tok(PLAIN, "} />;\n}"),
				].join("")
			: [
					tok(PLAIN, "<"),
					tok(HTML_TAG, "script"),
					tok(PLAIN, ">\n  "),
					tok(KEYWORD, "import"),
					tok(PLAIN, " RibbitAvatar "),
					tok(KEYWORD, "from"),
					tok(STRING, ' "ribbit-canvas/svelte"'),
					tok(PLAIN, ";\n</"),
					tok(HTML_TAG, "script"),
					tok(PLAIN, ">\n\n<"),
					tok(TAG, "RibbitAvatar"),
					tok(ATTR, " seed"),
					tok(PLAIN, "="),
					tok(STRING, `"${selected.seed}"`),
					tok(ATTR, " pattern"),
					tok(PLAIN, "="),
					tok(STRING, `"${selected.pattern}"`),
					tok(ATTR, " size"),
					tok(PLAIN, "={"),
					tok(NUMBER, "96"),
					tok(PLAIN, "} />"),
				].join("")
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
				<div class="install-tabs">
					<div class="install-tabs__list" role="tablist" aria-label="Component framework">
						<button type="button" role="tab" aria-selected={framework === "react"} class:active={framework === "react"} onclick={() => (framework = "react")}>React</button>
						<button type="button" role="tab" aria-selected={framework === "svelte"} class:active={framework === "svelte"} onclick={() => (framework = "svelte")}>Svelte</button>
					</div>
					<pre class="code-block"><code>{@html snippetHtml}</code><button type="button" class="install-tabs__copy" onclick={copySnippet}>{copied ? "Copied" : "Copy"}</button></pre>
				</div>
			</div>
		</div>
	</dialog>
{/if}
