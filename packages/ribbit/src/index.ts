/**
 * ribbit - turn any seed into deterministic generative art on a canvas.
 * Framework-agnostic core, zero runtime dependencies.
 *
 * Three patterns (dither, glyph and wave) share one deterministic seeded
 * engine. A static frame uses `t = 0`; advancing `t` animates the same mark.
 * Rendering supports responsive aspect ratios, shapes and color palettes.
 */

export type Pattern = "dither" | "glyph" | "wave";

/** Clip applied to the rendered mark. Circles are transparent outside the disc. */
export type Shape = "rectangle" | "circle";

/** Colors used by a mark, from its background to its tonal ramp. */
export interface Palette {
	background: string;
	/** Ordered dark-to-light colors. Must contain at least two tones. */
	ramp: readonly string[];
}

/**
 * The Canvas 2D features ribbit needs to paint a mark.
 *
 * This is structural on purpose: both browser and Offscreen Canvas contexts
 * satisfy it, and framework adapters do not need to leak DOM-specific types.
 */
export interface Canvas2DContext {
	fillStyle: string | CanvasGradient | CanvasPattern;
	font: string;
	textAlign: CanvasTextAlign;
	globalCompositeOperation: GlobalCompositeOperation;
	fillRect(x: number, y: number, width: number, height: number): void;
	clearRect(x: number, y: number, width: number, height: number): void;
	fillText(text: string, x: number, y: number): void;
	beginPath(): void;
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	arc(
		x: number,
		y: number,
		radius: number,
		startAngle: number,
		endAngle: number,
	): void;
	clip(): void;
	closePath(): void;
	fill(): void;
	save(): void;
	restore(): void;
}

/** A Canvas-like surface that can provide a 2D drawing context. */
export interface CanvasSurface {
	width: number;
	height: number;
	getContext(contextId: "2d"): Canvas2DContext | null;
}

/** A Canvas-like surface or a 2D context, including their Offscreen variants. */
export type RenderTarget = CanvasSurface | Canvas2DContext;

export interface RenderOptions {
	/** Logical fallback size. Used for both dimensions unless overridden. Default 200. */
	size?: number;
	/** Logical canvas width. Overrides `size`. */
	width?: number;
	/** Logical canvas height. Overrides `size`. */
	height?: number;
	/** Which generative pattern to draw. Default "dither". */
	pattern?: Pattern;
	/** Time. 0 is a static frame; advancing it evolves the field. Default 0. */
	t?: number;
	/** Full rectangular canvas or a transparent circular crop. Default "rectangle". */
	shape?: Shape;
	/** Color system used by every pattern. Default `PALETTES.moss`. */
	palette?: Palette;
}

/** Static export presets. "og" is 1200x630, "avatar" is a square. */
export type Preset = "og" | "avatar";

export interface ExportOptions extends RenderOptions {
	preset?: Preset;
}

export interface AnimationExportOptions extends ExportOptions {
	/** Recording length in seconds. Default 4. */
	duration?: number;
	/** Requested capture frame rate, clamped to 1–60. Default 30. */
	fps?: number;
	/** Preferred WebM MIME type. Defaults to VP9, then VP8, then generic WebM. */
	mimeType?: string;
	/** Optional encoder bitrate hint. */
	videoBitsPerSecond?: number;
	/** Opaque color placed behind transparent pixels. Defaults to the palette background. */
	matte?: string | null;
	/** Called as the real-time recording advances from 0 to 1. */
	onProgress?: (progress: number) => void;
}

/** Built-in color systems. Custom palettes use the same `{ background, ramp }` shape. */
export const PALETTES = {
	moss: {
		background: "#0a0d0b",
		ramp: ["#0d130f", "#16241a", "#25412c", "#3a6b45", "#5c9e63", "#86c765"],
	},
	tide: {
		background: "#071014",
		ramp: ["#0b1820", "#102b38", "#17465a", "#246b80", "#4295a5", "#82c9c3"],
	},
	ember: {
		background: "#120b08",
		ramp: ["#1d100b", "#382015", "#62331e", "#98502a", "#ce7738", "#f2b35f"],
	},
	mono: {
		background: "#0b0b0b",
		ramp: ["#131313", "#242424", "#414141", "#686868", "#9a9a9a", "#dedede"],
	},
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

/** Default moss tonal ramp, kept as a standalone export for compatibility. */
export const RAMP = PALETTES.moss.ramp;

/** Default moss background, kept as a standalone export for compatibility. */
export const BG = PALETTES.moss.background;

function resolvePalette(palette?: Palette): Palette {
	if (palette && (!Array.isArray(palette.ramp) || palette.ramp.length < 2)) {
		throw new Error("ribbit: palette.ramp needs at least two colors");
	}
	return {
		background: palette?.background ?? BG,
		ramp: palette?.ramp ?? RAMP,
	};
}

function assertDimension(value: number, name: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`ribbit: ${name} must be a positive number`);
	}
	return value;
}

function rampColor(ramp: readonly string[], value: number): string {
	const index = Math.max(
		0,
		Math.min(ramp.length - 1, Math.round(value * (ramp.length - 1))),
	);
	return ramp[index] ?? RAMP[0];
}

function svgColor(color: string): string {
	return color
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

const BAYER = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

const CH = ["·", "∴", ":", ";", "+", "*", "o", "#", "%", "@"];

const TAU = 6.28;

// Shared by the canvas and SVG painters so both backends place cells and
// glyphs identically for the same seed.
const DITHER_OVERDRAW = 0.6;
const GLYPH_BASELINE = 0.75;

/** FNV-1a hash of a string into an unsigned 32-bit seed. */
export function seedFromString(s: string): number {
	let h = 2166136261 >>> 0;
	for (const c of s) {
		// codePointAt keeps the low surrogate of astral chars (emoji); charCodeAt
		// would hash only the lead surrogate, colliding distinct emoji seeds.
		h ^= c.codePointAt(0) ?? 0;
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
	const family = Math.floor(rng() * 4);
	const angle = rng() * TAU;
	const ca = Math.cos(angle);
	const sa = Math.sin(angle);
	const ox = (rng() - 0.5) * 0.7;
	const oy = (rng() - 0.5) * 0.7;
	const scale = 0.75 + rng() * 1.5;
	const phase = rng() * TAU;
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
		const px = u - 0.5 + ox;
		const py = v - 0.5 + oy;
		const x = (px * ca - py * sa) * scale;
		const y = (px * sa + py * ca) * scale;
		let s = 0;
		let ws = 0;
		for (const [i, o] of oct.entries()) {
			let value: number;
			switch (family) {
				case 1: {
					const radius = Math.hypot(x, y);
					const theta = Math.atan2(y, x);
					value = Math.sin(
						radius * o.fx * TAU + theta * (i + 1) + o.px + t * o.sp,
					);
					break;
				}
				case 2: {
					const bend = Math.sin(y * o.fy * TAU + o.py) * 0.22;
					value = Math.sin((x + bend) * o.fx * TAU + phase + t * o.sp);
					break;
				}
				case 3:
					value =
						Math.sin(x * o.fx * TAU + o.px + t * o.sp) *
						Math.cos(y * o.fy * TAU + o.py - t * o.sp);
					break;
				default:
					value =
						(Math.sin(x * o.fx * TAU + o.px + t * o.sp) +
							Math.cos(y * o.fy * TAU + o.py - t * o.sp * 0.7)) /
						2;
			}
			s += o.w * value;
			ws += o.w;
		}
		return Math.max(0, Math.min(1, (s / ws + 1) / 2));
	};
}

interface WaveLayer {
	base: number;
	amp: number;
	h: { f: number; p: number; a: number }[];
	sp: number;
	tone: number;
}

interface WaveField {
	layers: WaveLayer[];
	vertical: boolean;
	flip: boolean;
}

function waveField(seed: number): WaveField {
	const rng = mulberry32(seed);
	const vertical = rng() > 0.58;
	const flip = rng() > 0.5;
	const reverseRamp = rng() > 0.72;
	const M = 5 + Math.floor(rng() * 5);
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
			tone: 0.2 + ((reverseRamp ? M - 1 - i : i) / (M - 1)) * 0.8,
		});
	}
	return { layers: L, vertical, flip };
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

/** The structural Canvas 2D context used by every raster painter. */
type Ctx = Canvas2DContext;

interface Grid {
	cols: number;
	rows: number;
	cw: number;
	ch: number;
	span: number;
}

/** Keep cells and field frequencies isotropic on non-square canvases. */
function gridFor(w: number, h: number, base: number): Grid {
	const span = Math.min(w, h);
	const cols = Math.max(1, Math.round((w / span) * base));
	const rows = Math.max(1, Math.round((h / span) * base));
	return {
		cols,
		rows,
		cw: w / cols,
		ch: h / rows,
		span,
	};
}

function gridSample(
	x: number,
	y: number,
	grid: Grid,
	w: number,
	h: number,
): { u: number; v: number } {
	return {
		u: (x * grid.cw - (w - grid.span) / 2) / grid.span,
		v: (y * grid.ch - (h - grid.span) / 2) / grid.span,
	};
}

function wavePosition(
	layer: WaveLayer,
	progress: number,
	axisExtent: number,
	crossExtent: number,
	t: number,
	flip: boolean,
): number {
	const span = Math.min(axisExtent, crossExtent);
	const sample = (progress * axisExtent - (axisExtent - span) / 2) / span;
	const offset = (wedge(layer, sample, t) - layer.base) * span;
	const position = layer.base * crossExtent + offset;
	return flip ? crossExtent - position : position;
}

function paintDither(
	ctx: Ctx,
	seed: number,
	w: number,
	h: number,
	t: number,
	palette: Palette,
) {
	const f = fieldFn(seed);
	const ramp = palette.ramp;
	ctx.fillStyle = palette.background;
	ctx.fillRect(0, 0, w, h);
	const grid = gridFor(w, h, 22);
	for (let y = 0; y < grid.rows; y++) {
		for (let x = 0; x < grid.cols; x++) {
			const { u, v } = gridSample(x, y, grid, w, h);
			const val = f(u, v, t);
			const th = BAYER[y % 4][x % 4];
			let idx = Math.floor(val * ramp.length + (th - 0.5));
			idx = Math.max(0, Math.min(ramp.length - 1, idx));
			if (idx === 0) continue;
			ctx.fillStyle = ramp[idx];
			ctx.fillRect(
				x * grid.cw,
				y * grid.ch,
				grid.cw + DITHER_OVERDRAW,
				grid.ch + DITHER_OVERDRAW,
			);
		}
	}
}

function paintGlyph(
	ctx: Ctx,
	seed: number,
	w: number,
	h: number,
	t: number,
	palette: Palette,
) {
	const f = fieldFn(seed);
	const ramp = palette.ramp;
	ctx.fillStyle = palette.background;
	ctx.fillRect(0, 0, w, h);
	const grid = gridFor(w, h, 13);
	ctx.textAlign = "center";
	ctx.font = `${(Math.min(grid.cw, grid.ch) * 0.95).toFixed(1)}px monospace`;
	for (let y = 0; y < grid.rows; y++) {
		for (let x = 0; x < grid.cols; x++) {
			const { u, v } = gridSample(x, y, grid, w, h);
			const val = f(u, v, t);
			const idx = Math.min(ramp.length - 1, Math.floor(val * ramp.length));
			if (idx === 0) continue;
			ctx.fillStyle = ramp[idx];
			ctx.fillText(
				CH[Math.min(CH.length - 1, Math.floor(val * CH.length))],
				x * grid.cw + grid.cw / 2,
				y * grid.ch + grid.ch * GLYPH_BASELINE,
			);
		}
	}
}

function paintWave(
	ctx: Ctx,
	seed: number,
	w: number,
	h: number,
	t: number,
	palette: Palette,
) {
	const field = waveField(seed);
	ctx.fillStyle = palette.background;
	ctx.fillRect(0, 0, w, h);
	const N = 48;
	const layers = field.flip ? [...field.layers].reverse() : field.layers;
	for (const l of layers) {
		ctx.beginPath();
		if (field.vertical) {
			ctx.moveTo(w, 0);
			for (let i = 0; i <= N; i++) {
				const y = i / N;
				ctx.lineTo(wavePosition(l, y, h, w, t, field.flip), y * h);
			}
			ctx.lineTo(w, h);
		} else {
			ctx.moveTo(0, h);
			for (let i = 0; i <= N; i++) {
				const x = i / N;
				ctx.lineTo(x * w, wavePosition(l, x, w, h, t, field.flip));
			}
			ctx.lineTo(w, h);
		}
		ctx.closePath();
		ctx.fillStyle = rampColor(palette.ramp, l.tone);
		ctx.fill();
	}
}

const PAINTERS: Record<
	Pattern,
	(
		ctx: Ctx,
		seed: number,
		w: number,
		h: number,
		t: number,
		palette: Palette,
	) => void
> = {
	dither: paintDither,
	glyph: paintGlyph,
	wave: paintWave,
};

/** Draw the dither pattern onto a 2D context (square, `size` px). */
export function drawDither(
	ctx: Ctx,
	seed: number,
	size: number,
	t = 0,
	palette: Palette = PALETTES.moss,
): void {
	paintDither(ctx, seed, size, size, t, resolvePalette(palette));
}

/** Draw the glyph pattern onto a 2D context (square, `size` px). */
export function drawGlyph(
	ctx: Ctx,
	seed: number,
	size: number,
	t = 0,
	palette: Palette = PALETTES.moss,
): void {
	paintGlyph(ctx, seed, size, size, t, resolvePalette(palette));
}

/** Draw the wave pattern onto a 2D context (square, `size` px). */
export function drawWave(
	ctx: Ctx,
	seed: number,
	size: number,
	t = 0,
	palette: Palette = PALETTES.moss,
): void {
	paintWave(ctx, seed, size, size, t, resolvePalette(palette));
}

function is2dContext(target: RenderTarget): target is Canvas2DContext {
	return "fillRect" in target;
}

/**
 * Render a seeded mark onto a canvas element or an existing 2D context.
 * When given a canvas, its width/height are set to `size` (logical px).
 * When given a context, drawing uses the context's current transform, so
 * callers can pre-scale for device pixel ratio.
 */
export function render(
	target: RenderTarget,
	seed: string | number,
	options: RenderOptions = {},
): void {
	const { size = 200, pattern = "dither", t = 0 } = options;
	const width = assertDimension(options.width ?? size, "width");
	const height = assertDimension(options.height ?? size, "height");
	let ctx: Canvas2DContext;
	if (is2dContext(target)) {
		ctx = target;
	} else {
		target.width = width;
		target.height = height;
		const c = target.getContext("2d");
		if (!c) throw new Error("ribbit: could not get a 2D context");
		ctx = c;
	}
	paintWithShape(
		ctx,
		toSeed(seed),
		width,
		height,
		pattern,
		t,
		options.shape,
		resolvePalette(options.palette),
	);
}

function presetSize(options: ExportOptions): { w: number; h: number } {
	const size = options.size ?? 200;
	if (options.preset === "og") return { w: 1200, h: 630 };
	return {
		w: assertDimension(options.width ?? size, "width"),
		h: assertDimension(options.height ?? size, "height"),
	};
}

function paintWithShape(
	ctx: Ctx,
	seed: number,
	w: number,
	h: number,
	pattern: Pattern,
	t: number,
	shape: Shape = "rectangle",
	palette: Palette = PALETTES.moss,
) {
	const paint = PAINTERS[pattern];
	if (!paint) throw new Error(`ribbit: unknown pattern "${pattern}"`);
	ctx.save();
	ctx.clearRect(0, 0, w, h);
	if (shape === "circle") {
		ctx.beginPath();
		ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
		ctx.clip();
	}
	paint(ctx, seed, w, h, t, palette);
	ctx.restore();
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
	if (typeof document === "undefined") {
		throw new Error("ribbit: media export needs a DOM (document is undefined)");
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
	paintWithShape(
		ctx,
		seed,
		canvas.width,
		canvas.height,
		options.pattern ?? "dither",
		options.t ?? 0,
		options.shape,
		resolvePalette(options.palette),
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

function finiteInRange(
	value: number | undefined,
	fallback: number,
	min: number,
	max: number,
): number {
	if (value === undefined || !Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, value));
}

function webMMimeType(preferred?: string): string {
	if (typeof MediaRecorder === "undefined") {
		throw new Error("ribbit: WebM export needs MediaRecorder support");
	}
	const candidates = preferred
		? [preferred]
		: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
	const supported = candidates.find(
		(type) =>
			type.toLowerCase().startsWith("video/webm") &&
			MediaRecorder.isTypeSupported(type),
	);
	if (!supported) {
		throw new Error("ribbit: this browser cannot encode WebM");
	}
	return supported;
}

function paintVideoFrame(
	canvas: HTMLCanvasElement,
	seed: number,
	options: AnimationExportOptions,
	t: number,
) {
	paintTo(canvas, seed, { ...options, t });
	if (options.shape !== "circle") return;
	const palette = resolvePalette(options.palette);
	const matte =
		options.matte === null ? null : (options.matte ?? palette.background);
	if (!matte) return;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("ribbit: could not get a 2D context");
	ctx.save();
	ctx.globalCompositeOperation = "destination-over";
	ctx.fillStyle = matte;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.restore();
}

/**
 * Record an animated mark to a WebM Blob in real time.
 * Browser-only: requires canvas.captureStream and MediaRecorder.
 * Recording is driven by requestAnimationFrame, which browsers throttle in
 * background tabs — keep the tab visible for the full duration, or frames
 * freeze while the recorder keeps sampling the last painted frame.
 */
export async function toWebM(
	seed: string | number,
	options: AnimationExportOptions = {},
): Promise<Blob> {
	const { w, h } = presetSize(options);
	const canvas = makeCanvas(w, h);
	if (typeof canvas.captureStream !== "function") {
		throw new Error("ribbit: WebM export needs canvas.captureStream support");
	}

	const duration = finiteInRange(options.duration, 4, 0.25, 60);
	const fps = finiteInRange(options.fps, 30, 1, 60);
	const mimeType = webMMimeType(options.mimeType);
	const stream = canvas.captureStream(fps);
	let recorder: MediaRecorder | undefined;
	let animationFrame = 0;

	try {
		const recorderOptions: MediaRecorderOptions = { mimeType };
		if (options.videoBitsPerSecond !== undefined) {
			recorderOptions.videoBitsPerSecond = options.videoBitsPerSecond;
		}
		const rec = new MediaRecorder(stream, recorderOptions);
		recorder = rec;
		const chunks: Blob[] = [];

		const recording = new Promise<Blob>((resolve, reject) => {
			rec.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};
			rec.onerror = () => reject(new Error("ribbit: MediaRecorder failed"));
			rec.onstop = () => {
				if (chunks.length === 0) {
					reject(new Error("ribbit: WebM recorder returned no data"));
					return;
				}
				resolve(new Blob(chunks, { type: rec.mimeType || mimeType }));
			};
		});

		const normalizedSeed = toSeed(seed);
		const initialT = options.t ?? 0;
		paintVideoFrame(canvas, normalizedSeed, options, initialT);
		options.onProgress?.(0);
		rec.start(250);

		await new Promise<void>((resolve, reject) => {
			const started = performance.now();
			const frame = (now: number) => {
				try {
					const elapsed = (now - started) / 1000;
					const progress = Math.min(1, elapsed / duration);
					paintVideoFrame(canvas, normalizedSeed, options, initialT + elapsed);
					options.onProgress?.(progress);
					if (progress >= 1) {
						resolve();
						return;
					}
					animationFrame = requestAnimationFrame(frame);
				} catch (error) {
					reject(error);
				}
			};
			animationFrame = requestAnimationFrame(frame);
		});

		rec.stop();
		return await recording;
	} finally {
		if (animationFrame) cancelAnimationFrame(animationFrame);
		if (recorder && recorder.state !== "inactive") recorder.stop();
		for (const track of stream.getTracks()) track.stop();
	}
}

function ditherSVG(
	seed: number,
	w: number,
	h: number,
	t: number,
	palette: Palette,
): string {
	const f = fieldFn(seed);
	const ramp = palette.ramp;
	const grid = gridFor(w, h, 22);
	let r = "";
	for (let y = 0; y < grid.rows; y++) {
		for (let x = 0; x < grid.cols; x++) {
			const { u, v } = gridSample(x, y, grid, w, h);
			const val = f(u, v, t);
			const th = BAYER[y % 4][x % 4];
			let idx = Math.floor(val * ramp.length + (th - 0.5));
			idx = Math.max(0, Math.min(ramp.length - 1, idx));
			if (idx === 0) continue;
			r += `<rect x="${(x * grid.cw).toFixed(1)}" y="${(y * grid.ch).toFixed(1)}" width="${(grid.cw + DITHER_OVERDRAW).toFixed(1)}" height="${(grid.ch + DITHER_OVERDRAW).toFixed(1)}" fill="${svgColor(ramp[idx] ?? RAMP[0])}"/>`;
		}
	}
	return r;
}

function glyphSVG(
	seed: number,
	w: number,
	h: number,
	t: number,
	palette: Palette,
): string {
	const f = fieldFn(seed);
	const ramp = palette.ramp;
	const grid = gridFor(w, h, 13);
	const fs = (Math.min(grid.cw, grid.ch) * 0.95).toFixed(1);
	let r = "";
	for (let y = 0; y < grid.rows; y++) {
		for (let x = 0; x < grid.cols; x++) {
			const { u, v } = gridSample(x, y, grid, w, h);
			const val = f(u, v, t);
			const idx = Math.min(ramp.length - 1, Math.floor(val * ramp.length));
			if (idx === 0) continue;
			const ch2 = CH[Math.min(CH.length - 1, Math.floor(val * CH.length))]
				.replace("&", "&amp;")
				.replace("<", "&lt;");
			r += `<text x="${(x * grid.cw + grid.cw / 2).toFixed(1)}" y="${(y * grid.ch + grid.ch * GLYPH_BASELINE).toFixed(1)}" font-family="monospace" font-size="${fs}" fill="${svgColor(ramp[idx] ?? RAMP[0])}" text-anchor="middle">${ch2}</text>`;
		}
	}
	return r;
}

function waveSVG(
	seed: number,
	w: number,
	h: number,
	t: number,
	palette: Palette,
): string {
	const field = waveField(seed);
	const N = 48;
	let r = "";
	const layers = field.flip ? [...field.layers].reverse() : field.layers;
	for (const l of layers) {
		let d = field.vertical ? `M${w} 0 ` : `M0 ${h} `;
		for (let i = 0; i <= N; i++) {
			const axis = i / N;
			d += field.vertical
				? `L${wavePosition(l, axis, h, w, t, field.flip).toFixed(1)} ${(axis * h).toFixed(1)} `
				: `L${(axis * w).toFixed(1)} ${wavePosition(l, axis, w, h, t, field.flip).toFixed(1)} `;
		}
		d += `L${w} ${h} Z`;
		r += `<path d="${d}" fill="${svgColor(rampColor(palette.ramp, l.tone))}"/>`;
	}
	return r;
}

const SVG_PAINTERS: Record<
	Pattern,
	(seed: number, w: number, h: number, t: number, palette: Palette) => string
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
	const normalizedSeed = toSeed(seed);
	const palette = resolvePalette(options.palette);
	const paintSVG = SVG_PAINTERS[pattern];
	if (!paintSVG) throw new Error(`ribbit: unknown pattern "${pattern}"`);
	const body = paintSVG(normalizedSeed, w, h, options.t ?? 0, palette);
	const content = `<rect width="${w}" height="${h}" fill="${svgColor(palette.background)}"/>${body}`;
	const clipId = `ribbit-circle-${normalizedSeed.toString(16)}-${w}-${h}`;
	const clipped =
		options.shape === "circle"
			? `<defs><clipPath id="${clipId}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2}"/></clipPath></defs><g clip-path="url(#${clipId})">${content}</g>`
			: content;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${clipped}</svg>`;
}
