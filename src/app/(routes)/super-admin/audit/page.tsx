"use client";

import { useEffect, useState } from "react";
import { PageHeader, Table, Spinner } from "../../admin/_shared/ui";
import { platformFetch } from "../_shared/api";

interface AuditRow {
  _id: string;
  actorEmail: string;
  action: string;
  gymSlug: string;
  meta: Record<string, unknown> | null;
  ip: string;
  createdAt: string;
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platformFetch<{ data: AuditRow[] }>("/audit")
      .then((res) => setRows(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the audit log"));
  }, []);

  return (
    <>
      <PageHeader eyebrow="Platform" title="Audit log" />
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      {!rows ? (
        <Spinner />
      ) : (
        <Table
          columns={["When", "Who", "Action", "Gym", "Details"]}
          empty="Nothing recorded yet"
          rows={rows.map((row) => [
            new Date(row.createdAt).toLocaleString(),
            row.actorEmail,
            <span key="a" className="font-mono text-xs">{row.action}</span>,
            row.gymSlug || "—",
            <span key="m" className="font-mono text-[11px] text-neutral-500">{row.meta ? JSON.stringify(row.meta) : ""}</span>,
          ])}
        />
      )}
    </>
  );
}
