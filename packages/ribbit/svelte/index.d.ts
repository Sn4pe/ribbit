import type { Component } from "svelte";
import type { Palette, Pattern, Shape } from "../dist/index.js";

export interface RibbitProps {
	/** Any string or number. The same seed always yields the same mark. */
	seed: string | number;
	/** Logical pixel size of the square mark. Default 64. */
	size?: number;
	/** Which generative pattern to draw. Default "dither". */
	pattern?: Pattern;
	/** Full rectangle or a transparent circular crop. Default "rectangle". */
	shape?: Shape;
	/** Background and dark-to-light tonal ramp. */
	palette?: Palette;
	/** CSS border-radius for the canvas. Default "50%". */
	radius?: string;
	/** Run a requestAnimationFrame loop that evolves the field. Default false. */
	animated?: boolean;
	/** Extra class(es) for the canvas element. */
	class?: string;
}

declare const Ribbit: Component<RibbitProps>;
export default Ribbit;
