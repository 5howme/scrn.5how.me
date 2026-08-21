import { describe, expect, it } from "vitest";
import { getTextAnimationState, normalizeTextAnimation } from "./annotationTextAnimation";

describe("annotation text animations", () => {
	it("normalizes unknown animation values to none", () => {
		expect(normalizeTextAnimation("rise")).toBe("rise");
		expect(normalizeTextAnimation("not-real")).toBe("none");
		expect(normalizeTextAnimation(undefined)).toBe("none");
	});

	it("returns a settled state when animation is disabled", () => {
		expect(
			getTextAnimationState(
				{
					startMs: 1000,
					style: { textAnimation: "none" },
				},
				1000,
			),
		).toEqual({
			opacity: 1,
			scale: 1,
			translateX: 0,
			translateY: 0,
			revealProgress: 1,
		});
	});

	it("fades out at the same speed near the end for fade animations", () => {
		const annotation = {
			startMs: 1000,
			endMs: 5000,
			style: { textAnimation: "fade" as const },
		};

		expect(getTextAnimationState(annotation, 1000).opacity).toBe(0);
		expect(getTextAnimationState(annotation, 3000).opacity).toBe(1);
		expect(getTextAnimationState(annotation, 5000).opacity).toBe(0);

		// Symmetric: N ms after start matches N ms before end.
		const fadeIn = getTextAnimationState(annotation, 1200).opacity;
		const fadeOut = getTextAnimationState(annotation, 4800).opacity;
		expect(fadeIn).toBeGreaterThan(0);
		expect(fadeIn).toBeLessThan(1);
		expect(fadeOut).toBeCloseTo(fadeIn);
	});

	it("keeps fade-in-only behavior when endMs is not provided", () => {
		const settled = getTextAnimationState(
			{ startMs: 1000, style: { textAnimation: "fade" as const } },
			10_000,
		);
		expect(settled.opacity).toBe(1);
	});

	it("eases rise animations into place over time", () => {
		const initial = getTextAnimationState(
			{
				startMs: 1000,
				style: { textAnimation: "rise" },
			},
			1000,
		);
		const settled = getTextAnimationState(
			{
				startMs: 1000,
				style: { textAnimation: "rise" },
			},
			2000,
		);

		expect(initial.opacity).toBe(0);
		expect(initial.translateY).toBeGreaterThan(0);
		expect(settled.opacity).toBe(1);
		expect(settled.translateY).toBe(0);
	});
});
