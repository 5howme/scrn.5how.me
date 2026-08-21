import { describe, expect, it } from "vitest";
import {
	computeCompositeLayout,
	pipPresenceAt,
	SQUARE_WEBCAM_BORDER_RADIUS,
} from "./compositeLayout";

describe("computeCompositeLayout", () => {
	it("anchors the overlay in the lower-right corner", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
		});

		expect(layout).not.toBeNull();
		expect(layout!.webcamRect).not.toBeNull();
		expect(layout!.webcamRect!.x + layout!.webcamRect!.width).toBeLessThanOrEqual(1920);
		expect(layout!.webcamRect!.y + layout!.webcamRect!.height).toBeLessThanOrEqual(1080);
		expect(layout!.webcamRect!.x).toBeGreaterThan(1920 / 2);
		expect(layout!.webcamRect!.y).toBeGreaterThan(1080 / 2);
	});

	it("scales small screen content up to the export canvas when no padding is applied", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1280, height: 720 },
			screenSize: { width: 854, height: 480 },
		});

		expect(layout).not.toBeNull();
		expect(layout!.screenRect).toEqual({
			x: 0,
			y: 0,
			width: 1280,
			height: 720,
		});
	});

	it("fits the overlay in the default 256×256 box", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1280, height: 720 },
			screenSize: { width: 1280, height: 720 },
			webcamSize: { width: 1920, height: 1080 },
			// The preview passes its own absolute scale; at scale 1 the canonical
			// box maps 1:1 onto the canvas.
			absoluteRadiusScale: 1,
		});

		expect(layout).not.toBeNull();
		expect(layout!.webcamRect).not.toBeNull();
		expect(layout!.webcamRect!.width).toBe(256);
		expect(layout!.webcamRect!.height).toBe(256);
	});

	it("produces consistent webcam size across landscape and portrait aspect ratios", () => {
		const webcamSize = { width: 1280, height: 720 };
		const landscape = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize,
			webcamSizePx: { width: 400, height: 224 },
		});
		const portrait = computeCompositeLayout({
			canvasSize: { width: 1080, height: 1920 },
			screenSize: { width: 1080, height: 1920 },
			webcamSize,
			webcamSizePx: { width: 400, height: 224 },
		});

		expect(landscape).not.toBeNull();
		expect(portrait).not.toBeNull();
		// Same canonical long side (1920), so the box renders identically.
		const landscapeArea = landscape!.webcamRect!.width * landscape!.webcamRect!.height;
		const portraitArea = portrait!.webcamRect!.width * portrait!.webcamRect!.height;
		expect(landscapeArea).toBe(portraitArea);
	});

	it("sizes the webcam to the exact width×height box in output px", () => {
		const canvasSize = { width: 1920, height: 1080 };
		const screenSize = { width: 1920, height: 1080 };
		const webcamSize = { width: 1280, height: 720 };

		const wide = computeCompositeLayout({
			canvasSize,
			screenSize,
			webcamSize,
			webcamSizePx: { width: 400, height: 112 },
		});
		const tall = computeCompositeLayout({
			canvasSize,
			screenSize,
			webcamSize,
			webcamSizePx: { width: 200, height: 600 },
		});

		// Both dimensions are honored exactly; the source is cover-cropped.
		expect(wide!.webcamRect!.width).toBe(400);
		expect(wide!.webcamRect!.height).toBe(112);
		expect(tall!.webcamRect!.width).toBe(200);
		expect(tall!.webcamRect!.height).toBe(600);
	});

	it("clamps the webcam box to 32–1920 on both axes", () => {
		const canvasSize = { width: 1920, height: 1080 };
		const screenSize = { width: 1920, height: 1080 };
		const webcamSize = { width: 1280, height: 720 };

		const belowMin = computeCompositeLayout({
			canvasSize,
			screenSize,
			webcamSize,
			webcamSizePx: { width: 1, height: 1 },
		});
		const aboveMax = computeCompositeLayout({
			canvasSize,
			screenSize,
			webcamSize,
			webcamSizePx: { width: 4096, height: 4096 },
		});

		expect(belowMin!.webcamRect!.width).toBe(32);
		expect(belowMin!.webcamRect!.height).toBe(32);
		expect(aboveMax!.webcamRect!.width).toBe(1920);
		// Both axes clamp at the canonical long side so portrait sources fit
		// a portrait canvas.
		expect(aboveMax!.webcamRect!.height).toBe(1920);
	});

	it("places the PIP webcam in the chosen corner", () => {
		const base = {
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			webcamSizePx: { width: 200, height: 112 },
			pipMarginPx: 16,
		} as const;
		const topLeft = computeCompositeLayout({ ...base, pipCorner: "top-left" });
		expect(topLeft!.webcamRect!.x).toBe(16);
		expect(topLeft!.webcamRect!.y).toBe(16);
		const bottomLeft = computeCompositeLayout({ ...base, pipCorner: "bottom-left" });
		expect(bottomLeft!.webcamRect!.x).toBe(16);
		expect(bottomLeft!.webcamRect!.y).toBe(1080 - 16 - 112);
		const topRight = computeCompositeLayout({ ...base, pipCorner: "top-right" });
		expect(topRight!.webcamRect!.x).toBe(1920 - 16 - 200);
		expect(topRight!.webcamRect!.y).toBe(16);
	});

	it("slides the PIP screen away from a left-side webcam", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1856, height: 1016 },
			screenSize: { width: 960, height: 1016 },
			webcamSize: { width: 1280, height: 720 },
			webcamSizePx: { width: 200, height: 112 },
			pipCorner: "bottom-left",
			pipPresence: 1,
		});
		// Fully present: right edge sits at the padding inset (webcam on the left).
		expect(layout!.screenRect.x).toBe(1920 - 32 - 960);
	});

	it("puts the dual-frame camera slot on the chosen side", () => {
		const base = {
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1856, height: 1016 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			layoutPreset: "dual-frame",
			slotGapPx: 32,
		} as const;
		const left = computeCompositeLayout({ ...base, dualCameraSide: "left" });
		const right = computeCompositeLayout({ ...base, dualCameraSide: "right" });
		// Camera-left: the webcam starts at the content inset and the screen follows it.
		expect(left!.webcamRect!.x).toBe(32);
		expect(left!.screenRect.x).toBe(32 + left!.webcamRect!.width + 32);
		// Camera-right matches the default layout.
		expect(right!.webcamRect!.x).toBeGreaterThan(right!.screenRect.x);
	});

	it("uses half the screen padding as the PIP default corner inset", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			webcamSizePx: { width: 200, height: 112 },
			pipMarginPx: 16, // padding 32 / 2
		});
		expect(layout!.webcamRect!.x).toBe(1920 - 16 - 200);
		expect(layout!.webcamRect!.y).toBe(1080 - 16 - 112);
	});

	it("uses the screen padding as the dual-frame slot gap", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1856, height: 1016 }, // padding 32
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			layoutPreset: "dual-frame",
			slotGapPx: 32,
		});
		const screen = layout!.screenRect;
		const webcam = layout!.webcamRect!;
		expect(webcam.x - (screen.x + screen.width)).toBe(32);
		// Camera slot is 9:16 of the content height (1016).
		expect(webcam.width).toBe(Math.round((1016 * 9) / 16));
		expect(webcam.height).toBe(1016);
	});

	it("shrinks the dual-frame screen from centered layout with presence", () => {
		const base = {
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1856, height: 1016 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			layoutPreset: "dual-frame",
		} as const;
		const collapsed = computeCompositeLayout({ ...base, pipPresence: 0 });
		const expanded = computeCompositeLayout({ ...base, pipPresence: 1 });
		const halfway = computeCompositeLayout({ ...base, pipPresence: 0.5 });

		// Presence 0 matches the plain centered layout (no dual-frame shrink yet).
		const centered = computeCompositeLayout({
			canvasSize: base.canvasSize,
			maxContentSize: base.maxContentSize,
			screenSize: base.screenSize,
			layoutPreset: "no-webcam",
		});
		expect(collapsed?.screenRect).toEqual(centered?.screenRect);
		expect(halfway!.screenRect.width).toBeLessThan(collapsed!.screenRect.width);
		expect(halfway!.screenRect.width).toBeGreaterThan(expanded!.screenRect.width);
	});

	it("fades PIP presence over 400ms at span edges", () => {
		const spans = [{ startMs: 1000, endMs: 5000 }];
		expect(pipPresenceAt(spans, 500)).toBe(0);
		expect(pipPresenceAt(spans, 1000)).toBe(0);
		expect(pipPresenceAt(spans, 1400)).toBe(1);
		expect(pipPresenceAt(spans, 3000)).toBe(1);
		expect(pipPresenceAt(spans, 5000)).toBe(0);
		expect(pipPresenceAt(spans, 6000)).toBe(0);
		// Mid-transition values stay strictly between 0 and 1.
		const midIn = pipPresenceAt(spans, 1200);
		expect(midIn).toBeGreaterThan(0);
		expect(midIn).toBeLessThan(1);
	});

	it("slides the PIP screen from center to left-aligned with presence", () => {
		const base = {
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1856, height: 1016 }, // padding 32
			screenSize: { width: 960, height: 1016 },
			webcamSize: { width: 1280, height: 720 },
			webcamSizePx: { width: 200, height: 112 },
		} as const;
		const centered = computeCompositeLayout({ ...base, pipPresence: 0 });
		const shifted = computeCompositeLayout({ ...base, pipPresence: 1 });
		const halfway = computeCompositeLayout({ ...base, pipPresence: 0.5 });

		expect(centered?.screenRect.x).toBe(Math.round((1920 - 960) / 2));
		// Fully present: left edge sits at the padding inset.
		expect(shifted?.screenRect.x).toBe(Math.round((1920 - 1856) / 2));
		expect(halfway?.screenRect.x).toBeGreaterThan(shifted?.screenRect.x ?? 0);
		expect(halfway?.screenRect.x).toBeLessThan(centered?.screenRect.x ?? 0);
	});

	it("rounds the PIP rect webcam at half the screen roundness", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			webcamSizePx: { width: 200, height: 112 },
			screenRoundnessPx: 16,
		});
		expect(layout!.webcamRect!.borderRadius).toBe(8);
	});

	it("snaps rounding-only source aspect gaps to the full canvas", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 319, height: 199 },
			maxContentSize: { width: 319, height: 199 },
			screenSize: { width: 1680, height: 1050 },
		});

		expect(layout?.screenRect).toEqual({
			x: 0,
			y: 0,
			width: 319,
			height: 199,
		});
	});

	it("centers the combined screen and webcam stack in vertical stack mode", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1536, height: 864 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			layoutPreset: "vertical-stack",
		});

		expect(layout).not.toBeNull();
		// Webcam is full-width at the bottom
		expect(layout!.webcamRect).not.toBeNull();
		expect(layout!.webcamRect!.x).toBe(0);
		expect(layout!.webcamRect!.width).toBe(1920);
		expect(layout!.webcamRect!.borderRadius).toBe(0);
		// Screen fills remaining space at the top (cover mode)
		expect(layout!.screenRect.x).toBe(0);
		expect(layout!.screenRect.y).toBe(0);
		expect(layout!.screenRect.width).toBe(1920);
		expect(layout!.screenCover).toBe(true);
	});

	it("keeps the screen full-canvas and omits the webcam when dimensions are unavailable in stack mode", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1536, height: 864 },
			screenSize: { width: 1920, height: 1080 },
			layoutPreset: "vertical-stack",
		});

		expect(layout).not.toBeNull();
		expect(layout?.screenRect).toEqual({
			x: 0,
			y: 0,
			width: 1920,
			height: 1080,
		});
		expect(layout?.webcamRect).toBeNull();
		expect(layout?.screenCover).toBe(true);
	});

	it("gives the dual-frame camera a 9:16 slot and the screen the rest", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1536, height: 864 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			layoutPreset: "dual-frame",
		});

		expect(layout).not.toBeNull();
		expect(layout?.webcamRect).not.toBeNull();
		expect(layout?.screenRect.y).toBe(108);
		expect(layout?.screenRect.height).toBe(864);
		expect(layout?.screenBorderRadius).toBe(layout?.webcamRect?.borderRadius);
		expect(layout?.webcamRect?.y).toBe(108);
		expect(layout?.webcamRect?.height).toBe(864);
		expect(layout?.webcamRect?.x).toBeGreaterThan(layout?.screenRect.x ?? 0);
		// Camera slot width = content height × 9/16.
		expect(layout?.webcamRect?.width).toBe(Math.round((864 * 9) / 16));
		expect(layout?.screenCover).toBe(true);
	});

	it("forces circular and square masks to use square dimensions", () => {
		const circularLayout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			webcamMaskShape: "circle",
		});
		const squareLayout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			webcamMaskShape: "square",
		});

		expect(circularLayout?.webcamRect).not.toBeNull();
		expect(squareLayout?.webcamRect).not.toBeNull();
		expect(circularLayout?.webcamRect?.width).toBe(circularLayout?.webcamRect?.height);
		expect(squareLayout?.webcamRect?.width).toBe(squareLayout?.webcamRect?.height);
		expect(circularLayout?.webcamRect?.maskShape).toBe("circle");
		expect(squareLayout?.webcamRect?.maskShape).toBe("square");
	});

	it("applies the user's roundness to both dual-frame slots as absolute px", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1536, height: 864 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			layoutPreset: "dual-frame",
			screenRoundnessPx: 10,
		});
		expect(layout?.screenBorderRadius).toBe(10);
		expect(layout?.webcamRect?.borderRadius).toBe(10);

		// The exporter's canvas-scale factor scales the absolute value.
		const scaled = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1536, height: 864 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			layoutPreset: "dual-frame",
			screenRoundnessPx: 10,
			absoluteRadiusScale: 1.5,
		});
		expect(scaled?.screenBorderRadius).toBe(15);
		expect(scaled?.webcamRect?.borderRadius).toBe(15);
	});

	it("uses a fixed size-independent rounding for the square mask", () => {
		const layoutAt = (sidePx: number, absoluteRadiusScale?: number) =>
			computeCompositeLayout({
				canvasSize: { width: 1920, height: 1080 },
				screenSize: { width: 1920, height: 1080 },
				webcamSize: { width: 1280, height: 720 },
				webcamMaskShape: "square",
				webcamSizePx: { width: sidePx, height: sidePx },
				absoluteRadiusScale,
			});

		// Same 8px radius no matter how large the webcam is rendered.
		expect(layoutAt(64)?.webcamRect?.borderRadius).toBe(SQUARE_WEBCAM_BORDER_RADIUS);
		expect(layoutAt(400)?.webcamRect?.borderRadius).toBe(SQUARE_WEBCAM_BORDER_RADIUS);
		// The exporter's canvas-scale factor scales the absolute radius.
		expect(layoutAt(400, 2)?.webcamRect?.borderRadius).toBe(SQUARE_WEBCAM_BORDER_RADIUS * 2);
	});

	it("applies larger rounding for the rounded webcam mask", () => {
		const roundedLayout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			webcamMaskShape: "rounded",
		});
		const rectangleLayout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			webcamMaskShape: "rectangle",
		});

		expect(roundedLayout?.webcamRect).not.toBeNull();
		expect(rectangleLayout?.webcamRect).not.toBeNull();
		expect(roundedLayout?.webcamRect?.borderRadius).toBeGreaterThan(
			rectangleLayout?.webcamRect?.borderRadius ?? 0,
		);
		expect(roundedLayout?.webcamRect?.maskShape).toBe("rounded");
	});
});
