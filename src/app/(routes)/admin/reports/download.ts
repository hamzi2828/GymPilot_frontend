import { authHeaders } from "../_shared/api";

export type ExportFormat = "csv" | "xlsx";

export const FORMAT_LABELS: Record<ExportFormat, string> = { csv: "CSV", xlsx: "Excel" };

/**
 * Fetches an export with the session's token and saves it under the name the
 * server gave it. A plain link would not carry the Authorization header.
 */
export async function downloadExport(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const name = (res.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}
