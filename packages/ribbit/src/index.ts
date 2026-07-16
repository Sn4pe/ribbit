/**
 * ribbit - turn any seed into deterministic generative art on a canvas.
 * Framework-agnostic core, zero runtime dependencies.
 *
 * The three patterns (dither, glyph, wave), the palette, the value field,
 * the 4x4 Bayer matrix, the glyph set and the 7-layer wave are ported
 * verbatim from the approved Null-Frog prototypes. The one generalization
 * is `t` (time): a static frame is simply `t = 0`, an animated one advances
 * `t`, and both come from a single engine.
 */

export type Pattern = "dither" | "glyph" | "wave";

export interface RenderOptions {
	/** Logical pixel size of the (square) mark. Default 200. */
	size?: number;
	/** Which generative pattern to draw. Default "dither". */
	pattern?: Pattern;
	/** Time. 0 is a static frame; advancing it evolves the field. Default 0. */
	t?: number;
}

/** Static export presets. "og" is 1200x630, "avatar" is a square. */
export type Preset = "og" | "avatar";

export interface ExportOptions extends RenderOptions {
	preset?: Preset;
}

/** Green-black tonal ramp, dark to light. */
export const RAMP = [
	"#0d130f",
	"#16241a",
	"#25412c",
	"#3a6b45",
	"#5c9e63",
	"#86c765",
] as const;

/** Background ink the field is drawn over. */
export const BG = "#0a0d0b";

const BAYER = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

const CH = ["·", "∴", ":", ";", "+", "*", "o", "#", "%", "@"];

const TAU = 6.28;

/** FNV-1a hash of a string into an unsigned 32-bit seed. */
export function seedFromString(s: string): number {
	let h = 2166136261 >>> 0;
	for (const c of s) {
		h ^= c.charCodeAt(0);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h >>> 0;
}

/** Normalize any string or number into an unsigned 32-bit seed. */
export function toSeed(input: string | number): number {
	return typeof input === "number" ? input >>> 0 : seedFromString(input);
}

function mulberry32(a: number): () => number {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Field = (u: number, v: number, t: number) => number;

function fieldFn(seed: number): Field {
	const rng = mulberry32(seed);
	const oct: {
		fx: number;
		fy: number;
		px: number;
		py: number;
		sp: number;
		w: number;
	}[] = [];
	for (let i = 0; i < 3; i++) {
		oct.push({
			fx: 1 + rng() * 4,
			fy: 1 + rng() * 4,
			px: rng() * TAU,
			py: rng() * TAU,
			sp: 0.15 + rng() * 0.25,
			w: 1 / (i + 1),
		});
	}
	return (u, v, t) => {
		let s = 0;
		let ws = 0;
		for (const o of oct) {
			s +=
				o.w *
				(Math.sin(u * o.fx * TAU + o.px + t * o.sp) +
					Math.cos(v * o.fy * TAU + o.py - t * o.sp * 0.7));
			ws += o.w * 2;
		}
		return (s / ws + 1) / 2;
	};
}

interface WaveLayer {
	base: number;
	amp: number;
	h: { f: number; p: number; a: number }[];
	sp: number;
	col: string;
}

function waveLayers(seed: number): WaveLayer[] {
	const rng = mulberry32(seed);
	const M = 7;
	const L: WaveLayer[] = [];
	for (let i = 0; i < M; i++) {
		L.push({
			base: 0.16 + (i / (M - 1)) * 0.74,
			amp: 0.05 + rng() * 0.09,
			h: [
				{ f: 1 + rng() * 2, p: rng() * TAU, a: 1 },
				{ f: 2 + rng() * 3, p: rng() * TAU, a: 0.5 },
				{ f: 4 + rng() * 4, p: rng() * TAU, a: 0.28 },
			],
			sp: 0.12 + rng() * 0.3,
			col: RAMP[1 + Math.round((i / (M - 1)) * 4)],
		});
	}
	return L;
}

function wedge(l: WaveLayer, x: number, t: number): number {
	let s = 0;
	let w = 0;
	for (const hh of l.h) {
		s += hh.a * Math.sin(x * hh.f * TAU + hh.p + t * l.sp);
		w += hh.a;
	}
	return l.base + (s / w) * l.amp;
}

/** Any 2D drawing surface: a browser Canvas 2D context or an SVG string sink. */
type Ctx = CanvasRenderingContext2D;

function paintDither(ctx: Ctx, seed: number, w: number, h: number, t: number) {
	const f = fieldFn(seed);
	ctx.fillStyle = BG;
	ctx.fillRect(0, 0, w, h);
	const N = 22;
	const cw = w / N;
	const ch = h / N;
	for (let y = 0; y < N; y++) {
		for (let x = 0; x < N; x++) {
			const val = f(x / N, y / N, t);
			const th = BAYER[y % 4][x % 4];
			let idx = Math.floor(val * RAMP.length + (th - 0.5));
			idx = Math.max(0, Math.min(RAMP.length - 1, idx));
			if (idx === 0) continue;
			ctx.fillStyle = RAMP[idx];
			ctx.fillRect(x * cw, y * ch, cw + 0.6, ch + 0.6);
		}
	}
}

function paintGlyph(ctx: Ctx, seed: number, w: number, h: number, t: number) {
	const f = fieldFn(seed);
	ctx.fillStyle = BG;
	ctx.fillRect(0, 0, w, h);
	const N = 13;
	const cw = w / N;
	const ch = h / N;
	ctx.textAlign = "center";
	ctx.font = `${(Math.min(cw, ch) * 0.95).toFixed(1)}px monospace`;
	for (let y = 0; y < N; y++) {
		for (let x = 0; x < N; x++) {
			const val = f(x / N, y / N, t);
			const idx = Math.min(RAMP.length - 1, Math.floor(val * RAMP.length));
			if (idx === 0) continue;
			ctx.fillStyle = RAMP[idx];
			ctx.fillText(
				CH[Math.min(CH.length - 1, Math.floor(val * CH.length))],
				x * cw + cw / 2,
				y * ch + ch * 0.75,
			);
		}
	}
}

function paintWave(ctx: Ctx, seed: number, w: number, h: number, t: number) {
	const L = waveLayers(seed);
	ctx.fillStyle = BG;
	ctx.fillRect(0, 0, w, h);
	const N = 48;
	for (const l of L) {
		ctx.beginPath();
		ctx.moveTo(0, h);
		for (let i = 0; i <= N; i++) {
			const x = i / N;
			ctx.lineTo(x * w, wedge(l, x, t) * h);
		}
		ctx.lineTo(w, h);
		ctx.closePath();
		ctx.fillStyle = l.col;
		ctx.fill();
	}
}

const PAINTERS: Record<
	Pattern,
	(ctx: Ctx, seed: number, w: number, h: number, t: number) => void
> = {
	dither: paintDither,
	glyph: paintGlyph,
	wave: paintWave,
};

/** Draw the dither pattern onto a 2D context (square, `size` px). */
export function drawDither(ctx: Ctx, seed: number, size: number, t = 0): void {
	paintDither(ctx, seed, size, size, t);
}

/** Draw the glyph pattern onto a 2D context (square, `size` px). */
export function drawGlyph(ctx: Ctx, seed: number, size: number, t = 0): void {
	paintGlyph(ctx, seed, size, size, t);
}

/** Draw the wave pattern onto a 2D context (square, `size` px). */
export function drawWave(ctx: Ctx, seed: number, size: number, t = 0): void {
	paintWave(ctx, seed, size, size, t);
}

function is2dContext(target: unknown): target is CanvasRenderingContext2D {
	return (
		typeof CanvasRenderingContext2D !== "undefined" &&
		target instanceof CanvasRenderingContext2D
	);
}

/**
 * Render a seeded mark onto a canvas element or an existing 2D context.
 * When given a canvas, its width/height are set to `size` (logical px).
 * When given a context, drawing uses the context's current transform, so
 * callers can pre-scale for device pixel ratio.
 */
export function render(
	target: HTMLCanvasElement | CanvasRenderingContext2D,
	seed: string | number,
	options: RenderOptions = {},
): void {
	const { size = 200, pattern = "dither", t = 0 } = options;
	let ctx: CanvasRenderingContext2D;
	if (is2dContext(target)) {
		ctx = target;
	} else {
		const canvas = target as HTMLCanvasElement;
		canvas.width = size;
		canvas.height = size;
		const c = canvas.getContext("2d");
		if (!c) throw new Error("ribbit: could not get a 2D context");
		ctx = c;
	}
	(PAINTERS[pattern] ?? paintDither)(ctx, toSeed(seed), size, size, t);
}

function presetSize(options: ExportOptions): { w: number; h: number } {
	const size = options.size ?? 200;
	if (options.preset === "og") return { w: 1200, h: 630 };
	return { w: size, h: size };
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
	if (typeof document === "undefined") {
		throw new Error("ribbit: PNG export needs a DOM (document is undefined)");
	}
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	return canvas;
}

function paintTo(
	canvas: HTMLCanvasElement,
	seed: number,
	options: ExportOptions,
) {
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("ribbit: could not get a 2D context");
	(PAINTERS[options.pattern ?? "dither"] ?? paintDither)(
		ctx,
		seed,
		canvas.width,
		canvas.height,
		options.t ?? 0,
	);
}

/** Render a static PNG data URL. Supports the "og" and "avatar" presets. */
export function toDataURL(
	seed: string | number,
	options: ExportOptions = {},
): string {
	const { w, h } = presetSize(options);
	const canvas = makeCanvas(w, h);
	paintTo(canvas, toSeed(seed), options);
	return canvas.toDataURL("image/png");
}

/** Render a static PNG Blob. Supports the "og" and "avatar" presets. */
export function toBlob(
	seed: string | number,
	options: ExportOptions = {},
): Promise<Blob> {
	const { w, h } = presetSize(options);
	const canvas = makeCanvas(w, h);
	paintTo(canvas, toSeed(seed), options);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("ribbit: canvas.toBlob returned null"));
		}, "image/png");
	});
}

function ditherSVG(seed: number, w: number, h: number, t: number): string {
	const f = fieldFn(seed);
	const N = 22;
	const cw = w / N;
	const ch = h / N;
	let r = "";
	for (let y = 0; y < N; y++) {
		for (let x = 0; x < N; x++) {
			const val = f(x / N, y / N, t);
			const th = BAYER[y % 4][x % 4];
			let idx = Math.floor(val * RAMP.length + (th - 0.5));
			idx = Math.max(0, Math.min(RAMP.length - 1, idx));
			if (idx === 0) continue;
			r += `<rect x="${(x * cw).toFixed(1)}" y="${(y * ch).toFixed(1)}" width="${(cw + 0.4).toFixed(1)}" height="${(ch + 0.4).toFixed(1)}" fill="${RAMP[idx]}"/>`;
		}
	}
	return r;
}

function glyphSVG(seed: number, w: number, h: number, t: number): string {
	const f = fieldFn(seed);
	const N = 13;
	const cw = w / N;
	const ch = h / N;
	const fs = (Math.min(cw, ch) * 0.95).toFixed(1);
	let r = "";
	for (let y = 0; y < N; y++) {
		for (let x = 0; x < N; x++) {
			const val = f(x / N, y / N, t);
			const idx = Math.min(RAMP.length - 1, Math.floor(val * RAMP.length));
			if (idx === 0) continue;
			const ch2 = CH[Math.min(CH.length - 1, Math.floor(val * CH.length))]
				.replace("&", "&amp;")
				.replace("<", "&lt;");
			r += `<text x="${(x * cw + cw / 2).toFixed(1)}" y="${(y * ch + ch * 0.72).toFixed(1)}" font-family="monospace" font-size="${fs}" fill="${RAMP[idx]}" text-anchor="middle">${ch2}</text>`;
		}
	}
	return r;
}

function waveSVG(seed: number, w: number, h: number, t: number): string {
	const L = waveLayers(seed);
	const N = 48;
	let r = "";
	for (const l of L) {
		let d = `M0 ${h} `;
		for (let i = 0; i <= N; i++) {
			const x = i / N;
			d += `L${(x * w).toFixed(1)} ${(wedge(l, x, t) * h).toFixed(1)} `;
		}
		d += `L${w} ${h} Z`;
		r += `<path d="${d}" fill="${l.col}"/>`;
	}
	return r;
}

const SVG_PAINTERS: Record<
	Pattern,
	(seed: number, w: number, h: number, t: number) => string
> = {
	dither: ditherSVG,
	glyph: glyphSVG,
	wave: waveSVG,
};

/** Render a static, standalone SVG string. Supports the "og" and "avatar" presets. */
export function toSVG(
	seed: string | number,
	options: ExportOptions = {},
): string {
	const { w, h } = presetSize(options);
	const pattern = options.pattern ?? "dither";
	const body = (SVG_PAINTERS[pattern] ?? ditherSVG)(
		toSeed(seed),
		w,
		h,
		options.t ?? 0,
	);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;
}
