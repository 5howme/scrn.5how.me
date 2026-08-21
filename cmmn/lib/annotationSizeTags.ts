/**
 * Custom inline size tag for annotation text: wrapping a stretch of text in
 * <s>...</s> renders it at 75% of the annotation font size. Parsed identically
 * by the editor preview (DOM spans) and the exporter (canvas runs).
 */
export const SMALL_TEXT_SCALE = 0.75;

export interface SizeTagSegment {
	text: string;
	scale: number;
}

const SIZE_TAG_SPLIT_RE = /(<s>[\s\S]*?<\/s>)/g;
const SIZE_TAG_MATCH_RE = /^<s>([\s\S]*?)<\/s>$/;

/**
 * Split raw annotation content into segments with a font-size scale. Complete
 * <s>...</s> pairs become 0.75-scale segments (tags stripped); everything
 * else, including unmatched tags, stays literal at scale 1.
 */
export function parseSizeTagSegments(content: string): SizeTagSegment[] {
	const segments: SizeTagSegment[] = [];
	for (const part of content.split(SIZE_TAG_SPLIT_RE)) {
		if (!part) continue;
		const match = SIZE_TAG_MATCH_RE.exec(part);
		if (match) {
			if (match[1]) {
				segments.push({ text: match[1], scale: SMALL_TEXT_SCALE });
			}
		} else {
			segments.push({ text: part, scale: 1 });
		}
	}
	return segments;
}
