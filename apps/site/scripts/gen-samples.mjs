import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toSVG } from "ribbit-canvas";

// Same (seed, pattern) pairs as the docs site's live grid — already vetted
// there, so this skips re-discovering which seeds render cleanly per pattern.
const tiles = [
	{ seed: "croak", pattern: "dither" },
	{ seed: "marsh", pattern: "glyph" },
	{ seed: "lily", pattern: "wave" },
	{ seed: "frogspawn", pattern: "dither" },
	{ seed: "reed", pattern: "glyph" },
	{ seed: "pond", pattern: "wave" },
	{ seed: "null-frog", pattern: "dither" },
	{ seed: "brack", pattern: "glyph" },
	{ seed: "moss", pattern: "wave" },
	{ seed: "spore", pattern: "dither" },
	{ seed: "moss-2", pattern: "glyph" },
	{ seed: "bog", pattern: "wave" },
];
const tile = 140;
const gap = 10;
const cols = 4;

const cells = tiles.map(({ seed, pattern }, i) => {
	const svg = toSVG(seed, { width: tile, height: tile, pattern });
	const inner = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
	const col = i % cols;
	const row = Math.floor(i / cols);
	const x = col * (tile + gap);
	const y = row * (tile + gap);
	return `<g transform="translate(${x},${y})">${inner}</g>`;
});

const rows = Math.ceil(tiles.length / cols);
const width = cols * tile + (cols - 1) * gap;
const height = rows * tile + (rows - 1) * gap;
const bg = `<rect width="${width}" height="${height}" fill="#0a0d0b"/>`;
const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Ribbit sample marks</title>${bg}${cells.join("")}</svg>`;

const path = fileURLToPath(new URL("../../../samples.svg", import.meta.url));
writeFileSync(path, out);
console.log(`wrote ${path} (${out.length} bytes)`);
