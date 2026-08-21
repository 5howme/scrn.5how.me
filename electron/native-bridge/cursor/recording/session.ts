import type { CursorRecordingData } from "../../../../cmmn/native/contracts";

export interface CursorRecordingSession {
	start(): Promise<void>;
	stop(): Promise<CursorRecordingData>;
}
