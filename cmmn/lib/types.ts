import { clamp01 } from "@/utils/math";
import type { WebcamLayoutPreset } from "@/lib/compositeLayout";

export type ZoomDepth = 1 | 2 | 3 | 4 | 5 | 6;
export type ZoomFocusMode = "manual" | "auto";
export type { WebcamLayoutPreset };
/** Legacy alias kept for prop plumbing; values are canonical output px. */

// Webcam slot box in canonical output px (long side 1920): width 32-1920,
// height 32-1080, steps of 4.
export const DEFAULT_WEBCAM_SIZE_WIDTH = 256;
export const DEFAULT_WEBCAM_SIZE_HEIGHT = 256;

export const DEFAULT_WEBCAM_LAYOUT_PRESET: WebcamLayoutPreset = "picture-in-picture";

export type WebcamMaskShape = "rectangle" | "circle" | "square" | "rounded";

export const DEFAULT_WEBCAM_MASK_SHAPE: WebcamMaskShape = "rectangle";

export const DEFAULT_WEBCAM_MIRRORED = false;

/** When true, the picture-in-picture webcam scales inversely with zoom (shrinks as you zoom in). */
export const DEFAULT_WEBCAM_REACTIVE_ZOOM = true;

export interface WebcamPosition {
	cx: number; // normalized horizontal center (0-1)
	cy: number; // normalized vertical center (0-1)
}

export const DEFAULT_WEBCAM_POSITION: WebcamPosition | null = null;

export interface ZoomFocus {
	cx: number; // normalized horizontal center (0-1)
	cy: number; // normalized vertical center (0-1)
}

export interface Rotation3D {
	rotationX: number;
	rotationY: number;
	rotationZ: number;
}

export const DEFAULT_ROTATION_3D: Rotation3D = {
	rotationX: 0,
	rotationY: 0,
	rotationZ: 0,
};

export type Rotation3DPreset = "iso" | "left" | "right";

export const ROTATION_3D_PRESETS: Record<Rotation3DPreset, Rotation3D> = {
	iso: { rotationX: -10, rotationY: -16, rotationZ: 0 },
	left: { rotationX: 0, rotationY: -22, rotationZ: 0 },
	right: { rotationX: 0, rotationY: 22, rotationZ: 0 },
};

export const ROTATION_3D_PRESET_ORDER: Rotation3DPreset[] = ["iso", "left", "right"];

/** Perspective distance in CSS px is this factor times min(viewport w, h). Same
 * factor in preview and export so the look matches at any canvas resolution. */
export const ROTATION_3D_PERSPECTIVE_FACTOR = 2.6;

export function rotation3DPerspective(width: number, height: number): number {
	return Math.min(width, height) * ROTATION_3D_PERSPECTIVE_FACTOR;
}

/**
 * Origin of a zoom region. "auto" marks zooms from the magic-wand suggest pass;
 * toggling the wand off removes only these. Editing an auto zoom promotes it to
 * "manual" so it survives. Undefined is treated as "manual" for back-compat.
 */
export type ZoomRegionSource = "auto" | "manual";

export interface ZoomRegion {
	id: string;
	startMs: number;
	endMs: number;
	depth: ZoomDepth;
	focus: ZoomFocus;
	focusMode?: ZoomFocusMode;
	rotationPreset?: Rotation3DPreset;
	/** Custom scale overriding the preset depth (1.0-5.0, two decimal precision). */
	customScale?: number;
	source?: ZoomRegionSource;
}

export function getRotation3D(region: Pick<ZoomRegion, "rotationPreset">): Rotation3D {
	if (!region.rotationPreset) return DEFAULT_ROTATION_3D;
	return ROTATION_3D_PRESETS[region.rotationPreset];
}

export function isRotation3DIdentity(r: Rotation3D, eps = 0.01): boolean {
	return Math.abs(r.rotationX) < eps && Math.abs(r.rotationY) < eps && Math.abs(r.rotationZ) < eps;
}

export function lerpRotation3D(a: Rotation3D, b: Rotation3D, t: number): Rotation3D {
	return {
		rotationX: a.rotationX + (b.rotationX - a.rotationX) * t,
		rotationY: a.rotationY + (b.rotationY - a.rotationY) * t,
		rotationZ: a.rotationZ + (b.rotationZ - a.rotationZ) * t,
	};
}

/**
 * Max uniform scale that, with `rot` and a perspective of `perspective` CSS px, keeps
 * the projected bounding box of a width x height element inside its original rectangle.
 * Returns 1 when no scaling is needed. Projects each rotated corner (x' = x*P/(P-z)) and
 * returns the limiting half-extent ratio so the rotated recording stays inside the zoom window.
 */
export function computeRotation3DContainScale(
	rot: Rotation3D,
	width: number,
	height: number,
	perspective: number,
): number {
	const a = (rot.rotationX * Math.PI) / 180;
	const b = (rot.rotationY * Math.PI) / 180;
	const g = (rot.rotationZ * Math.PI) / 180;
	const ca = Math.cos(a);
	const sa = Math.sin(a);
	const cb = Math.cos(b);
	const sb = Math.sin(b);
	const cg = Math.cos(g);
	const sg = Math.sin(g);
	const halfW = width / 2;
	const halfH = height / 2;
	const corners: Array<[number, number]> = [
		[-halfW, -halfH],
		[halfW, -halfH],
		[halfW, halfH],
		[-halfW, halfH],
	];

	let maxAbsX = 0;
	let maxAbsY = 0;

	for (const [x0, y0] of corners) {
		// CSS "rotateX rotateY rotateZ" applies right-to-left: Z first, then Y, then X.
		let px = x0;
		let py = y0;
		let pz = 0;

		// rotateZ
		const zx = px * cg - py * sg;
		const zy = px * sg + py * cg;
		px = zx;
		py = zy;

		// rotateY
		const yx = px * cb + pz * sb;
		const yz = -px * sb + pz * cb;
		px = yx;
		pz = yz;

		// rotateX
		const xy = py * ca - pz * sa;
		const xz = py * sa + pz * ca;
		py = xy;
		pz = xz;

		// Viewer at (0, 0, P) looking toward -z; a point at z=pz scales by P/(P-pz).
		// perspective <= 0 means orthographic.
		if (perspective > 0) {
			const denom = perspective - pz;
			if (denom <= 0) return 1; // pathological, skip scaling rather than crash
			const f = perspective / denom;
			px *= f;
			py *= f;
		}

		if (Math.abs(px) > maxAbsX) maxAbsX = Math.abs(px);
		if (Math.abs(py) > maxAbsY) maxAbsY = Math.abs(py);
	}

	if (maxAbsX === 0 || maxAbsY === 0) return 1;
	const sx = halfW / maxAbsX;
	const sy = halfH / maxAbsY;
	return Math.min(sx, sy, 1);
}

export interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	interactionType?: "move" | "click" | "double-click" | "right-click" | "middle-click" | "mouseup";
	cursorType?:
		| "arrow"
		| "text"
		| "pointer"
		| "crosshair"
		| "open-hand"
		| "closed-hand"
		| "resize-ew"
		| "resize-ns"
		| "not-allowed";
}

export interface CursorVisualSettings {
	size: number;
	smoothing: number;
	motionBlur: number;
	clickBounce: number;
	clipToBounds: boolean;
}

export const DEFAULT_CURSOR_SIZE = 4.0;
export const DEFAULT_CURSOR_SMOOTHING = 1;
export const DEFAULT_CURSOR_MOTION_BLUR = 0.5;
export const DEFAULT_CURSOR_CLICK_BOUNCE = 4.0;
// false lets the cursor overflow into the background; true clips it to the canvas bounds.
export const DEFAULT_CURSOR_CLIP_TO_BOUNDS = false;
export const DEFAULT_ZOOM_MOTION_BLUR = 0.35;

export interface TrimRegion {
	id: string;
	startMs: number;
	endMs: number;
}

/** Freeze-frame dissolve length where trimmed segments join (preview + export). */
export const TRIM_CROSSFADE_MS = 400;

/** Time range during which the recorded cursor is not rendered (preview + export). */
export interface CursorHiddenRegion {
	id: string;
	startMs: number;
	endMs: number;
}

/** True when the cursor should be hidden at `timeMs` (start inclusive, end exclusive). */
export function isCursorHiddenAt(regions: CursorHiddenRegion[], timeMs: number): boolean {
	return regions.some((region) => timeMs >= region.startMs && timeMs < region.endMs);
}

/**
 * A camera video imported from a file and placed on the timeline. While a clip
 * is active it plays in the webcam slot (same layout preset, mask, size and
 * position), taking precedence over the live webcam recording if one exists.
 */
export interface CameraClip {
	id: string;
	/** Absolute path of the source video file. */
	filePath: string;
	/** Placement on the editor timeline (ms). */
	startMs: number;
	endMs: number;
	/** In-point inside the source file (ms) that plays at startMs. */
	sourceInMs: number;
	/** Full duration of the source file (ms), probed at import. */
	sourceDurationMs: number;
	/** Layout used while this clip is active; undefined = the global preset. */
	layoutPreset?: WebcamLayoutPreset;
	/** Camera shape while this clip is active; undefined = the global shape. */
	maskShape?: WebcamMaskShape;
	/** Webcam box width (canonical px, 32-1920); undefined = the global width. */
	sizeWidthPx?: number;
	/** Webcam box height (canonical px, 32-1080); undefined = the global height. */
	sizeHeightPx?: number;
	/** Source video pixel width, probed at import; caps the size sliders. */
	sourceWidth?: number;
	/** Source video pixel height, probed at import; caps the size sliders. */
	sourceHeight?: number;
	/** PIP corner while this clip is active; undefined = bottom-right. */
	pipCorner?: CameraClipPipCorner;
	/** Dual-frame camera side while this clip is active; undefined = right. */
	dualSide?: CameraClipDualSide;
}

export type CameraClipPipCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type CameraClipDualSide = "left" | "right";

const CAMERA_CLIP_PIP_CORNERS: readonly CameraClipPipCorner[] = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
];
const CAMERA_CLIP_DUAL_SIDES: readonly CameraClipDualSide[] = ["left", "right"];

/** Validate a per-clip PIP corner; anything else means "use the default". */
export function normalizeCameraClipPipCorner(value: unknown): CameraClipPipCorner | undefined {
	return CAMERA_CLIP_PIP_CORNERS.includes(value as CameraClipPipCorner)
		? (value as CameraClipPipCorner)
		: undefined;
}

/** Validate a per-clip dual-frame side; anything else means "use the default". */
export function normalizeCameraClipDualSide(value: unknown): CameraClipDualSide | undefined {
	return CAMERA_CLIP_DUAL_SIDES.includes(value as CameraClipDualSide)
		? (value as CameraClipDualSide)
		: undefined;
}

const CAMERA_CLIP_MASK_SHAPES: readonly WebcamMaskShape[] = [
	"rectangle",
	"circle",
	"square",
	"rounded",
];

/** Validate a per-clip camera shape; anything else means "use the global". */
export function normalizeCameraClipMaskShape(value: unknown): WebcamMaskShape | undefined {
	return CAMERA_CLIP_MASK_SHAPES.includes(value as WebcamMaskShape)
		? (value as WebcamMaskShape)
		: undefined;
}

const CAMERA_CLIP_LAYOUT_PRESETS: readonly WebcamLayoutPreset[] = [
	"picture-in-picture",
	"vertical-stack",
	"dual-frame",
];

/** Validate a per-clip layout preset; anything else means "use the global". */
export function normalizeCameraClipLayoutPreset(value: unknown): WebcamLayoutPreset | undefined {
	return CAMERA_CLIP_LAYOUT_PRESETS.includes(value as WebcamLayoutPreset)
		? (value as WebcamLayoutPreset)
		: undefined;
}

/** The clip playing at `timeMs` (start inclusive, end exclusive), or null. */
export function activeCameraClipAt(clips: CameraClip[], timeMs: number): CameraClip | null {
	return clips.find((clip) => timeMs >= clip.startMs && timeMs < clip.endMs) ?? null;
}

/**
 * Resolve a clip's span/in-point after a timeline drag or resize. A move (same
 * duration) keeps the in-point; a left-edge resize shifts the in-point with the
 * edge; any resize is clamped so the span never plays past the source file.
 */
export function resolveCameraClipSpanChange(
	clip: CameraClip,
	span: { start: number; end: number },
): Pick<CameraClip, "startMs" | "endMs" | "sourceInMs"> {
	let startMs = Math.round(span.start);
	let endMs = Math.round(span.end);
	let sourceInMs = clip.sourceInMs;

	const oldDuration = clip.endMs - clip.startMs;
	const isResize = endMs - startMs !== oldDuration;
	if (isResize && startMs !== clip.startMs) {
		// Left-edge resize: the in-point follows the edge so the visible frames
		// at a given timeline instant stay put.
		sourceInMs = clip.sourceInMs + (startMs - clip.startMs);
		if (sourceInMs < 0) {
			startMs -= sourceInMs;
			sourceInMs = 0;
		}
	}

	const maxDurationMs = Math.max(1, Math.round(clip.sourceDurationMs) - sourceInMs);
	if (endMs - startMs > maxDurationMs) {
		endMs = startMs + maxDurationMs;
	}
	if (endMs <= startMs) {
		endMs = startMs + 1;
	}

	return { startMs, endMs, sourceInMs };
}

export type AnnotationType = "text" | "image" | "figure" | "blur";

export type ArrowDirection =
	| "up"
	| "down"
	| "left"
	| "right"
	| "up-right"
	| "up-left"
	| "down-right"
	| "down-left";

export interface FigureData {
	arrowDirection: ArrowDirection;
	color: string;
	strokeWidth: number;
}

export type BlurShape = "rectangle" | "oval" | "freehand";
export type BlurType = "blur" | "mosaic";
export type BlurColor = "white" | "black";

export const MIN_BLUR_INTENSITY = 2;
export const MAX_BLUR_INTENSITY = 40;
export const DEFAULT_BLUR_INTENSITY = 12;
export const MIN_BLUR_BLOCK_SIZE = 4;
export const MAX_BLUR_BLOCK_SIZE = 48;
export const DEFAULT_BLUR_BLOCK_SIZE = 12;

export interface BlurData {
	type: BlurType;
	shape: BlurShape;
	color: BlurColor;
	intensity: number;
	blockSize: number;
	// Points are normalized (0-100) within the annotation bounds.
	freehandPoints?: Array<{ x: number; y: number }>;
}

export interface AnnotationPosition {
	x: number;
	y: number;
}

export interface AnnotationSize {
	width: number;
	height: number;
}

export type AnnotationTextAnimation =
	| "none"
	| "fade"
	| "rise"
	| "pop"
	| "slide-left"
	| "typewriter"
	| "pulse";

export interface AnnotationTextStyle {
	color: string;
	backgroundColor: string;
	fontSize: number; // pixels
	fontFamily: string;
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline";
	textAlign: "left" | "center" | "right";
	verticalAlign?: "top" | "middle" | "bottom";
	textAnimation?: AnnotationTextAnimation;
}

export interface AnnotationRegion {
	id: string;
	startMs: number;
	endMs: number;
	type: AnnotationType;
	content: string; // Legacy - still used for current type
	textContent?: string; // Separate storage for text
	imageContent?: string; // Separate storage for image data URL
	position: AnnotationPosition;
	size: AnnotationSize;
	style: AnnotationTextStyle;
	zIndex: number;
	/** When set, layout/style edits on one region can sync to all auto-caption siblings. */
	annotationSource?: "auto-caption";
	figureData?: FigureData;
	blurData?: BlurData;
}

// Full-width strip pinned to the bottom of the canvas (1920x270 at 16:9,
// i.e. 100% x 25%); position is the top-left corner in percent.
export const DEFAULT_ANNOTATION_POSITION: AnnotationPosition = {
	x: 0,
	y: 75,
};

export const DEFAULT_ANNOTATION_SIZE: AnnotationSize = {
	width: 100,
	height: 25,
};

export const DEFAULT_ANNOTATION_STYLE: AnnotationTextStyle = {
	color: "#000000",
	backgroundColor: "#CCCCFFCC",
	fontSize: 32,
	fontFamily: "Inter",
	fontWeight: "bold",
	fontStyle: "normal",
	textDecoration: "none",
	textAlign: "center",
	verticalAlign: "middle",
	textAnimation: "fade",
};

export const DEFAULT_FIGURE_DATA: FigureData = {
	arrowDirection: "right",
	color: "#34B27B",
	strokeWidth: 4,
};

export const DEFAULT_BLUR_FREEHAND_POINTS: Array<{ x: number; y: number }> = [
	{ x: 10, y: 30 },
	{ x: 25, y: 10 },
	{ x: 55, y: 8 },
	{ x: 82, y: 20 },
	{ x: 90, y: 45 },
	{ x: 78, y: 72 },
	{ x: 52, y: 90 },
	{ x: 22, y: 84 },
	{ x: 8, y: 58 },
];

export const DEFAULT_BLUR_DATA: BlurData = {
	type: "mosaic",
	shape: "rectangle",
	color: "white",
	intensity: DEFAULT_BLUR_INTENSITY,
	blockSize: DEFAULT_BLUR_BLOCK_SIZE,
	freehandPoints: DEFAULT_BLUR_FREEHAND_POINTS,
};

export interface CropRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const DEFAULT_CROP_REGION: CropRegion = {
	x: 0,
	y: 0,
	width: 1,
	height: 1,
};

export type PlaybackSpeed = number;

export const MIN_PLAYBACK_SPEED = 0.1;
export const MAX_PLAYBACK_SPEED = 100;
// Chromium hard-caps HTMLMediaElement.playbackRate at 16 (setting more throws
// NotSupportedError). At or below this, preview plays natively; above it, preview
// frame-steps by seeking and audio export uses an offline pitch-preserved stretch.
export const MAX_NATIVE_PLAYBACK_RATE = 16;

export function clampPlaybackSpeed(speed: number): PlaybackSpeed {
	return Math.round(Math.min(MAX_PLAYBACK_SPEED, Math.max(MIN_PLAYBACK_SPEED, speed)) * 100) / 100;
}

export interface SpeedRegion {
	id: string;
	startMs: number;
	endMs: number;
	speed: PlaybackSpeed;
}

export const SPEED_OPTIONS: Array<{ speed: PlaybackSpeed; label: string }> = [
	{ speed: 0.25, label: "0.25×" },
	{ speed: 0.5, label: "0.5×" },
	{ speed: 0.75, label: "0.75×" },
	{ speed: 1.25, label: "1.25×" },
	{ speed: 1.5, label: "1.5×" },
	{ speed: 1.75, label: "1.75×" },
	{ speed: 2, label: "2×" },
	{ speed: 3, label: "3×" },
	{ speed: 4, label: "4×" },
	{ speed: 5, label: "5×" },
];

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 1.5;

export const ZOOM_DEPTH_SCALES: Record<ZoomDepth, number> = {
	1: 1.25,
	2: 1.5,
	3: 1.75,
	4: 2.0,
	5: 2.25,
	6: 2.5,
};

export const MIN_ZOOM_SCALE = 1.0;
export const MAX_ZOOM_SCALE = 5.0;

export const DEFAULT_ZOOM_DEPTH: ZoomDepth = 3;

/** Returns the effective zoom scale for a region, preferring customScale over the preset. */
export function getZoomScale(region: ZoomRegion): number {
	if (region.customScale != null) {
		const clamped = Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, region.customScale));
		if (Number.isFinite(clamped)) return clamped;
	}
	return ZOOM_DEPTH_SCALES[region.depth];
}

export function clampFocusToDepth(focus: ZoomFocus, _depth: ZoomDepth): ZoomFocus {
	return {
		cx: clamp(focus.cx, 0, 1),
		cy: clamp(focus.cy, 0, 1),
	};
}

function clamp(value: number, min: number, max: number) {
	if (Number.isNaN(value)) return (min + max) / 2;
	return Math.min(max, Math.max(min, value));
}

// An unknown focus means "centre", not "top-left" — so this one can't use the
// shared clamp, which floors non-finite input to `min`. Same convention as
// `finiteFraction` in useTimeline.ts.
function focusOrCentre(value: number): number {
	return Number.isFinite(value) ? clamp01(value) : 0.5;
}

export function clampFocus(focus: ZoomFocus): ZoomFocus {
	return {
		cx: focusOrCentre(focus.cx),
		cy: focusOrCentre(focus.cy),
	};
}

// Export settings vocabulary — shared with rcdr (userPreferences/editorDefaults
// persist these), so it lives here rather than in the editor-only exporter.
export type ExportQuality = "medium" | "good" | "source";
export type ExportFormat = "mp4" | "gif";
export type GifFrameRate = 15 | 20 | 25 | 30;
export type GifSizePreset = "medium" | "large" | "original";
