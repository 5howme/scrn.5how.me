import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";

/**
 * Local handoff bridge for the hosted web editor.
 *
 * Serves the current recording (screen video, optional webcam video, cursor
 * data) over 127.0.0.1 so the web editor page can fetch it. Browsers exempt
 * loopback from mixed-content blocking, so an https editor page may fetch it;
 * access is limited by a per-handoff token plus an exact Origin allowlist, and
 * Chrome's Private Network Access preflight is answered explicitly.
 */

export interface WebHandoffPayload {
	editorOrigin: string;
	screenVideoPath: string;
	webcamVideoPath?: string;
	cursorCaptureMode?: string;
	cursorRecordingData?: unknown;
	cursorTelemetry?: unknown;
}

const VIDEO_MIME: Record<string, string> = {
	".mp4": "video/mp4",
	".webm": "video/webm",
	".mov": "video/quicktime",
	".mkv": "video/x-matroska",
	".m4v": "video/x-m4v",
	".avi": "video/x-msvideo",
};

let server: Server | null = null;
let serverPort = 0;
let current: (WebHandoffPayload & { token: string }) | null = null;

function setCorsHeaders(res: ServerResponse, origin: string) {
	res.setHeader("Access-Control-Allow-Origin", origin);
	res.setHeader("Vary", "Origin");
}

async function streamVideoFile(res: ServerResponse, filePath: string) {
	const info = await stat(filePath);
	res.writeHead(200, {
		"Content-Type": VIDEO_MIME[path.extname(filePath).toLowerCase()] ?? "video/mp4",
		"Content-Length": info.size,
		"Cache-Control": "no-store",
	});
	createReadStream(filePath).pipe(res);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
	const payload = current;
	const origin = req.headers.origin;

	if (!payload) {
		res.writeHead(404).end();
		return;
	}

	if (req.method === "OPTIONS") {
		if (origin !== payload.editorOrigin) {
			res.writeHead(403).end();
			return;
		}
		setCorsHeaders(res, payload.editorOrigin);
		res.writeHead(204, {
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "*",
			// Chrome Private Network Access: public https page -> loopback
			"Access-Control-Allow-Private-Network": "true",
			"Access-Control-Max-Age": "600",
		});
		res.end();
		return;
	}

	// Browser requests carry Origin; token alone gates non-browser clients.
	if (req.method !== "GET" || (origin && origin !== payload.editorOrigin)) {
		res.writeHead(403).end();
		return;
	}

	const url = new URL(req.url ?? "/", "http://127.0.0.1");
	if (url.searchParams.get("token") !== payload.token) {
		res.writeHead(403).end();
		return;
	}

	setCorsHeaders(res, payload.editorOrigin);

	try {
		switch (url.pathname) {
			case "/handoff": {
				const body = JSON.stringify({
					name: path.basename(payload.screenVideoPath),
					video: "/video",
					webcam: payload.webcamVideoPath ? "/webcam" : undefined,
					webcamName: payload.webcamVideoPath
						? path.basename(payload.webcamVideoPath)
						: undefined,
					cursorCaptureMode: payload.cursorCaptureMode,
					cursorRecordingData: payload.cursorRecordingData,
					cursorTelemetry: payload.cursorTelemetry,
				});
				res.writeHead(200, {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
				});
				res.end(body);
				return;
			}
			case "/video":
				await streamVideoFile(res, payload.screenVideoPath);
				return;
			case "/webcam":
				if (!payload.webcamVideoPath) {
					res.writeHead(404).end();
					return;
				}
				await streamVideoFile(res, payload.webcamVideoPath);
				return;
			default:
				res.writeHead(404).end();
				return;
		}
	} catch (error) {
		console.error("Web handoff request failed:", error);
		if (!res.headersSent) {
			res.writeHead(500);
		}
		res.end();
	}
}

/** Publishes the payload on the loopback bridge and returns its address. */
export async function startWebHandoff(
	payload: WebHandoffPayload,
): Promise<{ port: number; token: string }> {
	current = { ...payload, token: randomBytes(16).toString("hex") };

	if (!server) {
		server = createServer((req, res) => {
			void handleRequest(req, res);
		});
		await new Promise<void>((resolve, reject) => {
			server?.once("error", reject);
			server?.listen(0, "127.0.0.1", () => resolve());
		});
		const address = server.address();
		if (!address || typeof address === "string") {
			throw new Error("Web handoff server failed to bind a port");
		}
		serverPort = address.port;
	}

	return { port: serverPort, token: current.token };
}
