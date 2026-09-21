// Files too large for the API go from the browser straight to Vercel Blob.
//
// On Vercel the API refuses any request body over 4.5 MB, so its upload routes
// stop at 4 MB there. A file over the API's limit for its kind is put in the
// store directly instead: the API hands out a client token good for one path
// in this gym's folder (POST /api/uploads/blob -- see the backend's
// controller/uploadController.js), and the browser put()s the file with it.
// Smaller files, and every file on a server without Blob storage, go the way
// they always have; the caller keeps that path and this only says when to
// use it.
//
// Why put() and not upload(): in @vercel/blob 0.23 upload() fetches its token
// with a bare fetch that cannot carry the Authorization header, and the token
// route needs a signed-in staff account. So the token is fetched with the
// panel's own client and handed to put(). Neither reports progress in this
// version.

import { put } from "@vercel/blob/client";
import { API_BASE, apiGet, apiJson } from "../_shared/api";

/** What is being uploaded; each has its own permission, folder, types and ceiling on the API. */
export type DirectUploadKind = "homepage-image" | "homepage-video" | "hero-slide" | "testimonial";

interface KindLimits {
  apiMaxBytes: number;
  directMaxBytes: number;
  contentTypes: string[];
}

interface UploadCapabilities {
  direct: boolean;
  kinds: Partial<Record<DirectUploadKind, KindLimits>>;
}

const UPLOADS_API = `${API_BASE}/api/uploads`;
const MB = 1024 * 1024;

/** A file that can't be uploaded here at all. `message` is fit to show as-is. */
export class UploadRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRefused";
  }
}

let capabilities: Promise<UploadCapabilities | null> | null = null;

// Asked once per page load. An API without the route, or any failure, reads
// as "no direct uploads" -- which leaves every file on the old path -- and is
// asked again next time.
function loadCapabilities(): Promise<UploadCapabilities | null> {
  if (!capabilities) {
    capabilities = apiGet<{ data?: UploadCapabilities }>(`${UPLOADS_API}/capabilities`)
      .then((r) => r.data ?? null)
      .catch(() => {
        capabilities = null;
        return null;
      });
  }
  return capabilities;
}

function megabytes(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}

function describeTypes(types: string[]): string {
  const names = types.map((t) => (t.split("/")[1] || t).toUpperCase().replace("JPEG", "JPG"));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names.join("");
}

/** The largest file of this kind that can be uploaded at all, or null when the API doesn't say. */
export async function uploadLimit(kind: DirectUploadKind): Promise<number | null> {
  const caps = await loadCapabilities();
  const limits = caps?.kinds?.[kind];
  if (!caps || !limits) return null;
  return caps.direct ? Math.max(limits.apiMaxBytes, limits.directMaxBytes) : limits.apiMaxBytes;
}

/**
 * Sends `file` straight to storage when it is too large for the API.
 *
 * Resolves to the stored file's URL, or to null when the file is small
 * enough for the API route the caller already uses (send it that way).
 * Throws UploadRefused when it can go neither way, or an Error when the
 * upload itself fails.
 */
export async function directUploadIfLarge(kind: DirectUploadKind, file: File): Promise<string | null> {
  const caps = await loadCapabilities();
  const limits = caps?.kinds?.[kind];
  if (!caps || !limits || file.size <= limits.apiMaxBytes) return null;

  const size = `${(file.size / MB).toFixed(1)} MB`;
  if (!caps.direct) {
    throw new UploadRefused(`This file is ${size} — uploads here stop at ${megabytes(limits.apiMaxBytes)}. Compress it and try again.`);
  }
  if (file.size > limits.directMaxBytes) {
    throw new UploadRefused(`This file is ${size} — the most that can be uploaded here is ${megabytes(limits.directMaxBytes)}.`);
  }
  if (!limits.contentTypes.includes(file.type)) {
    throw new UploadRefused(`Files over ${megabytes(limits.apiMaxBytes)} must be ${describeTypes(limits.contentTypes)}.`);
  }

  // The event handleUpload() expects. The path here is only a file name: the
  // API picks the real one and says which it is.
  const grant = await apiJson<{ clientToken?: string; pathname?: string }>(`${UPLOADS_API}/blob`, "POST", {
    type: "blob.generate-client-token",
    payload: {
      pathname: file.name,
      callbackUrl: "",
      clientPayload: JSON.stringify({ kind, contentType: file.type, size: file.size }),
      multipart: false,
    },
  });
  if (!grant.clientToken || !grant.pathname) {
    throw new Error("Could not start the upload — please try again.");
  }

  try {
    const blob = await put(grant.pathname, file, {
      access: "public",
      token: grant.clientToken,
      contentType: file.type,
    });
    return blob.url;
  } catch (e) {
    console.error("[upload] direct upload failed", e);
    throw new Error("The upload didn't finish — check your connection and try again.");
  }
}
