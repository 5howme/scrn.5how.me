import { getAssetPath } from "@/lib/assetPath";
import { canvasWallpaperIdOf, isCanvasWallpaper } from "@/lib/canvasWallpaper";

export const WALLPAPER_COUNT = 18;

export const WALLPAPER_PATHS: readonly string[] = Array.from(
	{ length: WALLPAPER_COUNT },
	(_, i) => `/wallpapers/wallpaper${i + 1}.jpg`,
);

export const DEFAULT_WALLPAPER = WALLPAPER_PATHS[0];

export type WallpaperClassification =
	| { kind: "color"; value: string }
	| { kind: "gradient"; value: string }
	| { kind: "image"; path: string }
	/** Procedural animated background rendered per frame (see canvasWallpaper.ts). */
	| { kind: "canvas"; id: string }
	/** User-supplied looping background video; `path` is the absolute file path. */
	| { kind: "video"; path: string };

export const VIDEO_WALLPAPER_PREFIX = "video:";

export function videoWallpaperValue(filePath: string): string {
	return `${VIDEO_WALLPAPER_PREFIX}${filePath}`;
}

export function videoWallpaperPathOf(value: string): string {
	return value.slice(VIDEO_WALLPAPER_PREFIX.length);
}

/**
 * Built-in background videos bundled with the app (public/bg-videos, copied to
 * resources/bg-videos in packaged builds). Paths are app-relative, unlike
 * user-uploaded background videos whose paths are absolute file paths.
 */
export const BUILTIN_BG_VIDEO_PATHS: readonly string[] = [
	"/bg-videos/185365-875417518_small.mp4",
	"/bg-videos/185367-875417528_small.mp4",
	"/bg-videos/215530_small.mp4",
	"/bg-videos/215697_small.mp4",
	"/bg-videos/27018-361798566_small.mp4",
	"/bg-videos/38108-416330739_small.mp4",
	"/bg-videos/73290-548173296.mp4",
];

/** Wallpaper value of the first built-in background video (the app default). */
export const DEFAULT_BG_VIDEO_WALLPAPER = videoWallpaperValue(BUILTIN_BG_VIDEO_PATHS[0]);

const BUILTIN_BG_VIDEO_PREFIX = "/bg-videos/";

export function isBuiltinBgVideoPath(videoPath: string): boolean {
	return videoPath.startsWith(BUILTIN_BG_VIDEO_PREFIX);
}

/**
 * Resolves a built-in background video path to a playable URL. Returns a
 * fully-qualified URL so the export decoder's remote/local routing works: an
 * http(s) URL in dev, a file:// URL under the packaged asset base.
 */
export function resolveBuiltinBgVideoUrl(videoPath: string): string {
	if (!isBuiltinBgVideoPath(videoPath)) {
		throw new BackgroundLoadError(videoPath, new UnsafeImagePrefixError(BUILTIN_BG_VIDEO_PREFIX));
	}
	try {
		const resolved = getAssetPath(videoPath.slice(1));
		return resolved.startsWith("/") && typeof window !== "undefined"
			? new URL(resolved, window.location.origin).href
			: resolved;
	} catch (cause) {
		if (cause instanceof BackgroundLoadError) throw cause;
		throw new BackgroundLoadError(videoPath, cause);
	}
}

const GRADIENT_RE = /^(repeating-)?(linear|radial|conic)-gradient\(/;
const COLOR_FUNC_RE = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/;
const IMAGE_URL_RE = /^(\/|https?:\/\/|file:\/\/|data:)/;

export function classifyWallpaper(value: string): WallpaperClassification {
	const trimmed = value.trim();
	if (trimmed === "") {
		return { kind: "color", value: "#000000" };
	}
	if (isCanvasWallpaper(trimmed)) {
		return { kind: "canvas", id: canvasWallpaperIdOf(trimmed) };
	}
	if (trimmed.startsWith(VIDEO_WALLPAPER_PREFIX)) {
		return { kind: "video", path: videoWallpaperPathOf(trimmed) };
	}
	if (trimmed.startsWith("#") || COLOR_FUNC_RE.test(trimmed)) {
		return { kind: "color", value: trimmed };
	}
	if (GRADIENT_RE.test(trimmed)) {
		return { kind: "gradient", value: trimmed };
	}
	if (IMAGE_URL_RE.test(trimmed)) {
		return { kind: "image", path: trimmed };
	}
	return { kind: "color", value: trimmed };
}

const ALLOWED_IMAGE_PREFIX = "/wallpapers/";

export class UnsafeImagePrefixError extends Error {
	constructor(prefix: string) {
		super(`Image wallpaper path must live under ${prefix}`);
		this.name = "UnsafeImagePrefixError";
	}
}

export function resolveImageWallpaperUrl(imagePath: string): string {
	if (
		imagePath.startsWith("http://") ||
		imagePath.startsWith("https://") ||
		imagePath.startsWith("file://") ||
		imagePath.startsWith("data:")
	) {
		return imagePath;
	}
	const withLeadingSlash = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
	if (!withLeadingSlash.startsWith(ALLOWED_IMAGE_PREFIX)) {
		throw new BackgroundLoadError(imagePath, new UnsafeImagePrefixError(ALLOWED_IMAGE_PREFIX));
	}
	try {
		return getAssetPath(withLeadingSlash.slice(1));
	} catch (cause) {
		if (cause instanceof BackgroundLoadError) throw cause;
		throw new BackgroundLoadError(imagePath, cause);
	}
}

export class BackgroundLoadError extends Error {
	readonly url: string;
	readonly cause?: unknown;

	constructor(url: string, cause?: unknown) {
		super(`Failed to load background image: ${displayBasename(url)}`);
		this.name = "BackgroundLoadError";
		this.url = url;
		this.cause = cause;
	}

	get displayUrl(): string {
		return displayBasename(this.url);
	}
}

function displayBasename(url: string): string {
	if (url.startsWith("data:")) {
		return "data:…";
	}
	try {
		const parsed = new URL(url);
		const last = parsed.pathname.split("/").filter(Boolean).pop();
		return last ? decodeURIComponent(last) : "(unknown)";
	} catch {
		const last = url.split("/").filter(Boolean).pop();
		return last ?? "(unknown)";
	}
}
