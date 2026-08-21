import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

// Capture desktop app. Self-contained: shared code lives in ./cmmn, editing
// lives in the hosted web editor (editor imports are swapped for stubs), so
// this folder builds standalone — which is what the public mirror ships.
const r = (...parts: string[]) => path.resolve(__dirname, ...parts);
const stub = r("cmmn/lib/vite-stubs/empty-node-module.ts");

export default defineConfig({
	plugins: [
		react(),
		electron({
			main: {
				entry: "electron/main.ts",
				onstart({ startup }) {
					const env = { ...process.env };
					delete env.ELECTRON_RUN_AS_NODE;
					return startup(["."], { env });
				},
				vite: {
					build: {},
				},
			},
			preload: {
				input: r("electron/preload.ts"),
			},
			renderer: process.env.NODE_ENV === "test" ? undefined : {},
		}),
	],
	resolve: {
		alias: [
			// Editor swaps — must precede the generic maps.
			{ find: "@/components/video-editor/VideoEditor", replacement: r("VideoEditorWebHandoff.tsx") },
			{
				find: "@/components/video-editor/ShortcutsConfigDialog",
				replacement: r("stubs/ShortcutsConfigDialog.tsx"),
			},
			{ find: "@/lib/exporter/localSourceFile", replacement: r("stubs/localSourceFile.ts") },
			// Shared-code maps (import specifiers keep the historical "@/..." shape).
			{ find: "@/components/launch", replacement: r("launch") },
			{ find: "@/components", replacement: r("cmmn/components") },
			{ find: "@/lib", replacement: r("cmmn/lib") },
			{ find: "@/hooks", replacement: r("hooks") },
			{ find: "@/contexts", replacement: r("cmmn/contexts") },
			{ find: "@/i18n", replacement: r("cmmn/i18n") },
			{ find: "@/native", replacement: r("cmmn/native") },
			{ find: "@/utils", replacement: r("cmmn/utils") },
			{ find: "@/assets", replacement: r("cmmn/assets") },
			// @xenova/transformers-style node imports must not reach the renderer.
			{ find: "fs", replacement: stub },
			{ find: "path", replacement: stub },
			{ find: "url", replacement: stub },
		],
	},
	worker: {
		format: "es",
	},
	build: {
		target: "esnext",
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				pure_funcs: ["console.log", "console.debug"],
			},
		},
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
				},
			},
		},
		chunkSizeWarningLimit: 1000,
	},
});
