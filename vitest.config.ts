import path from "node:path";
import { defineConfig } from "vitest/config";

const r = (...parts: string[]) => path.resolve(__dirname, ...parts);

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		include: [
			"{app,cmmn,launch,hooks,electron,.github}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
		],
		exclude: ["**/node_modules/**", "**/*.browser.test.{ts,tsx}"],
	},
	resolve: {
		alias: [
			{ find: "@/components/launch", replacement: r("launch") },
			{ find: "@/components", replacement: r("cmmn/components") },
			{ find: "@/lib", replacement: r("cmmn/lib") },
			{ find: "@/hooks", replacement: r("hooks") },
			{ find: "@/contexts", replacement: r("cmmn/contexts") },
			{ find: "@/i18n", replacement: r("cmmn/i18n") },
			{ find: "@/native", replacement: r("cmmn/native") },
			{ find: "@/utils", replacement: r("cmmn/utils") },
			{ find: "@/assets", replacement: r("cmmn/assets") },
		],
	},
});
