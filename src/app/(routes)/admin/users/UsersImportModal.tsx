"use client";

// Bulk import from a spreadsheet: pick a CSV, preview what would happen,
// then import for real. The template shows the accepted columns.

import { useState } from "react";
import { Modal, PrimaryButton, SecondaryButton } from "../_shared/ui";
import { API_BASE, apiForm } from "../_shared/api";

interface Row {
  line: number;
  email: string;
  /** The row's name, for rows with no email to name them by. */
  name?: string;
  reason: string;
}

interface Report {
  total: number;
  created: number;
  memberships: number;
  /** Members coming in with no email address (they sign in with their username). */
  withoutEmail?: number;
  inactive?: number;
  /** The recognised columns this file has. */
  columns?: string[];
  skipped: Row[];
  errors: Row[];
  dryRun: boolean;
}

// The same example the API's /admin/users/import/template serves: one member
// with an email, one without.
const TEMPLATE_CSV =
  "firstName,lastName,email,phone,dateOfBirth,gender,address,memberCode,joiningDate,active,package,startDate,endDate,paid,amount,discount,notes\n" +
  'Jane,Doe,jane@example.com,+447700900000,1990-05-14,female,"12 High Street, Leeds",GP-0101,2024-03-02,yes,Monthly,2026-09-01,2026-10-01,yes,40,,Came from the old system\n' +
  "Ali,Khan,,+923001234567,,male,,,2025-01-15,yes,Monthly,2026-09-01,2026-10-01,yes,,5,Pays at the desk\n";

// What each recognised column is called in the preview.
const COLUMN_LABELS: Record<string, string> = {
  firstName: "first name",
  lastName: "last name",
  fullName: "full name",
  email: "email",
  phone: "phone",
  dateOfBirth: "date of birth",
  gender: "gender",
  address: "address",
  memberCode: "member ID",
  joinedAt: "joining date",
  active: "active",
  package: "package",
  startDate: "start",
  endDate: "end",
  paid: "paid",
  amount: "amount",
  discount: "discount",
  notes: "notes",
};

function who(row: Row) {
  return row.email || row.name || "no email";
}

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
        <div className="space-y-2 text-sm text-neutral-600">
          <p>
            One row per member. Each row needs a name and an <span className="font-mono text-xs">email</span> <em>or</em> a{" "}
            <span className="font-mono text-xs">phone</span> number. The name can be <span className="font-mono text-xs">firstName</span> and{" "}
            <span className="font-mono text-xs">lastName</span>, or one <span className="font-mono text-xs">name</span> column (the first word
            is the first name).
          </p>
          <p>
            Also read: <span className="font-mono text-xs">dateOfBirth, gender, address, memberCode, joiningDate</span> (when they first
            joined — shown as their joined date), <span className="font-mono text-xs">active</span> (yes/no, active/inactive, 1/0; blank is
            active), and for a membership <span className="font-mono text-xs">package, startDate, endDate, paid, amount, discount, notes</span>{" "}
            — a package name that matches one of yours creates a membership with the dates given.
          </p>
          <p>
            Nobody is emailed. Members with an email set a password with &quot;Forgot password&quot;; members without one sign in with their
            username once you give them a password (Set password on the Users list). Preview first: nothing is written until you import.
          </p>
        </div>
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
            {(!!report.withoutEmail || !!report.inactive) && (
              <p className="mt-1 text-xs text-neutral-600">
                {report.withoutEmail ? `${report.withoutEmail} without an email (they sign in with their username). ` : ""}
                {report.inactive ? `${report.inactive} imported as inactive.` : ""}
              </p>
            )}
            {report.columns && report.columns.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                Columns read: {report.columns.map((c) => COLUMN_LABELS[c] || c).join(", ")}
              </p>
            )}
            {report.skipped.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-neutral-600">
                {report.skipped.map((s) => (
                  <li key={`${s.line}-${s.email}-${s.name || ""}`}>
                    Line {s.line} ({who(s)}): {s.reason}
                  </li>
                ))}
              </ul>
            )}
            {report.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-amber-800">
                {report.errors.map((s, i) => (
                  <li key={`${s.line}-${i}-e`}>
                    Line {s.line} ({who(s)}): {s.reason}
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
