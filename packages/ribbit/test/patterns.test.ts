import { describe, expect, test } from "bun:test";
import {
	BG,
	type Pattern,
	RAMP,
	seedFromString,
	toSeed,
	toSVG,
} from "../src/index.ts";

const PATTERNS: Pattern[] = ["dither", "glyph", "wave"];
const PALETTE = new Set<string>([BG, ...RAMP]);

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
