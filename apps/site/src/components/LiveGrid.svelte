<script lang="ts">
import {
	PALETTES,
	type Pattern,
	type Pointer,
	renderReactive,
} from "ribbit-canvas";
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
let reactToCursor = $state(false);
let animate = $state(false);
let dialog: HTMLDialogElement;

const KEYWORD = "#F97583";
const PLAIN = "#E1E4E8";
const STRING = "#9ECBFF";
const FN_NAME = "#B392F0";
const ATTR = "#B392F0";
const TAG = "#79B8FF";
const NUMBER = "#79B8FF";
const HTML_TAG = "#85E89D";

interface Token {
	color: string;
	text: string;
}

function tok(color: string, text: string): Token {
	return { color, text };
}

let flags = $derived(
	[animate ? "animated" : "", reactToCursor ? "reactive" : ""].filter(Boolean),
);

let snippet = $derived.by(() => {
	if (!selected) return "";
	const indent = framework === "react" ? "    " : "";
	const props = [
		`seed="${selected.seed}"`,
		`pattern="${selected.pattern}"`,
		"size={96}",
		...flags,
	]
		.map((prop) => `${indent}  ${prop}`)
		.join("\n");
	const tag = `${indent}<RibbitAvatar\n${props}\n${indent}/>`;
	return framework === "react"
		? `import { RibbitAvatar } from "ribbit-canvas/react";\n\nexport function Avatar() {\n  return (\n${tag}\n  );\n}`
		: `<script>\n  import RibbitAvatar from "ribbit-canvas/svelte";\n<${"/"}script>\n\n${tag}`;
});

function propTokens(indent: string): Token[] {
	if (!selected) return [];
	const out: Token[] = [
		tok(ATTR, `${indent}  seed`),
		tok(PLAIN, "="),
		tok(STRING, `"${selected.seed}"`),
		tok(PLAIN, "\n"),
		tok(ATTR, `${indent}  pattern`),
		tok(PLAIN, "="),
		tok(STRING, `"${selected.pattern}"`),
		tok(PLAIN, "\n"),
		tok(ATTR, `${indent}  size`),
		tok(PLAIN, "={"),
		tok(NUMBER, "96"),
		tok(PLAIN, "}"),
	];
	for (const flag of flags) {
		out.push(tok(PLAIN, "\n"), tok(ATTR, `${indent}  ${flag}`));
	}
	return out;
}

let snippetTokens = $derived.by(() => {
	if (!selected) return [];
	if (framework === "react") {
		return [
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
			tok(PLAIN, " (\n    <"),
			tok(TAG, "RibbitAvatar"),
			tok(PLAIN, "\n"),
			...propTokens("    "),
			tok(PLAIN, "\n    />\n  );\n}"),
		];
	}
	return [
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
		tok(PLAIN, "\n"),
		...propTokens(""),
		tok(PLAIN, "\n/>"),
	];
});

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

interface MarkParams {
	tile: Tile;
	reactive: boolean;
	animate?: boolean;
}

function mark(node: HTMLCanvasElement, params: MarkParams) {
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let { tile, reactive } = params;
	let animate = params.animate ?? false;
	let raf = 0;
	let start = 0;
	let hovering = false;
	let cursor: Pointer | null = null;

	const paint = (t: number) => {
		const css = node.clientWidth || 120;
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		node.width = Math.round(css * dpr);
		node.height = Math.round(css * dpr);
		const ctx = node.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		renderReactive(ctx, tile.seed, {
			pattern: tile.pattern,
			palette: PALETTES.moss,
			width: css,
			height: css,
			pointer: cursor,
			t,
		});
	};

	const loop = (now: number) => {
		if (!start) start = now;
		paint((now - start) / 1000);
		raf = requestAnimationFrame(loop);
	};
	const startLoop = () => {
		if (reduce || raf) return;
		start = 0;
		raf = requestAnimationFrame(loop);
	};
	const stopLoop = () => {
		cancelAnimationFrame(raf);
		raf = 0;
	};

	requestAnimationFrame(() => {
		paint(0);
		if (animate) startLoop();
	});

	const track = (event: PointerEvent) => {
		if (event.pointerType === "touch") return;
		hovering = true;
		if (reactive) {
			const box = node.getBoundingClientRect();
			cursor = { x: event.clientX - box.left, y: event.clientY - box.top };
		}
		startLoop();
	};
	const leave = () => {
		hovering = false;
		cursor = null;
		if (animate) return;
		stopLoop();
		paint(0);
	};
	node.addEventListener("pointerenter", track);
	node.addEventListener("pointermove", track);
	node.addEventListener("pointerleave", leave);

	return {
		update(next: MarkParams) {
			tile = next.tile;
			reactive = next.reactive;
			animate = next.animate ?? false;
			if (!reactive) cursor = null;
			if (animate) {
				startLoop();
			} else if (!hovering) {
				stopLoop();
				paint(0);
			}
		},
		destroy() {
			stopLoop();
			node.removeEventListener("pointerenter", track);
			node.removeEventListener("pointermove", track);
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
					use:mark={{ tile, reactive: false }}
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
	<dialog bind:this={dialog} class="m-auto w-[min(46rem,calc(100vw-2rem))] rounded-card border border-line-strong bg-surface p-0 text-fg shadow-2xl shadow-black/50 backdrop:bg-black/80 backdrop:backdrop-blur-sm" onclose={() => (selected = null)} onclick={handleDialogClick} aria-label="{selected.seed} component example">
		<header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
			<div class="min-w-0">
				<h3 class="truncate text-xl font-semibold leading-tight">{selected.seed}</h3>
				<p class="mono mt-1 text-xs text-brand">{selected.pattern}</p>
			</div>
			<button
				type="button"
				class="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-card border border-transparent text-lg leading-none text-faint transition-colors hover:border-line-strong hover:text-fg focus-visible:border-brand focus-visible:outline-none"
				onclick={close}
				aria-label="Close component example"
			>&times;</button>
		</header>

		<div class="grid items-start gap-6 px-5 pt-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:px-7 sm:pt-7">
			<div>
				<canvas
					use:mark={{ tile: selected, reactive: reactToCursor, animate }}
					class="aspect-square w-full rounded-card border border-line"
					style:background={PALETTES.moss.background}
					aria-label="Generative mark for the seed {selected.seed}"
				></canvas>
				<p class="mono mt-2 h-4 text-[0.7rem] text-faint">
					{reactToCursor ? "hover the mark" : ""}
				</p>
			</div>
			<div class="min-w-0">
				<p class="text-sm leading-relaxed text-muted">Use this deterministic mark directly as an avatar component. The switches below are real props — the snippet updates with them.</p>

				<div class="mt-4 rounded-card border border-line-strong bg-bg">
					<div class="flex items-center justify-between gap-4 px-3 py-2.5">
						<span class="mono text-xs uppercase tracking-wider text-faint">animated</span>
						<button
							type="button"
							role="switch"
							aria-checked={animate}
							aria-label="Animate the field"
							class="relative h-6 w-11 shrink-0 rounded-full border border-line-strong transition-colors focus-visible:border-brand focus-visible:outline-none"
							class:bg-brand-dim={animate}
							class:bg-surface-2={!animate}
							onclick={() => (animate = !animate)}
						>
							<span
								class="absolute top-0.5 h-4 w-4 rounded-full bg-fg transition-all"
								class:left-6={animate}
								class:left-0.5={!animate}
							></span>
						</button>
					</div>
					<div class="flex items-center justify-between gap-4 border-t border-line px-3 py-2.5">
						<span class="mono text-xs uppercase tracking-wider text-faint">
							reactive
							{#if selected.pattern === "wave"}<span class="ml-1 normal-case tracking-normal opacity-60">· not for wave</span>{/if}
						</span>
						<button
							type="button"
							role="switch"
							aria-checked={reactToCursor}
							aria-label="Let the cells react to the cursor"
							class="relative h-6 w-11 shrink-0 rounded-full border border-line-strong transition-colors focus-visible:border-brand focus-visible:outline-none disabled:opacity-40"
							class:bg-brand-dim={reactToCursor && selected.pattern !== "wave"}
							class:bg-surface-2={!reactToCursor || selected.pattern === "wave"}
							onclick={() => (reactToCursor = !reactToCursor)}
							disabled={selected.pattern === "wave"}
						>
							<span
								class="absolute top-0.5 h-4 w-4 rounded-full bg-fg transition-all"
								class:left-6={reactToCursor}
								class:left-0.5={!reactToCursor}
							></span>
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="px-5 pb-5 sm:px-7 sm:pb-7">
			<div class="install-tabs">
					<div class="install-tabs__list install-tabs__list--split">
						<div class="flex gap-1" role="tablist" aria-label="Component framework">
							<button type="button" role="tab" aria-selected={framework === "react"} class:active={framework === "react"} onclick={() => (framework = "react")}>React</button>
							<button type="button" role="tab" aria-selected={framework === "svelte"} class:active={framework === "svelte"} onclick={() => (framework = "svelte")}>Svelte</button>
						</div>
						<button type="button" class="install-tabs__copy install-tabs__copy--inline" onclick={copySnippet}>{copied ? "Copied" : "Copy"}</button>
					</div>
					<pre class="code-block code-block--scroll"><code>{#each snippetTokens as t}<span style="color:{t.color}">{t.text}</span>{/each}</code></pre>
			</div>
		</div>
	</dialog>
{/if}
