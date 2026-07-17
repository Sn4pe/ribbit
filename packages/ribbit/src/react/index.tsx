"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { type Palette, type Pattern, render, toSeed } from "../index.js";

export interface RibbitAvatarProps {
	/** Any string or number. The same seed always yields the same mark. */
	seed: string | number;
	/** Rendered size in CSS pixels. Default 32. */
	size?: number;
	/** Which generative pattern to draw. Default "dither". */
	pattern?: Pattern;
	/** CSS corner radius. Number = pixels; string = any CSS length. Default circle. */
	radius?: number | string;
	/** Background and dark-to-light tonal ramp. */
	palette?: Palette;
	/** Evolve the mark over time. Default false. */
	animated?: boolean;
	/** Extra classes for the clipping wrapper. */
	className?: string;
	/** Extra inline styles for the clipping wrapper. */
	style?: CSSProperties;
}

/**
 * A compact, deterministic avatar component for React.
 *
 * `radius` controls presentation only. Use the framework-agnostic export
 * helpers with `shape: "circle"` when the generated file needs transparent
 * corners.
 */
export function RibbitAvatar({
	seed,
	size = 32,
	pattern = "dither",
	radius = "9999px",
	palette,
	animated = false,
	className,
	style,
}: RibbitAvatarProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = Math.round(size * dpr);
		canvas.height = Math.round(size * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const normalizedSeed = toSeed(seed);
		const paint = (t: number) =>
			render(ctx, normalizedSeed, { size, pattern, palette, t });
		paint(0);

		if (
			!animated ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}

		let animationFrame = 0;
		let started = 0;
		let onScreen = true;
		const observer = new IntersectionObserver(
			(entries) => {
				onScreen = entries[0]?.isIntersecting ?? true;
			},
			{ threshold: 0 },
		);
		observer.observe(canvas);

		const frame = (now: number) => {
			if (!started) started = now;
			if (onScreen) paint((now - started) / 1000);
			animationFrame = requestAnimationFrame(frame);
		};
		animationFrame = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(animationFrame);
			observer.disconnect();
		};
	}, [animated, palette, pattern, seed, size]);

	return (
		<span
			className={className}
			style={{
				display: "inline-block",
				overflow: "hidden",
				borderRadius: radius,
				width: size,
				height: size,
				...style,
			}}
		>
			<canvas
				ref={canvasRef}
				style={{ display: "block", width: "100%", height: "100%" }}
			/>
		</span>
	);
}
