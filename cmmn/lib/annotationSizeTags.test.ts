import { describe, expect, it } from "vitest";
import { parseSizeTagSegments, SMALL_TEXT_SCALE } from "./annotationSizeTags";

describe("parseSizeTagSegments", () => {
	it("returns plain text as a single full-size segment", () => {
		expect(parseSizeTagSegments("hello world")).toEqual([{ text: "hello world", scale: 1 }]);
	});

	it("returns no segments for empty content", () => {
		expect(parseSizeTagSegments("")).toEqual([]);
	});

	it("parses a wrapped stretch at the small scale with tags stripped", () => {
		expect(parseSizeTagSegments("big <s>small</s> big")).toEqual([
			{ text: "big ", scale: 1 },
			{ text: "small", scale: SMALL_TEXT_SCALE },
			{ text: " big", scale: 1 },
		]);
	});

	it("parses multiple tagged stretches", () => {
		expect(parseSizeTagSegments("<s>a</s>b<s>c</s>")).toEqual([
			{ text: "a", scale: SMALL_TEXT_SCALE },
			{ text: "b", scale: 1 },
			{ text: "c", scale: SMALL_TEXT_SCALE },
		]);
	});

	it("keeps newlines inside a tagged stretch", () => {
		expect(parseSizeTagSegments("<s>two\nlines</s>")).toEqual([
			{ text: "two\nlines", scale: SMALL_TEXT_SCALE },
		]);
	});

	it("treats unmatched tags as literal text", () => {
		expect(parseSizeTagSegments("broken <s>tag")).toEqual([{ text: "broken <s>tag", scale: 1 }]);
	});

	it("drops empty tagged stretches", () => {
		expect(parseSizeTagSegments("a<s></s>b")).toEqual([
			{ text: "a", scale: 1 },
			{ text: "b", scale: 1 },
		]);
	});
});
