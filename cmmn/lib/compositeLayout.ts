export interface RenderRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Floor for the reactive webcam multiplier so the camera never shrinks below ~35% at deep zoom. */
export const WEBCAM_REACTIVE_ZOOM_MIN_SCALE = 0.35;

/**
 * Maps the live zoom scale to a webcam size multiplier, inversely (2x zoom, half size; 3x, a
 * third) so the camera stays out of the way while zoomed and returns to full size as zoom eases
 * back. Clamped to a floor so it never disappears. appliedScale is already eased per frame, so
 * the camera animates in sync for free.
 */
export function reactiveWebcamScale(zoomScale: number): number {
	const safe = Number.isFinite(zoomScale) && zoomScale > 0 ? zoomScale : 1;
	return Math.max(WEBCAM_REACTIVE_ZOOM_MIN_SCALE, Math.min(1, 1 / safe));
}

export interface StyledRenderRect extends RenderRect {
	borderRadius: number;
	maskShape?: import("@/lib/types").WebcamMaskShape;
}

export interface Size {
	width: number;
	height: number;
}

export type WebcamLayoutPreset =
	| "picture-in-picture"
	| "vertical-stack"
	| "dual-frame"
	| "no-webcam";
/** Webcam size as a percentage of the canvas reference dimension (10–50). */

export interface WebcamLayoutShadow {
	color: string;
	blur: number;
	offsetX: number;
	offsetY: number;
}

interface BorderRadiusRule {
	max: number;
	min: number;
	fraction: number;
}

interface OverlayTransform {
	type: "overlay";
	marginFraction: number;
	minMargin: number;
	minSize: number;
}

interface StackTransform {
	type: "stack";
	gap: number;
}

interface SplitTransform {
	type: "split";
	gapFraction: number;
	minGap: number;
	screenUnits: number;
	webcamUnits: number;
}

export interface WebcamLayoutPresetDefinition {
	label: string;
	transform: OverlayTransform | StackTransform | SplitTransform;
	borderRadius: BorderRadiusRule;
	shadow: WebcamLayoutShadow | null;
}

export interface WebcamCompositeLayout {
	screenRect: RenderRect;
	webcamRect: StyledRenderRect | null;
	screenBorderRadius?: number;
	/** When true, the video should be scaled to cover screenRect (cropping overflow). */
	screenCover?: boolean;
}

/**
 * All absolute px settings (webcam size, padding, roundness, PIP margin…) are
 * expressed in a canonical output canvas whose LONG side is 1920px (16:9 →
 * 1920×1080, 9:16 → 1080×1920). Every renderer converts with its own scale, so
 * the numbers are exact output pixels and independent of the preview size.
 */
export const CANONICAL_LONG_SIDE_PX = 1920;

/** Canvas-px-per-canonical-px scale for a render surface of the given size. */
export function absolutePxScale(canvasWidth: number, canvasHeight: number): number {
	const longSide = Math.max(canvasWidth, canvasHeight);
	return longSide > 0 ? longSide / CANONICAL_LONG_SIDE_PX : 1;
}

/**
 * Webcam box size limits in canonical output px. Both axes allow up to the
 * canonical long side (1920) so portrait sources can fill a portrait canvas.
 */
export const MIN_WEBCAM_SIZE_PX = 32;
export const MAX_WEBCAM_WIDTH_PX = 1920;
export const MAX_WEBCAM_HEIGHT_PX = 1920;

function clampWebcamWidthPx(px: number): number {
	const safe = Number.isFinite(px) ? px : 256;
	return Math.max(MIN_WEBCAM_SIZE_PX, Math.min(MAX_WEBCAM_WIDTH_PX, safe));
}

function clampWebcamHeightPx(px: number): number {
	const safe = Number.isFinite(px) ? px : 288;
	return Math.max(MIN_WEBCAM_SIZE_PX, Math.min(MAX_WEBCAM_HEIGHT_PX, safe));
}

const MARGIN_FRACTION = 0.02;
const MAX_BORDER_RADIUS = 24;
/** Duration of the PIP fade in/out and the main-screen center↔left slide. */
export const PIP_TRANSITION_MS = 400;

/**
 * 0→1 envelope of picture-in-picture presence at `timeMs` across the spans
 * where PIP content (webcam or camera clip) is visible: eases in over the
 * first PIP_TRANSITION_MS of a span and back out over its last
 * PIP_TRANSITION_MS. Drives both the PIP fade and the screen slide.
 */
export function pipPresenceAt(
	spans: ReadonlyArray<{ startMs: number; endMs: number }>,
	timeMs: number,
): number {
	let presence = 0;
	for (const span of spans) {
		if (timeMs < span.startMs || timeMs >= span.endMs) continue;
		const fadeIn = Math.min(1, (timeMs - span.startMs) / PIP_TRANSITION_MS);
		const fadeOut = Math.min(1, (span.endMs - timeMs) / PIP_TRANSITION_MS);
		presence = Math.max(presence, Math.max(0, Math.min(fadeIn, fadeOut)));
	}
	// Smoothstep for a soft start/end.
	return presence * presence * (3 - 2 * presence);
}
/** Fixed corner rounding for the "square" camera shape (preview px; size-independent). */
export const SQUARE_WEBCAM_BORDER_RADIUS = 8;
const WEBCAM_LAYOUT_PRESET_MAP: Record<WebcamLayoutPreset, WebcamLayoutPresetDefinition> = {
	"picture-in-picture": {
		label: "Picture in Picture",
		transform: {
			type: "overlay",
			marginFraction: MARGIN_FRACTION,
			minMargin: 0,
			minSize: 0,
		},
		borderRadius: {
			max: MAX_BORDER_RADIUS,
			min: 12,
			fraction: 0.12,
		},
		shadow: {
			color: "rgba(0,0,0,0.35)",
			blur: 24,
			offsetX: 0,
			offsetY: 10,
		},
	},
	"vertical-stack": {
		label: "Vertical Stack",
		transform: {
			type: "stack",
			gap: 0,
		},
		borderRadius: {
			max: 0,
			min: 0,
			fraction: 0,
		},
		shadow: null,
	},
	"dual-frame": {
		label: "Dual Frame",
		transform: {
			type: "split",
			gapFraction: 0.02,
			minGap: 12,
			screenUnits: 2,
			webcamUnits: 1,
		},
		borderRadius: {
			max: MAX_BORDER_RADIUS,
			min: 12,
			fraction: 0.06,
		},
		shadow: null,
	},
	"no-webcam": {
		label: "No Webcam",
		transform: {
			type: "overlay",
			marginFraction: 0,
			minMargin: 0,
			minSize: 0,
		},
		borderRadius: {
			max: 0,
			min: 0,
			fraction: 0,
		},
		shadow: null,
	},
};

export const WEBCAM_LAYOUT_PRESETS = Object.entries(WEBCAM_LAYOUT_PRESET_MAP).map(
	([value, preset]) => ({
		value: value as WebcamLayoutPreset,
		label: preset.label,
	}),
);

export function getWebcamLayoutPresetDefinition(
	preset: WebcamLayoutPreset = "picture-in-picture",
): WebcamLayoutPresetDefinition {
	return WEBCAM_LAYOUT_PRESET_MAP[preset];
}

export function getWebcamLayoutCssBoxShadow(
	preset: WebcamLayoutPreset = "picture-in-picture",
): string {
	const shadow = getWebcamLayoutPresetDefinition(preset).shadow;
	return shadow
		? `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`
		: "none";
}

export function computeCompositeLayout(params: {
	canvasSize: Size;
	maxContentSize?: Size;
	screenSize: Size;
	webcamSize?: Size | null;
	layoutPreset?: WebcamLayoutPreset;
	/** Webcam slot box in canonical output px (see CANONICAL_LONG_SIDE_PX). */
	webcamSizePx?: Size;
	webcamPosition?: { cx: number; cy: number } | null;
	webcamMaskShape?: import("@/lib/types").WebcamMaskShape;
	/**
	 * Canvas-pixels-per-preview-pixel for absolute (non-fractional) radii like
	 * the square shape's fixed rounding. 1 in the editor preview; the exporter
	 * passes its export/preview ratio so the output looks like the preview.
	 */
	absoluteRadiusScale?: number;
	/**
	 * The user's Roundness setting (preview px). When set, split layouts like
	 * dual-frame round both slots with this absolute value instead of their
	 * size-proportional preset rule, and the PIP rect-shaped webcam rounds at
	 * half of it.
	 */
	screenRoundnessPx?: number;
	/**
	 * Default corner inset (preview px) for the PIP webcam when it hasn't been
	 * dragged — callers pass half the screen padding.
	 */
	pipMarginPx?: number;
	/**
	 * PIP presence envelope (0-1, see pipPresenceAt). While camera content
	 * shows, picture-in-picture slides the main screen from horizontal center
	 * (0) to left-aligned (1), and dual-frame shrinks it from the centered
	 * full layout (0) into its 2/3 slot (1).
	 */
	pipPresence?: number;
	/** Gap between the dual-frame slots (preview px) — callers pass the screen padding. */
	slotGapPx?: number;
	/** Corner the PIP webcam sits in (default bottom-right). The main screen
	 * slides away from the webcam's horizontal side while PIP is present. */
	pipCorner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
	/** Which side the dual-frame camera slot occupies (default right). */
	dualCameraSide?: "left" | "right";
}): WebcamCompositeLayout | null {
	const {
		canvasSize,
		maxContentSize = canvasSize,
		screenSize,
		webcamSize,
		layoutPreset = "picture-in-picture",
		webcamSizePx = { width: 256, height: 256 },
		webcamPosition,
		webcamMaskShape = "rectangle",
		absoluteRadiusScale = 1,
		screenRoundnessPx,
		pipMarginPx,
		pipPresence,
		slotGapPx,
		pipCorner = "bottom-right",
		dualCameraSide = "right",
	} = params;
	const { width: canvasWidth, height: canvasHeight } = canvasSize;
	const { width: screenWidth, height: screenHeight } = screenSize;

	// no-webcam: hide the webcam, screen fills the canvas normally.
	if (layoutPreset === "no-webcam") {
		const screenRect = centerRect({
			canvasSize,
			size: screenSize,
			maxSize: maxContentSize,
		});
		return { screenRect, webcamRect: null };
	}

	const webcamWidth = webcamSize?.width;
	const webcamHeight = webcamSize?.height;
	const preset = getWebcamLayoutPresetDefinition(layoutPreset);

	if (canvasWidth <= 0 || canvasHeight <= 0 || screenWidth <= 0 || screenHeight <= 0) {
		return null;
	}

	if (preset.transform.type === "stack") {
		if (!webcamWidth || !webcamHeight || webcamWidth <= 0 || webcamHeight <= 0) {
			// No webcam, so screen fills the whole canvas (cover mode).
			return {
				screenRect: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
				webcamRect: null,
				screenCover: true,
			};
		}

		// Webcam: full width at the bottom, keeping aspect ratio.
		const webcamAspect = webcamWidth / webcamHeight;
		const resolvedWebcamWidth = canvasWidth;
		const resolvedWebcamHeight = Math.round(canvasWidth / webcamAspect);

		// Screen: fills remaining space at the top (cover mode, may crop sides).
		const screenRectHeight = canvasHeight - resolvedWebcamHeight;

		return {
			screenRect: {
				x: 0,
				y: 0,
				width: canvasWidth,
				height: Math.max(0, screenRectHeight),
			},
			webcamRect: {
				x: 0,
				y: Math.max(0, screenRectHeight),
				width: resolvedWebcamWidth,
				height: resolvedWebcamHeight,
				borderRadius: 0,
			},
			screenCover: true,
		};
	}

	if (preset.transform.type === "split") {
		const screenRect = centerRect({
			canvasSize,
			size: screenSize,
			maxSize: maxContentSize,
		});

		if (!webcamWidth || !webcamHeight || webcamWidth <= 0 || webcamHeight <= 0) {
			return { screenRect, webcamRect: null };
		}

		const contentWidth = Math.min(canvasWidth, Math.max(1, Math.round(maxContentSize.width)));
		const contentHeight = Math.min(canvasHeight, Math.max(1, Math.round(maxContentSize.height)));
		const contentX = Math.max(0, Math.floor((canvasWidth - contentWidth) / 2));
		const contentY = Math.max(0, Math.floor((canvasHeight - contentHeight) / 2));
		// The gap between the two slots equals the screen padding when provided.
		const gap =
			slotGapPx != null
				? Math.max(preset.transform.minGap, Math.round(slotGapPx * absoluteRadiusScale))
				: Math.max(
						preset.transform.minGap,
						Math.round(contentWidth * preset.transform.gapFraction),
					);
		const availableWidth = Math.max(1, contentWidth - gap);
		// The camera slot is exactly 9:16 of the content height (talking-head
		// portrait); the screen takes the rest. Clamped to half the width so the
		// main screen always stays the larger pane on unusual canvases.
		const nineSixteenWidth = Math.round((contentHeight * 9) / 16);
		const webcamSlotWidth = Math.max(1, Math.min(nineSixteenWidth, Math.floor(availableWidth / 2)));
		const screenSlotWidth = Math.max(1, availableWidth - webcamSlotWidth);

		// Camera slot sits on the chosen side; the screen takes the other.
		const cameraOnLeft = dualCameraSide === "left";
		const screenSlot = {
			x: cameraOnLeft ? contentX + webcamSlotWidth + gap : contentX,
			y: contentY,
			width: screenSlotWidth,
			height: contentHeight,
		};
		const webcamSlot = {
			x: cameraOnLeft ? contentX : contentX + screenSlotWidth + gap,
			y: contentY,
			width: webcamSlotWidth,
			height: contentHeight,
		};

		const webcamBorderRadius =
			screenRoundnessPx != null
				? Math.round(screenRoundnessPx * absoluteRadiusScale)
				: Math.min(
						preset.borderRadius.max,
						Math.max(
							preset.borderRadius.min,
							Math.round(
								Math.min(webcamSlot.width, webcamSlot.height) * preset.borderRadius.fraction,
							),
						),
					);

		// Transition: interpolate the main screen between the centered full layout
		// (presence 0) and its 2/3 slot (presence 1). At 0 the rect keeps the
		// video's own aspect ratio, so cover mode degenerates to a plain fit.
		const presence = pipPresence != null ? Math.max(0, Math.min(1, pipPresence)) : 1;
		const lerp = (from: number, to: number) => Math.round(from + (to - from) * presence);
		const animatedScreenRect = {
			x: lerp(screenRect.x, screenSlot.x),
			y: lerp(screenRect.y, screenSlot.y),
			width: Math.max(1, lerp(screenRect.width, screenSlot.width)),
			height: Math.max(1, lerp(screenRect.height, screenSlot.height)),
		};

		return {
			screenRect: animatedScreenRect,
			screenBorderRadius: webcamBorderRadius,
			webcamRect: {
				x: webcamSlot.x,
				y: webcamSlot.y,
				width: webcamSlot.width,
				height: webcamSlot.height,
				borderRadius: webcamBorderRadius,
				maskShape: "rectangle",
			},
			screenCover: true,
		};
	}

	const transform = preset.transform;
	const screenRect = centerRect({
		canvasSize,
		size: screenSize,
		maxSize: maxContentSize,
	});

	// While PIP content shows, slide the main screen from horizontal center away
	// from the webcam's side, inside the padded content area (the inset on the
	// landing side stays equal to the screen padding).
	if (pipPresence != null && pipPresence > 0) {
		const clampedPresence = Math.max(0, Math.min(1, pipPresence));
		const contentInset = Math.round((canvasWidth - maxContentSize.width) / 2);
		const webcamOnLeft = pipCorner === "top-left" || pipCorner === "bottom-left";
		const alignedX = webcamOnLeft ? canvasWidth - contentInset - screenRect.width : contentInset;
		screenRect.x = Math.round(screenRect.x + (alignedX - screenRect.x) * clampedPresence);
	}

	if (!webcamWidth || !webcamHeight || webcamWidth <= 0 || webcamHeight <= 0) {
		return { screenRect, webcamRect: null };
	}

	// Default corner inset: half the screen padding when provided (absolute px),
	// otherwise the legacy canvas-proportional margin.
	const margin =
		pipMarginPx != null
			? Math.max(transform.minMargin, Math.round(pipMarginPx * absoluteRadiusScale))
			: Math.max(
					transform.minMargin,
					Math.round(Math.min(canvasWidth, canvasHeight) * transform.marginFraction),
				);
	// The webcam slot is an explicit width×height box (canonical output px);
	// the source video is cover-cropped into it by both renderers.
	let width = Math.max(1, Math.round(clampWebcamWidthPx(webcamSizePx.width) * absoluteRadiusScale));
	let height = Math.max(
		1,
		Math.round(clampWebcamHeightPx(webcamSizePx.height) * absoluteRadiusScale),
	);

	// Shape-specific dimension adjustments
	if (webcamMaskShape === "circle" || webcamMaskShape === "square") {
		const side = Math.min(width, height);
		width = side;
		height = side;
	}

	let webcamX: number;
	let webcamY: number;

	if (webcamPosition) {
		// cx/cy are the webcam center as a fraction of the canvas.
		webcamX = Math.round(webcamPosition.cx * canvasWidth - width / 2);
		webcamY = Math.round(webcamPosition.cy * canvasHeight - height / 2);
		// Clamp inside canvas bounds.
		webcamX = Math.max(0, Math.min(canvasWidth - width, webcamX));
		webcamY = Math.max(0, Math.min(canvasHeight - height, webcamY));
	} else {
		// Default: the chosen corner (bottom-right unless overridden) with margin.
		const webcamOnLeft = pipCorner === "top-left" || pipCorner === "bottom-left";
		const webcamOnTop = pipCorner === "top-left" || pipCorner === "top-right";
		webcamX = Math.max(0, Math.round(webcamOnLeft ? margin : canvasWidth - margin - width));
		webcamY = Math.max(0, Math.round(webcamOnTop ? margin : canvasHeight - margin - height));
	}

	// Shape-specific border radius
	let borderRadius: number;
	if (webcamMaskShape === "rounded") {
		borderRadius = Math.round(Math.min(width, height) * 0.3);
	} else if (webcamMaskShape === "circle") {
		borderRadius = Math.round(Math.min(width, height) / 2);
	} else if (webcamMaskShape === "square") {
		// Fixed rounding regardless of the webcam size.
		borderRadius = Math.round(SQUARE_WEBCAM_BORDER_RADIUS * absoluteRadiusScale);
	} else if (screenRoundnessPx != null) {
		// Rect shape follows the screen roundness at half strength.
		borderRadius = Math.round((screenRoundnessPx / 2) * absoluteRadiusScale);
	} else {
		borderRadius = Math.min(
			preset.borderRadius.max,
			Math.max(
				preset.borderRadius.min,
				Math.round(Math.min(width, height) * preset.borderRadius.fraction),
			),
		);
	}

	return {
		screenRect,
		webcamRect: {
			x: webcamX,
			y: webcamY,
			width,
			height,
			borderRadius,
			maskShape: webcamMaskShape,
		},
	};
}

function centerRect(params: { canvasSize: Size; size: Size; maxSize: Size }): RenderRect {
	const { canvasSize, size, maxSize } = params;
	return centerRectInBounds({
		bounds: { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height },
		size,
		maxSize,
	});
}

function centerRectInBounds(params: { bounds: RenderRect; size: Size; maxSize: Size }): RenderRect {
	const { bounds, size, maxSize } = params;
	const { x: boundsX, y: boundsY, width: boundsWidth, height: boundsHeight } = bounds;
	const { width, height } = size;
	const { width: maxWidth, height: maxHeight } = maxSize;
	const scale = Math.min(maxWidth / width, maxHeight / height);
	const resolvedWidth = Math.round(width * scale);
	const resolvedHeight = Math.round(height * scale);

	if (
		maxWidth >= boundsWidth &&
		maxHeight >= boundsHeight &&
		Math.abs(boundsWidth - resolvedWidth) <= 4 &&
		Math.abs(boundsHeight - resolvedHeight) <= 4
	) {
		return {
			x: boundsX,
			y: boundsY,
			width: boundsWidth,
			height: boundsHeight,
		};
	}

	return {
		x: boundsX + Math.max(0, Math.floor((boundsWidth - resolvedWidth) / 2)),
		y: boundsY + Math.max(0, Math.floor((boundsHeight - resolvedHeight) / 2)),
		width: resolvedWidth,
		height: resolvedHeight,
	};
}
