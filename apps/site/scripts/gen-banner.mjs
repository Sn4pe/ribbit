import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toSVG } from "ribbit-canvas";

const field = toSVG("null-frog", { width: 1200, height: 300, pattern: "wave" });
const title = "<title>Ribbit deterministic generative mark</title>";
const overlay = `<rect width="1200" height="300" fill="#0a0d0b" opacity="0.55"/><text x="60" y="150" font-family="'Geist Mono',ui-monospace,monospace" font-size="72" font-weight="600" letter-spacing="-3" fill="#e8f0e4">ribbit<tspan fill="#86c765">.</tspan></text><text x="64" y="192" font-family="'Geist Mono',ui-monospace,monospace" font-size="20" fill="#c3cfc0">deterministic generative marks from any seed</text>`;
const out = field
	.replace(">", `>${title}`)
	.replace("</svg>", `${overlay}</svg>`);
const path = fileURLToPath(new URL("../../../banner.svg", import.meta.url));
writeFileSync(path, out);
console.log(`wrote ${path} (${out.length} bytes)`);
