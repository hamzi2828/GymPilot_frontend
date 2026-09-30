// Settings → Data & backup: the calls behind it. The backend side is
// controller/backupController.js; every call is administrators-only there.

import { put } from "@vercel/blob/client";
import { API_BASE, ApiError, apiGet, apiJson, authHeaders } from "../_shared/api";

export const BACKUPS_API = `${API_BASE}/api/backups`;

export type BackupKind = "daily" | "manual" | "pre-restore";

/** A backup the server keeps (encrypted, in its file storage). */
export interface StoredBackup {
  id: string;
  kind: BackupKind;
  createdAt: string;
  takenAt: string | null;
  size: number;
  documents: number;
  collections: number;
  createdBy: string | null;
}

export interface BackupOverview {
  /** Whether this server can store backups; `reason` says why not. */
  ready: boolean;
  reason: string | null;
  /** How many of each kind are kept. */
  keep: number;
  backups: StoredBackup[];
}

export const KIND_LABELS: Record<BackupKind, string> = {
  daily: "Daily",
  manual: "Backed up now",
  "pre-restore": "Before a restore",
};

export async function listBackups(): Promise<BackupOverview> {
  const r = await apiGet<{ data: BackupOverview }>(BACKUPS_API);
  return r.data;
}

/** Makes and stores a backup now. */
export async function backUpNow(): Promise<StoredBackup> {
  const r = await apiJson<{ data: StoredBackup }>(`${BACKUPS_API}/run`, "POST");
  return r.data;
}

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

/** A stored backup, opened by the server and saved as the same .tar.gz. */
export async function downloadStoredBackup(id: string) {
  let res: Response;
  try {
    res = await fetch(`${BACKUPS_API}/${encodeURIComponent(id)}/download`, { method: "POST", headers: authHeaders() });
  } catch {
    throw new Error("Could not reach the server — check your connection and try again.");
  }
  if (!res.ok) throw await failure(res, "The backup could not be downloaded.");
  return saveResponse(res, "gym-backup.tar.gz");
}

/* --------------------------------- restore --------------------------------- */

/** What a backup holds, read in full by the server without changing anything. */
export interface RestorePreview {
  backup: { id: string; kind: BackupKind | "upload" };
  gym: { id: string; slug: string; name: string } | null;
  createdAt: string;
  trigger: string;
  /** False for another gym's backup, which `refusal` explains; it cannot be restored. */
  sameGym: boolean;
  refusal: string | null;
  /** `kept`: left as it is by a restore (the audit log). */
  collections: { name: string; documents: number; indexes: number; kept: boolean }[];
  documents: number;
  /** False when the account doing the restore is not in the backup. */
  actorInBackup: boolean;
  /** What must be typed to confirm: the gym's slug. */
  confirmWith: string;
}

export interface RestoreResult {
  collections: { name: string; documents: number }[];
  documents: number;
  dropped: string[];
  kept: string[];
  safetyBackup: string;
  /** Every session ended with the restore, this one included. */
  signedOut?: boolean;
  /**
   * The phone app's usernames, rebuilt from the restored accounts: `taken`
   * are ones another gym's member has had since, which need a new username.
   */
  memberLogins?: { published: number; taken: string[] } | { error: string };
}

export async function previewRestore(backupId: string): Promise<RestorePreview> {
  const r = await apiJson<{ data: RestorePreview }>(`${BACKUPS_API}/restore/preview`, "POST", { backupId });
  return r.data;
}

export async function restoreBackup(backupId: string, confirm: string): Promise<RestoreResult> {
  const r = await apiJson<{ data: RestoreResult }>(`${BACKUPS_API}/restore`, "POST", { backupId, confirm });
  return r.data;
}

interface UploadGrant {
  uploadId: string;
  pathname: string;
  clientToken: string;
  /** base64: the 49 bytes the encrypted file starts with. */
  header: string;
  /** base64: the AES-256-GCM key for this one file. */
  key: string;
  chunkBytes: number;
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const text = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(text.length));
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes;
}

/**
 * Sends a backup file the owner picked to the server's storage, to restore
 * from, and resolves to the id to preview and restore it by.
 *
 * The file is the whole membership in plain text and the store is public,
 * so it is encrypted here first, in the stored backups' own format (the
 * backend's services/backupCrypto.js): the grant's header, then the file in
 * chunks, each sealed with AES-GCM under the grant's key -- nonce = 7 zero
 * bytes, the chunk number (4 bytes, big-endian), and 1 on the last chunk --
 * with the header as additional data. The key is good for this one file.
 *
 * Then straight to the store with a client token (files this size cannot go
 * through the API: Vercel refuses request bodies over 4.5 MB).
 */
export async function uploadBackupFile(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser cannot encrypt the file before sending it. Use a current browser over https.");
  }
  const grant = (await apiJson<{ data: UploadGrant }>(`${BACKUPS_API}/uploads`, "POST", { size: file.size })).data;
  const header = fromBase64(grant.header);
  const key = await crypto.subtle.importKey("raw", fromBase64(grant.key), "AES-GCM", false, ["encrypt"]);

  const count = Math.max(1, Math.ceil(file.size / grant.chunkBytes));
  const parts: BlobPart[] = [header];
  for (let i = 0; i < count; i += 1) {
    const piece = await file.slice(i * grant.chunkBytes, (i + 1) * grant.chunkBytes).arrayBuffer();
    const iv = new Uint8Array(12);
    new DataView(iv.buffer).setUint32(7, i);
    iv[11] = i === count - 1 ? 1 : 0;
    parts.push(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: header, tagLength: 128 }, key, piece));
    onProgress?.(((i + 1) / count) * 0.5);
  }
  const sealed = new Blob(parts, { type: "application/octet-stream" });

  let url: string;
  try {
    const blob = await put(grant.pathname, sealed, {
      access: "public",
      token: grant.clientToken,
      contentType: "application/octet-stream",
      multipart: true,
    });
    url = blob.url;
  } catch (e) {
    console.error("[backup] upload failed", e);
    throw new Error("The upload didn't finish — check your connection and try again.");
  }
  onProgress?.(1);
  await apiJson(`${BACKUPS_API}/uploads/${encodeURIComponent(grant.uploadId)}/complete`, "POST", { url });
  return grant.uploadId;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
