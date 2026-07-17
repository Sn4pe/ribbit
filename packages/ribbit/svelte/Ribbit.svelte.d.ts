import type { Component } from "svelte";
import type { Palette, Pattern } from "../dist/index.js";

export interface RibbitProps {
	/** Any string or number. The same seed always yields the same mark. */
	seed: string | number;
	/** Logical pixel size of the square mark. Default 32. */
	size?: number;
	/** Which generative pattern to draw. Default "dither". */
	pattern?: Pattern;
	/** Background and dark-to-light tonal ramp. */
	palette?: Palette;
	/** CSS border-radius. Number = pixels; string = any CSS length. Default "9999px". */
	radius?: number | string;
	/** Run a requestAnimationFrame loop that evolves the field. Default false. */
	animated?: boolean;
	/** Extra class(es) for the canvas element. */
	class?: string;
}

declare const Ribbit: Component<RibbitProps & Record<string, unknown>>;
export default Ribbit;
