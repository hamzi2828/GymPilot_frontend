"use client";

// Settings → Data & backup → Restore. First what the backup holds (the server
// reads all of it and changes nothing), then the owner types the gym's slug,
// then the server takes a backup of the gym as it is and replaces everything
// with the backup's contents. A backup of another gym is described and
// refused.

import { useEffect, useState } from "react";
import { Modal, SecondaryButton, DangerButton, Badge } from "../_shared/ui";
import { previewRestore, restoreBackup, type RestorePreview, type RestoreResult } from "./backupApi";

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function RestoreDialog({
  backupId,
  label,
  onClose,
  onRestored,
}: {
  backupId: string;
  /** What is being restored, for the title: "the daily backup of 3 May", "gym-backup.tar.gz". */
  label: string;
  onClose: () => void;
  onRestored: (result: RestoreResult) => void;
}) {
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    previewRestore(backupId)
      .then((p) => !cancelled && setPreview(p))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "The backup could not be read."));
    return () => {
      cancelled = true;
    };
  }, [backupId]);

  const confirmed = !!preview && typed.trim().toLowerCase() === preview.confirmWith;

  const run = async () => {
    if (!preview || !confirmed) return;
    setRestoring(true);
    setError(null);
    try {
      onRestored(await restoreBackup(backupId, typed.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The restore failed.");
      setRestoring(false);
    }
  };

  return (
    <Modal open onClose={restoring ? () => {} : onClose} title={`Restore ${label}`} size="lg">
      {!preview && !error && <p className="text-sm text-neutral-600">Reading the whole backup to check it… this changes nothing.</p>}

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}

      {preview && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Gym</p>
              <p className="mt-0.5 text-neutral-900">{preview.gym ? `${preview.gym.name} (${preview.gym.slug})` : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Taken</p>
              <p className="mt-0.5 text-neutral-900">{when(preview.createdAt)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Records</p>
              <p className="mt-0.5 text-neutral-900">
                {preview.documents.toLocaleString()} in {preview.collections.length} collections
              </p>
            </div>
          </div>

          {preview.refusal ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{preview.refusal}</div>
          ) : (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Everything in the gym will be replaced by this backup.</p>
                <p className="mt-1 text-xs">
                  Members, memberships, bookings, payments, staff and settings go back to how they were on {when(preview.createdAt)}; anything
                  added since is removed. A backup of the gym as it is right now is taken first and listed as &ldquo;Before a restore&rdquo;. The
                  audit log is kept as it is.
                </p>
                {!preview.actorInBackup && (
                  <p className="mt-2 text-xs font-semibold">
                    Your own account is not in this backup: once it is restored you will be signed out and will need an account from the backup to sign
                    in.
                  </p>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-left font-semibold uppercase tracking-wide text-neutral-500">
                      <th className="px-3 py-2">Collection</th>
                      <th className="px-3 py-2 text-right">Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.collections.map((c) => (
                      <tr key={c.name} className="border-b border-neutral-100 last:border-b-0">
                        <td className="px-3 py-1.5 font-mono text-neutral-800">
                          {c.name} {c.kept && <Badge>kept as it is</Badge>}
                        </td>
                        <td className="px-3 py-1.5 text-right text-neutral-700">{c.documents.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-neutral-700">
                  Type <span className="font-mono">{preview.confirmWith}</span> to confirm
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={restoring}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            </>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <SecondaryButton onClick={onClose} disabled={restoring}>
          {preview?.refusal || error ? "Close" : "Cancel"}
        </SecondaryButton>
        {preview && !preview.refusal && (
          <DangerButton onClick={run} disabled={!confirmed || restoring}>
            {restoring ? "Restoring… keep this page open" : "Restore this backup"}
          </DangerButton>
        )}
      </div>
    </Modal>
  );
}
