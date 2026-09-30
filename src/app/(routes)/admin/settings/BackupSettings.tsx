"use client";

// Settings → Data & backup: the whole gym as one file, on demand, the
// encrypted backups the server keeps (made every night, or with "Back up
// now"), and restoring from one of those or from a downloaded file. Only the
// gym's administrators can use it (the API checks the same thing again): a
// backup is every member's personal data at once.

import { useCallback, useEffect, useState } from "react";
import { Card, PrimaryButton, SecondaryButton, Badge, Spinner } from "../_shared/ui";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import {
  backUpNow,
  downloadFullBackup,
  downloadStoredBackup,
  formatBytes,
  listBackups,
  uploadBackupFile,
  KIND_LABELS,
  type BackupOverview,
  type RestoreResult,
} from "./backupApi";
import RestoreDialog from "./RestoreDialog";

type Notice = { tone: "ok" | "warn" | "error"; text: string };

const NOTICE_STYLES: Record<Notice["tone"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

function Heading({ title, hint, actions }: { title: string; hint?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function BackupSettings() {
  const { me, can, loading } = usePermissions();
  const isOwner = !!me && me.role === "admin" && can("settings", "manage");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<{ id: string; label: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await listBackups());
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not load the backups");
    }
  }, []);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  const download = async () => {
    setDownloading(true);
    setNotice(null);
    try {
      const file = await downloadFullBackup();
      setNotice({ tone: "ok", text: `Saved ${file.name} (${formatBytes(file.size)}). Keep it somewhere safe: it holds every member's details.` });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "The backup could not be made." });
    } finally {
      setDownloading(false);
    }
  };

  const runNow = async () => {
    setBusy("run");
    setNotice(null);
    try {
      const made = await backUpNow();
      setNotice({ tone: "ok", text: `Backup stored (${formatBytes(made.size)}, ${made.documents.toLocaleString()} records).` });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "The backup could not be stored." });
    } finally {
      setBusy(null);
    }
  };

  const downloadStored = async (id: string) => {
    setBusy(`download:${id}`);
    setNotice(null);
    try {
      const file = await downloadStoredBackup(id);
      setNotice({ tone: "ok", text: `Saved ${file.name} (${formatBytes(file.size)}).` });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "The backup could not be downloaded." });
    } finally {
      setBusy(null);
    }
  };

  const uploadFile = async (file: File) => {
    setNotice(null);
    setUploadProgress(0);
    try {
      const id = await uploadBackupFile(file, setUploadProgress);
      setRestoring({ id, label: file.name });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "The file could not be uploaded." });
    } finally {
      setUploadProgress(null);
    }
  };

  const restored = async (result: RestoreResult) => {
    setRestoring(null);
    // The phone app's usernames are rebuilt with the restore; any another
    // gym's member took in the meantime stay theirs, and those members need
    // a new one (Users → username).
    const logins = result.memberLogins;
    const loginsNote = !logins
      ? ""
      : "error" in logins
        ? ` ${logins.error}`
        : logins.taken.length
          ? ` These usernames were taken by another gym's member since the backup, so give those members new ones: ${logins.taken.join(", ")}.`
          : "";
    setNotice({
      tone: "ok",
      text: `Restored ${result.documents.toLocaleString()} records in ${result.collections.length} collections. The gym as it was just before is kept as a backup listed "Before a restore".${
        result.signedOut ? " Everyone has been signed out, you included: sign in again to carry on." : ""
      }${loginsNote}`,
    });
    // This session ended with the restore, so a reload would only find that
    // out and leave for the sign-in page before the notice could be read.
    if (!result.signedOut) await load();
  };

  if (loading) return <Spinner />;

  if (!isOwner) {
    return (
      <Card className="p-6">
        <Heading title="Data & backup" />
        <p className="text-sm text-neutral-600">
          Only the gym&apos;s administrators can download or restore backups: a backup holds every member&apos;s personal data at once.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${NOTICE_STYLES[notice.tone]}`}>
          <span className="min-w-0">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <Card className="p-6">
        <Heading
          title="Download a full backup"
          hint="Everything in your gym — members, memberships, bookings, attendance, payments, staff, settings — as one compressed file, made now."
        />
        <ul className="mb-5 list-disc space-y-1 pl-5 text-xs text-neutral-600">
          <li>A .tar.gz archive: one file per collection, one record per line (MongoDB Extended JSON), with each collection&apos;s indexes.</li>
          <li>Card, email and messaging keys stay encrypted inside it; they only work again when restored into this gym.</li>
          <li>It does hold members&apos; personal details. Store it somewhere private.</li>
        </ul>
        <PrimaryButton onClick={download} disabled={downloading}>
          {downloading ? "Preparing backup…" : "Download full backup"}
        </PrimaryButton>
      </Card>

      <Card className="p-6">
        <Heading
          title="Stored backups"
          hint={
            overview
              ? `Made every night and kept encrypted. The last ${overview.keep} daily backups are kept, and the last ${overview.keep} of each other kind.`
              : "Made every night and kept encrypted."
          }
          actions={
            overview?.ready ? (
              <SecondaryButton onClick={runNow} disabled={busy !== null}>
                {busy === "run" ? "Backing up…" : "Back up now"}
              </SecondaryButton>
            ) : undefined
          }
        />

        {listError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {listError}{" "}
            <button type="button" className="underline" onClick={load}>
              Try again
            </button>
          </div>
        )}

        {overview && !overview.ready && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Daily backups are not running on this server yet.</p>
            <p className="mt-1 text-xs">
              {overview.reason} Until the platform sets this up, use &ldquo;Download full backup&rdquo; above and keep the file yourself.
            </p>
          </div>
        )}

        {!overview && !listError ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : overview && overview.backups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
            <p className="text-sm font-medium text-neutral-900">No stored backups yet</p>
            <p className="mt-1 text-xs text-neutral-500">
              {overview.ready ? "The first one is made tonight — or now, with “Back up now”." : "They appear here once the server can store them."}
            </p>
          </div>
        ) : overview ? (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                  <th className="px-4 py-2.5">Taken</th>
                  <th className="px-4 py-2.5">Kind</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5">Records</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {overview.backups.map((b) => (
                  <tr key={b.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-800">
                      {when(b.takenAt || b.createdAt)}
                      {b.createdBy && <span className="block text-[11px] text-neutral-500">by {b.createdBy}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={b.kind === "daily" ? "blue" : b.kind === "pre-restore" ? "amber" : "neutral"}>{KIND_LABELS[b.kind] || b.kind}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-700">{formatBytes(b.size)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                      {b.documents.toLocaleString()} <span className="text-[11px] text-neutral-500">in {b.collections} collections</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <SecondaryButton onClick={() => downloadStored(b.id)} disabled={busy !== null}>
                          {busy === `download:${b.id}` ? "Downloading…" : "Download"}
                        </SecondaryButton>
                        <SecondaryButton
                          onClick={() => setRestoring({ id: b.id, label: `the ${KIND_LABELS[b.kind].toLowerCase()} backup of ${when(b.takenAt || b.createdAt)}` })}
                          disabled={busy !== null}
                        >
                          Restore
                        </SecondaryButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <Heading
          title="Restore from a file"
          hint="A .tar.gz this gym downloaded from here. You will see what is in it, and confirm, before anything changes."
        />
        {overview && !overview.ready ? (
          <p className="text-sm text-neutral-600">Restoring needs the server&apos;s backup storage, which is not set up yet (see above).</p>
        ) : (
          <>
            <label
              className={`inline-flex h-9 cursor-pointer items-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 ${
                uploadProgress !== null || busy !== null ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {uploadProgress !== null ? `Encrypting and uploading… ${Math.round(uploadProgress * 100)}%` : "Choose backup file"}
              <input
                type="file"
                accept=".gz,.tgz,application/gzip"
                className="hidden"
                disabled={uploadProgress !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="mt-2 text-xs text-neutral-500">
              The file is encrypted in your browser before it is uploaded, and removed from the server once restored (or after a day).
            </p>
          </>
        )}
      </Card>

      {restoring && <RestoreDialog backupId={restoring.id} label={restoring.label} onClose={() => setRestoring(null)} onRestored={restored} />}
    </div>
  );
}
