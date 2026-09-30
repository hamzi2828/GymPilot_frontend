"use client";

// Settings → Data & backup: the whole gym as one file, on demand. Only the
// gym's administrators can use it (the API checks the same thing again): a
// backup is every member's personal data at once.

import { useState } from "react";
import { Card, PrimaryButton } from "../_shared/ui";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { downloadFullBackup, formatBytes } from "./backupApi";

type Notice = { tone: "ok" | "warn" | "error"; text: string };

const NOTICE_STYLES: Record<Notice["tone"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export default function BackupSettings() {
  const { me, can, loading } = usePermissions();
  const isOwner = !!me && me.role === "admin" && can("settings", "manage");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  if (loading) return null;

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
    </div>
  );
}
