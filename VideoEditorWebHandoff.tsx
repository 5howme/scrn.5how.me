import { ExternalLink, FolderOpen, Video } from "lucide-react";
import { useEffect, useState } from "react";

// Capture-only build stub (Phase 0): replaces VideoEditor via vite.config.ts
// alias. Editing happens in the hosted web editor; this screen hands the
// finished recording off to it.

const WEB_EDITOR_URL = import.meta.env.VITE_WEB_EDITOR_URL || "https://scrn.5how.me";

async function openWebEditor() {
	// Publish the current recording on the loopback bridge, then open the web
	// editor with the bridge address in the URL hash (never sent to any server).
	try {
		const api = window.electronAPI as typeof window.electronAPI & {
			startWebHandoff?: (
				editorOrigin: string,
			) => Promise<{ success: boolean; port?: number; token?: string }>;
		};
		const result = await api.startWebHandoff?.(new URL(WEB_EDITOR_URL).origin);
		if (result?.success && result.port && result.token) {
			window.electronAPI.openExternalUrl(`${WEB_EDITOR_URL}/#hand=${result.port}/${result.token}`);
			return;
		}
	} catch {
		// fall through to a plain open
	}
	window.electronAPI.openExternalUrl(WEB_EDITOR_URL);
}

export default function VideoEditorWebHandoff() {
	const [videoPath, setVideoPath] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const session = await window.electronAPI.getCurrentRecordingSession();
				if (session.success && session.session?.screenVideoPath) {
					setVideoPath(session.session.screenVideoPath.replace(/^file:\/\/\/?/, ""));
					return;
				}
				const current = await window.electronAPI.getCurrentVideoPath();
				if (current.success && current.path) {
					setVideoPath(current.path);
				}
			} catch {
				// leave empty state
			}
		})();
	}, []);

	return (
		<div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-[#09090b] px-6 text-center">
			<img src="./openscreen.png" alt="" aria-hidden="true" className="h-16 w-16 rounded-2xl opacity-90" />

			<div className="flex flex-col gap-2">
				<h2 className="text-xl font-semibold text-slate-200">Recording ready</h2>
				<p className="max-w-md text-sm leading-relaxed text-slate-500">
					Editing now lives in the web editor. Open it and import the recording file below.
				</p>
				{videoPath && (
					<p className="mx-auto max-w-md break-all rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
						{videoPath}
					</p>
				)}
			</div>

			<div className="flex w-full max-w-xs flex-col gap-3">
				<button
					type="button"
					onClick={() => void openWebEditor()}
					className="flex items-center justify-center gap-2.5 rounded-xl bg-[#34B27B] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2d9e6c]"
				>
					<ExternalLink className="h-4 w-4" />
					Open Web Editor
				</button>
				{videoPath && (
					<button
						type="button"
						onClick={() => window.electronAPI.revealInFolder(videoPath)}
						className="flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
					>
						<FolderOpen className="h-4 w-4" />
						Show Recording in Folder
					</button>
				)}
				<button
					type="button"
					onClick={() => window.electronAPI.switchToHud()}
					className="flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
				>
					<Video className="h-4 w-4" />
					Back to Recorder
				</button>
			</div>
		</div>
	);
}
