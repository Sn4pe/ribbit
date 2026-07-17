import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toSVG } from "ribbit-canvas";

const svg = toSVG("null-frog", {
	preset: "avatar",
	size: 64,
	pattern: "wave",
	shape: "circle",
}).replace(">", "><title>Ribbit mark</title>");
const path = fileURLToPath(new URL("../public/favicon.svg", import.meta.url));
writeFileSync(path, svg);
console.log(`wrote ${path} (${svg.length} bytes)`);
