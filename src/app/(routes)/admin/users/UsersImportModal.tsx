"use client";

// Bulk import from a spreadsheet: pick a CSV, preview what would happen,
// then import for real. The template shows the accepted columns.

import { useState } from "react";
import { Modal, PrimaryButton, SecondaryButton } from "../_shared/ui";
import { API_BASE, apiForm } from "../_shared/api";

interface Report {
  total: number;
  created: number;
  memberships: number;
  skipped: { line: number; email: string; reason: string }[];
  errors: { line: number; email: string; reason: string }[];
  dryRun: boolean;
}

const TEMPLATE_CSV =
  "firstName,lastName,email,phone,dateOfBirth,gender,memberCode,package,startDate,endDate,paid,amount,notes\n" +
  "Jane,Doe,jane@example.com,+447700900000,1990-05-14,female,GP-0101,Monthly,2026-09-01,2026-10-01,yes,40,From the old system\n";

export default function UsersImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(dryRun ? "preview" : "import");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("dryRun", dryRun ? "1" : "0");
      // Through the shared helper so an oversized file or a plan limit comes
      // back as a sentence rather than a parse error.
      const json = await apiForm<{ data: Report }>(`${API_BASE}/admin/users/import`, "POST", form);
      setReport(json.data);
      if (!dryRun) onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gympilot-members-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const close = () => {
    setFile(null);
    setReport(null);
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Import members from CSV" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          One row per member. Columns: <span className="font-mono text-xs">firstName, lastName, email, phone, dateOfBirth, gender, memberCode, package, startDate, endDate, paid, amount, notes</span>. Only <span className="font-mono text-xs">email</span> is required; a <span className="font-mono text-xs">package</span> name that matches one of your packages creates a membership with the dates given. Members are not emailed — they set a password with &quot;Forgot password&quot; when they first sign in.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setReport(null); }} className="text-sm" />
          <button type="button" onClick={downloadTemplate} className="text-xs font-semibold text-neutral-700 underline underline-offset-2">
            Download template
          </button>
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {report && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <p className="font-semibold text-neutral-900">
              {report.dryRun ? "Preview" : "Done"}: {report.created} of {report.total} member(s) {report.dryRun ? "would be" : ""} created, {report.memberships} membership(s), {report.skipped.length} skipped
            </p>
            {report.skipped.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-neutral-600">
                {report.skipped.map((s) => (
                  <li key={`${s.line}-${s.email}`}>
                    Line {s.line} ({s.email || "no email"}): {s.reason}
                  </li>
                ))}
              </ul>
            )}
            {report.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-amber-800">
                {report.errors.map((s) => (
                  <li key={`${s.line}-${s.email}-e`}>
                    Line {s.line} ({s.email || "no email"}): {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={close}>Close</SecondaryButton>
          <SecondaryButton onClick={() => run(true)} disabled={!file || !!busy}>
            {busy === "preview" ? "Checking…" : "Preview"}
          </SecondaryButton>
          <PrimaryButton onClick={() => run(false)} disabled={!file || !!busy}>
            {busy === "import" ? "Importing…" : "Import"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
