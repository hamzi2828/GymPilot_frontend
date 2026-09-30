// Settings → Data & backup: the calls behind it. The backend side is
// controller/backupController.js; every call is administrators-only there.

import { API_BASE, ApiError, authHeaders } from "../_shared/api";

export const BACKUPS_API = `${API_BASE}/api/backups`;

// The reason a failed file response gives, read the way the shared client
// reads a JSON error, so the message is fit to show.
async function failure(res: Response, fallback: string): Promise<ApiError> {
  let message = "";
  let code: string | undefined;
  try {
    const body = await res.json();
    message = typeof body?.message === "string" ? body.message : "";
    code = typeof body?.code === "string" ? body.code : undefined;
  } catch {
    /* not JSON: a proxy's error page */
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) message = message || "The server didn't respond — please try again.";
  return new ApiError(message || fallback, res.status, code);
}

/** Saves a file response to the computer under the name the server gave it. */
async function saveResponse(res: Response, fallbackName: string) {
  let blob: Blob;
  try {
    blob = await res.blob();
  } catch {
    // The archive is streamed as it is read: a connection that drops, or a
    // server that fails part-way, cuts the file off rather than answering.
    throw new Error("The download was interrupted before it finished. Please try again.");
  }
  const name = (res.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { name, size: blob.size };
}

/** The whole gym, now, as a .tar.gz (POST so the server's audit log records it). */
export async function downloadFullBackup() {
  let res: Response;
  try {
    res = await fetch(`${BACKUPS_API}/download`, { method: "POST", headers: authHeaders() });
  } catch {
    throw new Error("Could not reach the server — check your connection and try again.");
  }
  if (!res.ok) throw await failure(res, "The backup could not be made.");
  return saveResponse(res, "gym-backup.tar.gz");
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
