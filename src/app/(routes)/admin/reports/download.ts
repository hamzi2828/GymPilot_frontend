import { apiBlob } from "../_shared/api";

export type ExportFormat = "csv" | "xlsx";

export const FORMAT_LABELS: Record<ExportFormat, string> = { csv: "CSV", xlsx: "Excel" };

/**
 * Fetches an export with the session's token and saves it under the name the
 * server gave it. A plain link would not carry the Authorization header.
 */
export async function downloadExport(url: string, fallbackName: string): Promise<void> {
  const { blob, filename } = await apiBlob(url);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || fallbackName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}
