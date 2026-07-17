import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toSVG } from "ribbit";

const field = toSVG("null-frog", { preset: "og", pattern: "wave" });
const title = "<title>Ribbit deterministic generative mark</title>";
const overlay = `<rect width="1200" height="630" fill="#0a0d0b" opacity="0.28"/><text x="80" y="330" font-family="'Geist Mono',ui-monospace,monospace" font-size="150" font-weight="600" letter-spacing="-6" fill="#e8f0e4">ribbit<tspan fill="#5c9e63">.</tspan></text><text x="86" y="392" font-family="'Geist Mono',ui-monospace,monospace" font-size="30" fill="#8b9a8a">deterministic generative marks from any seed</text>`;
const out = field
	.replace(">", `>${title}`)
	.replace("</svg>", `${overlay}</svg>`);
const path = fileURLToPath(new URL("../public/og.svg", import.meta.url));
writeFileSync(path, out);
console.log(`wrote ${path} (${out.length} bytes)`);
