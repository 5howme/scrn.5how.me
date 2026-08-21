/**
 * Procedural "canvas" wallpapers: animated backgrounds rendered as a pure
 * function of (wallpaper id, canvas size, time). Because a frame is fully
 * determined by the timestamp, the editor preview, scrubbing, and the
 * frame-by-frame exporter all produce identical pixels.
 */

export const CANVAS_WALLPAPER_PREFIX = "canvas:";

export interface CanvasWallpaperDefinition {
	id: string;
	/** The wallpaper string stored in the project (e.g. "canvas:trunk"). */
	value: string;
	/** i18n key under settings `background.*` for the option's title. */
	labelKey: string;
}

export const CANVAS_WALLPAPERS: CanvasWallpaperDefinition[] = [
	{ id: "trunk", value: "canvas:trunk", labelKey: "background.canvasTrunk" },
];

export function isCanvasWallpaper(value: string): boolean {
	return value.startsWith(CANVAS_WALLPAPER_PREFIX);
}

export function canvasWallpaperIdOf(value: string): string {
	return value.slice(CANVAS_WALLPAPER_PREFIX.length);
}

/** Deterministic FNV-style hash of integers onto [0, 1). */
function hash01(...ints: number[]): number {
	let h = 2166136261 >>> 0;
	for (const n of ints) {
		h = Math.imul(h ^ (n | 0), 16777619) >>> 0;
	}
	h ^= h >>> 13;
	h = Math.imul(h, 1274126177) >>> 0;
	h ^= h >>> 16;
	return h / 4294967296;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
	const t = clamp01(value);
	return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// "Trunk": growing tree-ring style generative background (a deterministic
// reimplementation of the Vanta.js trunk look). Wobbly concentric rings sweep
// in one by one around a slightly drifting center, hold, fade, and restart
// with a new seed.
// ---------------------------------------------------------------------------

const TRUNK_BG = "#191a20";
const RING_INTERVAL_MS = 550;
const RING_DRAW_MS = 1400;
const MAX_RINGS = 26;
const HOLD_MS = 4000;
const FADE_MS = 1600;
export const TRUNK_CYCLE_MS = MAX_RINGS * RING_INTERVAL_MS + RING_DRAW_MS + HOLD_MS + FADE_MS;

const TWO_PI = Math.PI * 2;
const SEGMENTS = 220;
// Harmonics (frequency, relative amplitude) shaping each ring's wobble.
const WOBBLE: Array<[number, number]> = [
	[2, 0.5],
	[3, 0.34],
	[5, 0.2],
	[9, 0.1],
];

function drawTrunk(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	timeMs: number,
): void {
	ctx.fillStyle = TRUNK_BG;
	ctx.fillRect(0, 0, width, height);

	const cycle = Math.floor(Math.max(0, timeMs) / TRUNK_CYCLE_MS);
	const local = Math.max(0, timeMs) - cycle * TRUNK_CYCLE_MS;
	const seed = (cycle % 9973) + 1;

	// Whole-scene fade out at the end of the cycle.
	const globalAlpha = smoothstep((TRUNK_CYCLE_MS - local) / FADE_MS);
	if (globalAlpha <= 0) {
		return;
	}

	const unit = Math.min(width, height);
	const cx = width * (0.5 + (hash01(seed, 0) - 0.5) * 0.24);
	const cy = height * (0.52 + (hash01(seed, 1) - 0.5) * 0.18);
	// The outermost ring reaches past the farthest corner so rings fill the
	// whole canvas regardless of aspect ratio.
	const maxRadius = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) * 1.04;
	const spacing = maxRadius / MAX_RINGS;

	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.lineWidth = Math.max(1, unit * 0.0016);

	for (let ring = 0; ring < MAX_RINGS; ring++) {
		const startAt = ring * RING_INTERVAL_MS;
		if (local < startAt) {
			break;
		}
		const drawProgress = smoothstep((local - startAt) / RING_DRAW_MS);
		if (drawProgress <= 0) {
			continue;
		}

		// Each ring keeps breathing outward slightly after it appears.
		const growth = 1 + 0.03 * smoothstep((local - startAt) / 9000);
		const baseRadius = spacing * (ring + 1) * growth;
		const startAngle = hash01(seed, ring, 7) * TWO_PI;
		const sweep = drawProgress * TWO_PI;

		const alpha = globalAlpha * (0.22 + 0.4 * hash01(seed, ring, 3));
		ctx.strokeStyle = `rgba(178, 208, 192, ${alpha.toFixed(3)})`;

		ctx.beginPath();
		const steps = Math.max(8, Math.round(SEGMENTS * drawProgress));
		for (let s = 0; s <= steps; s++) {
			const angle = startAngle + (sweep * s) / steps;
			let radius = baseRadius;
			for (let k = 0; k < WOBBLE.length; k++) {
				const [frequency, amplitude] = WOBBLE[k];
				const phase = hash01(seed, ring, k) * TWO_PI;
				radius += spacing * amplitude * Math.sin(frequency * angle + phase) * 0.6;
			}
			// A gentle spiral drift so the ring's end doesn't meet its start.
			radius += spacing * 0.5 * ((angle - startAngle) / TWO_PI);
			const x = cx + Math.cos(angle) * radius;
			const y = cy + Math.sin(angle) * radius;
			if (s === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}
		ctx.stroke();
	}

	ctx.restore();
}

/**
 * Render one frame of a canvas wallpaper. Accepts either the stored value
 * ("canvas:trunk") or a bare id ("trunk"); unknown ids fall back to the plain
 * dark background so nothing crashes on stale project files.
 */
export function drawCanvasWallpaperFrame(
	ctx: CanvasRenderingContext2D,
	idOrValue: string,
	width: number,
	height: number,
	timeMs: number,
): void {
	if (width <= 0 || height <= 0) {
		return;
	}
	const id = isCanvasWallpaper(idOrValue) ? canvasWallpaperIdOf(idOrValue) : idOrValue;
	switch (id) {
		case "trunk":
			drawTrunk(ctx, width, height, timeMs);
			return;
		default:
			ctx.fillStyle = TRUNK_BG;
			ctx.fillRect(0, 0, width, height);
			return;
	}
}
