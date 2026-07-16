import { describe, expect, test } from "bun:test";
import {
	BG,
	PALETTES,
	type Pattern,
	RAMP,
	seedFromString,
	toSeed,
	toSVG,
	toWebM,
} from "../src/index.ts";

const PATTERNS: Pattern[] = ["dither", "glyph", "wave"];
const PALETTE = new Set<string>([BG, ...RAMP]);
const CUSTOM_PALETTE = {
	background: "#101018",
	ramp: ["#201030", "#482060", "#783c96", "#b86bd1", "#f1b4ff"],
} as const;

// Pull every fill="#xxxxxx" out of an SVG string.
function fills(svg: string): string[] {
	return [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
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
	// Glyph/dither share one field, so a later frame should differ from t=0.
	test("dither frame at t>0 differs from the static frame", () => {
		expect(toSVG("ribbit", { pattern: "dither", t: 3 })).not.toBe(
			toSVG("ribbit", { pattern: "dither", t: 0 }),
		);
	});
});

describe("wave composition", () => {
	test("inverted waves are painted back-to-front", () => {
		const svg = toSVG("dew-2", { pattern: "wave" });
		const pathFills = [...svg.matchAll(/<path[^>]+fill="([^"]+)"/g)].map(
			(match) => match[1],
		);

		// The final path sits on top. For an inverted field it must be the
		// shallow dark layer, not the broad bright layer that hides the bands.
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

describe("built-in palettes", () => {
	test("ships moss, tide, ember and mono", () => {
		expect(Object.keys(PALETTES)).toEqual(["moss", "tide", "ember", "mono"]);
		for (const palette of Object.values(PALETTES)) {
			expect(palette.ramp.length).toBeGreaterThanOrEqual(2);
		}
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
