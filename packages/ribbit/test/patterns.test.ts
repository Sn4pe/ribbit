import { describe, expect, test } from "bun:test";
import {
	BG,
	type Canvas2DContext,
	field,
	PALETTES,
	PATTERNS,
	type Pattern,
	RAMP,
	render,
	renderReactive,
	seedFromString,
	toSeed,
	toSVG,
	toWebM,
} from "../src/index.ts";

const PALETTE = new Set<string>([BG, ...RAMP]);
const CUSTOM_PALETTE = {
	background: "#101018",
	ramp: ["#201030", "#482060", "#783c96", "#b86bd1", "#f1b4ff"],
} as const;

function fills(svg: string): string[] {
	return [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
}

function recorder() {
	const cells: { color: string; x: number; y: number }[] = [];
	const arcs: { x: number; y: number; r: number }[] = [];
	const context = {
		fillStyle: "",
		font: "",
		textAlign: "",
		save() {},
		restore() {},
		clearRect() {},
		beginPath() {},
		clip() {},
		moveTo() {},
		lineTo() {},
		closePath() {},
		fill() {},
		fillText() {},
		arc(x: number, y: number, r: number) {
			arcs.push({ x, y, r });
		},
		fillRect(x: number, y: number, w: number) {
			if (w > 100) return;
			cells.push({ color: this.fillStyle as string, x, y });
		},
	} as unknown as Canvas2DContext;
	return { context, cells, arcs };
}

describe("seed hashing", () => {
	test("seedFromString is stable and unsigned", () => {
		expect(seedFromString("ribbit")).toBe(seedFromString("ribbit"));
		expect(seedFromString("ribbit")).toBeGreaterThanOrEqual(0);
		expect(seedFromString("croak")).not.toBe(seedFromString("ribbit"));
	});

	test("toSeed passes numbers through as uint32", () => {
		expect(toSeed(42)).toBe(42);
		expect(toSeed(-1)).toBe(4294967295);
		expect(toSeed("7")).toBe(seedFromString("7"));
	});

	test("emoji seeds hash their full codepoints, not just the lead surrogate", () => {
		expect(seedFromString("🐸x")).not.toBe(seedFromString("🐹x"));
	});
});

describe("input validation", () => {
	test("unknown patterns throw instead of silently falling back to dither", () => {
		expect(() => toSVG("x", { pattern: "dther" as Pattern })).toThrow(
			'unknown pattern "dther"',
		);
	});

	test("non-positive dimensions throw a descriptive error", () => {
		expect(() => toSVG("x", { size: -50 })).toThrow(
			"width must be a positive number",
		);
		expect(() => toSVG("x", { size: 0 })).toThrow("positive");
	});

	test("a palette without a ramp array is rejected", () => {
		expect(() =>
			toSVG("x", { palette: { background: "#111111" } as never }),
		).toThrow("palette.ramp needs at least two colors");
		expect(() =>
			toSVG("x", {
				palette: { background: "#111111", ramp: "redblue" } as never,
			}),
		).toThrow("palette.ramp needs at least two colors");
	});
});

describe("canvas and SVG backends stay in sync", () => {
	test("dither cells share the same overdraw", () => {
		const rects: number[][] = [];
		const context = {
			fillStyle: "",
			save() {},
			restore() {},
			clearRect() {},
			fillRect(...args: number[]) {
				rects.push(args);
			},
		} as unknown as Canvas2DContext;

		render(context, "parity", { size: 480 });
		const svg = toSVG("parity", { size: 480 });
		const svgCellWidth = Number(
			svg.match(/<rect x="[^"]+" y="[^"]+" width="([^"]+)"/)?.[1],
		);
		const cellWidth = rects.find((rect) => rect[2] !== 480)?.[2];
		expect(cellWidth).toBeCloseTo(svgCellWidth, 1);
	});

	test("glyph baselines match", () => {
		const baselines: number[] = [];
		const context = {
			fillStyle: "",
			font: "",
			textAlign: "",
			save() {},
			restore() {},
			clearRect() {},
			fillRect() {},
			fillText(_ch: string, _x: number, y: number) {
				baselines.push(y);
			},
		} as unknown as Canvas2DContext;

		render(context, "parity", { size: 480, pattern: "glyph" });
		const svg = toSVG("parity", { size: 480, pattern: "glyph" });
		const svgBaseline = Number(svg.match(/<text x="[^"]+" y="([^"]+)"/)?.[1]);
		expect(baselines[0]).toBeCloseTo(svgBaseline, 0);
	});
});

describe("framework-agnostic canvas targets", () => {
	test("renders into a structural 2D context without DOM constructors", () => {
		const fills: string[] = [];
		const context = {
			fillStyle: "",
			save() {},
			restore() {},
			clearRect() {},
			fillRect() {
				fills.push(this.fillStyle);
			},
		} as unknown as Canvas2DContext;

		render(context, "offscreen-compatible", { size: 24 });
		expect(fills.length).toBeGreaterThan(1);
	});

	test("sets dimensions on a structural Canvas-like surface", () => {
		const context = {
			fillStyle: "",
			save() {},
			restore() {},
			clearRect() {},
			fillRect() {},
		} as unknown as Canvas2DContext;
		const surface = {
			width: 0,
			height: 0,
			getContext: () => context,
		};

		render(surface, "surface", { width: 96, height: 48 });
		expect(surface.width).toBe(96);
		expect(surface.height).toBe(48);
	});
});

describe.each(PATTERNS)("pattern %s", (pattern) => {
	test("same seed yields identical first-frame output (pixel stability)", () => {
		const a = toSVG("null-frog", { pattern });
		const b = toSVG("null-frog", { pattern });
		expect(a).toBe(b);
	});

	test("string and number seeds agree when equal", () => {
		const s = seedFromString("hop");
		expect(toSVG("hop", { pattern })).toBe(toSVG(s, { pattern }));
	});

	test("different seeds produce different marks", () => {
		expect(toSVG("croak", { pattern })).not.toBe(toSVG("ribbit", { pattern }));
	});

	test("only palette colors are emitted", () => {
		for (const color of fills(toSVG("frogspawn", { pattern, size: 240 }))) {
			expect(PALETTE.has(color)).toBe(true);
		}
	});

	test("presets set the right dimensions", () => {
		expect(toSVG("ribbit", { pattern, preset: "og" })).toContain(
			'width="1200" height="630"',
		);
		expect(toSVG("ribbit", { pattern, preset: "avatar", size: 128 })).toContain(
			'width="128" height="128"',
		);
	});
});

describe("time evolves the field", () => {
	test("dither frame at t>0 differs from the static frame", () => {
		expect(toSVG("ribbit", { pattern: "dither", t: 3 })).not.toBe(
			toSVG("ribbit", { pattern: "dither", t: 0 }),
		);
	});
});

describe("maze composition", () => {
	function directions(svg: string): Map<string, string> {
		const cell = 240 / 12;
		const dirs = new Map<string, string>();
		for (const m of svg.matchAll(
			/<path d="M([\d.-]+) ([\d.-]+) L([\d.-]+) ([\d.-]+)/g,
		)) {
			const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
			const key = `${Math.floor((x1 + x2) / 2 / cell)},${Math.floor((y1 + y2) / 2 / cell)}`;
			dirs.set(key, y1 > y2 ? "/" : "\\");
		}
		return dirs;
	}

	test("draws both diagonal orientations with stable per-cell direction", () => {
		const svg = toSVG("maze-check", { pattern: "maze", size: 240 });
		const again = toSVG("maze-check", { pattern: "maze", size: 240, t: 2 });
		const dirs = directions(svg);
		expect(dirs.size).toBeGreaterThan(10);
		expect(new Set(dirs.values()).size).toBe(2);
		expect(again).not.toBe(svg);
		for (const [key, dir] of directions(again)) {
			if (dirs.has(key)) expect(dirs.get(key)).toBe(dir);
		}
	});

	test("the diagonal skeleton is seeded, not a shared wallpaper", () => {
		const a = directions(toSVG("croak", { pattern: "maze", size: 240 }));
		const b = directions(toSVG("ribbit", { pattern: "maze", size: 240 }));
		let same = 0;
		let differ = 0;
		for (const [key, dir] of a) {
			const other = b.get(key);
			if (other === undefined) continue;
			if (other === dir) same++;
			else differ++;
		}
		expect(same + differ).toBeGreaterThan(10);
		expect(same).toBeGreaterThan(0);
		expect(differ).toBeGreaterThan(0);
	});
});

describe("bars composition", () => {
	test("bars anchor to the cell bottom and scale with tone", () => {
		const svg = toSVG("bars-check", { pattern: "bars", size: 320 });
		const cell = 320 / 16;
		const bars = [
			...svg.matchAll(
				/<rect x="[^"]+" y="([^"]+)" width="[^"]+" height="([^"]+)"/g,
			),
		].map((m) => ({ y: Number(m[1]), height: Number(m[2]) }));
		expect(bars.length).toBeGreaterThan(10);
		for (const bar of bars) {
			expect(bar.height).toBeGreaterThan(0);
			expect(bar.height).toBeLessThanOrEqual(cell + 0.1);
			const bottom = bar.y + bar.height;
			expect(bottom).toBeCloseTo(Math.round(bottom / cell) * cell, 0);
		}
		expect(new Set(bars.map((bar) => bar.height)).size).toBeGreaterThan(3);
	});
});

describe("pulse composition", () => {
	test("dots scale with tone and stay inside their cell", () => {
		const svg = toSVG("pulse-check", { pattern: "pulse", size: 320 });
		const dots = [
			...svg.matchAll(/<circle cx="[^"]+" cy="[^"]+" r="([^"]+)"/g),
		].map((m) => Number(m[1]));
		expect(dots.length).toBeGreaterThan(10);
		const cell = 320 / 16;
		for (const r of dots) {
			expect(r).toBeGreaterThan(0);
			expect(r).toBeLessThanOrEqual(cell / 2);
		}
		expect(new Set(dots).size).toBeGreaterThan(3);
	});

	test("a pointer lights nearby dots via renderReactive", () => {
		const plain = recorder();
		const lit = recorder();
		render(plain.context, "glowing", { size: 240, pattern: "pulse" });
		renderReactive(lit.context, "glowing", {
			size: 240,
			pattern: "pulse",
			pointer: { x: 20, y: 20 },
		});
		const near = (d: { x: number; y: number }) =>
			Math.hypot(d.x - 20, d.y - 20) < 40;
		const sumR = (arcs: typeof plain.arcs) =>
			arcs.filter(near).reduce((s, d) => s + d.r, 0);
		expect(sumR(lit.arcs)).toBeGreaterThan(sumR(plain.arcs));
	});
});

describe("wave composition", () => {
	test("inverted waves are painted back-to-front", () => {
		const svg = toSVG("dew-2", { pattern: "wave" });
		const pathFills = [...svg.matchAll(/<path[^>]+fill="([^"]+)"/g)].map(
			(match) => match[1],
		);

		expect(pathFills.at(-1)).toBe(RAMP[1]);
		expect(new Set(pathFills).size).toBeGreaterThan(3);
	});
});

describe("output shapes and dimensions", () => {
	test("custom rectangular dimensions are supported", () => {
		expect(toSVG("ribbit", { width: 640, height: 360 })).toContain(
			'width="640" height="360"',
		);
	});

	test("circle output clips the artwork and leaves the corners transparent", () => {
		const svg = toSVG("ribbit", {
			preset: "avatar",
			size: 256,
			shape: "circle",
		});
		expect(svg).toContain('<clipPath id="ribbit-circle-');
		expect(svg).toContain('<circle cx="128" cy="128" r="128"/>');
		expect(svg).toMatch(/clip-path="url\(#ribbit-circle-[^)]+\)"/);
	});

	test("rectangle output has no clipping definition", () => {
		expect(toSVG("ribbit", { shape: "rectangle" })).not.toContain("clipPath");
	});

	test("OG dither uses square cells instead of stretching a square grid", () => {
		const svg = toSVG("null-frog", { pattern: "dither", preset: "og" });
		const cells = [
			...svg.matchAll(
				/<rect x="([^"]+)"[^>]+width="([^"]+)" height="([^"]+)"/g,
			),
		];
		const first = cells[0];
		expect(first).toBeDefined();
		const cellWidth = Number(first?.[2]);
		const cellHeight = Number(first?.[3]);
		expect(cellWidth / cellHeight).toBeCloseTo(1, 1);

		const columns = new Set(cells.map((cell) => cell[1]));
		expect(columns.size).toBeGreaterThan(30);
	});
});

describe.each(PATTERNS)("custom palette with pattern %s", (pattern) => {
	test("uses only the requested background and ramp", () => {
		const allowed = new Set([
			CUSTOM_PALETTE.background,
			...CUSTOM_PALETTE.ramp,
		]);
		const svg = toSVG("palette-test", {
			pattern,
			palette: CUSTOM_PALETTE,
		});

		for (const color of fills(svg)) expect(allowed.has(color)).toBe(true);
		expect(svg).toContain(`fill="${CUSTOM_PALETTE.background}"`);
		expect(svg).not.toContain(BG);
	});
});

describe("field", () => {
	test("is deterministic and stays inside the 0..1 tone range", () => {
		const a = field("ribbit");
		const b = field("ribbit");
		const other = field("croak");
		let differs = false;
		for (let i = 0; i <= 10; i++) {
			const u = i / 10;
			for (let j = 0; j <= 10; j++) {
				const v = j / 10;
				const tone = a(u, v, 0.5);
				expect(tone).toBe(b(u, v, 0.5));
				expect(tone).toBeGreaterThanOrEqual(0);
				expect(tone).toBeLessThanOrEqual(1);
				if (other(u, v, 0.5) !== tone) differs = true;
			}
		}
		expect(differs).toBe(true);
	});

	test("accepts the same seed forms as the renderers", () => {
		expect(field("7")(0.3, 0.6, 0)).toBe(
			field(seedFromString("7"))(0.3, 0.6, 0),
		);
	});
});

describe("renderReactive", () => {
	function tones(cells: { color: string }[]) {
		return cells.map((cell) => RAMP.indexOf(cell.color));
	}

	test("with no pointer it draws exactly what render draws", () => {
		const plain = recorder();
		const reactive = recorder();
		render(plain.context, "still", { size: 240 });
		renderReactive(reactive.context, "still", { size: 240 });
		expect(reactive.cells).toEqual(plain.cells);
	});

	test("wave ignores the pointer, since it has no cell grid", () => {
		const plain = recorder();
		const reactive = recorder();
		render(plain.context, "still", { size: 240, pattern: "wave" });
		renderReactive(reactive.context, "still", {
			size: 240,
			pattern: "wave",
			pointer: { x: 10, y: 10 },
		});
		expect(reactive.cells).toEqual(plain.cells);
	});

	test("cells near the pointer climb the ramp, far ones do not move", () => {
		const plain = recorder();
		const lit = recorder();
		render(plain.context, "glowing", { size: 240 });
		renderReactive(lit.context, "glowing", {
			size: 240,
			pointer: { x: 20, y: 20 },
		});

		const near = (cell: { x: number; y: number }) =>
			Math.hypot(cell.x - 20, cell.y - 20) < 40;
		const far = (cell: { x: number; y: number }) =>
			Math.hypot(cell.x - 20, cell.y - 20) > 180;
		const brightness = (cells: typeof plain.cells, where: typeof near) => {
			const picked = tones(cells.filter(where));
			return picked.reduce((sum, tone) => sum + tone, 0) / picked.length;
		};

		expect(brightness(lit.cells, near)).toBeGreaterThan(
			brightness(plain.cells, near),
		);
		expect(brightness(lit.cells, far)).toBeCloseTo(
			brightness(plain.cells, far),
			5,
		);
	});

	test("glowRadius and glowBoost tune the reach and the lift", () => {
		const wide = recorder();
		const narrow = recorder();
		const plain = recorder();
		render(plain.context, "tuned", { size: 240 });
		renderReactive(wide.context, "tuned", {
			size: 240,
			pointer: { x: 120, y: 120 },
			glowRadius: 0.9,
		});
		renderReactive(narrow.context, "tuned", {
			size: 240,
			pointer: { x: 120, y: 120 },
			glowRadius: 0.1,
		});
		const changed = (cells: typeof plain.cells) =>
			cells.filter((cell, i) => cell.color !== plain.cells[i]?.color).length;
		expect(changed(wide.cells)).toBeGreaterThan(changed(narrow.cells));
	});

	test("a pointer only lights cells, it never moves them off the grid", () => {
		const plain = recorder();
		const lit = recorder();
		render(plain.context, "stable", { size: 240 });
		renderReactive(lit.context, "stable", {
			size: 240,
			pointer: { x: 60, y: 60 },
		});
		const at = (cell: { x: number; y: number }) => `${cell.x},${cell.y}`;
		const litCells = new Set(lit.cells.map(at));
		for (const cell of plain.cells) expect(litCells.has(at(cell))).toBe(true);
		const columns = new Set(plain.cells.map((cell) => cell.x));
		const rows = new Set(plain.cells.map((cell) => cell.y));
		for (const cell of lit.cells) {
			expect(columns.has(cell.x)).toBe(true);
			expect(rows.has(cell.y)).toBe(true);
		}
		expect(lit.cells.length).toBeGreaterThan(plain.cells.length);
	});
});

describe("built-in palettes", () => {
	test("ships a dark and a light variant of each family", () => {
		expect(Object.keys(PALETTES)).toEqual([
			"moss",
			"tide",
			"ember",
			"mono",
			"mossLight",
			"tideLight",
			"emberLight",
			"monoLight",
		]);
		for (const palette of Object.values(PALETTES)) {
			expect(palette.ramp.length).toBeGreaterThanOrEqual(2);
		}
	});

	test("a null background leaves the backdrop transparent", () => {
		const clear = { background: null, ramp: RAMP };
		const svg = toSVG("clear", { palette: clear });
		expect(svg).not.toContain(`<rect width="1200"`);
		expect(fills(svg)).not.toContain(BG);

		const painted: string[] = [];
		const context = {
			fillStyle: "",
			save() {},
			restore() {},
			clearRect() {},
			fillRect(...args: number[]) {
				painted.push(`${this.fillStyle}@${args[2]}x${args[3]}`);
			},
		} as unknown as Canvas2DContext;
		render(context, "clear", { size: 480, palette: clear });
		expect(painted).not.toContain(`${BG}@480x480`);
	});

	test("rejects ramps that cannot express a tonal field", () => {
		expect(() =>
			toSVG("flat", {
				palette: { background: "#000000", ramp: ["#ffffff"] },
			}),
		).toThrow("palette.ramp needs at least two colors");
	});
});

describe("animated export", () => {
	test("WebM clearly reports its browser DOM requirement", async () => {
		await expect(toWebM("ribbit")).rejects.toThrow("media export needs a DOM");
	});
});
