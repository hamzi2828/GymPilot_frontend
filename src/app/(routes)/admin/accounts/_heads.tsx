"use client";

// "Manage heads": the expense or asset heads a gym files rows under. The
// built-in ones are listed read-only; the gym's own can be added, renamed,
// archived and restored. A head is never deleted -- archiving stops it being
// offered for new rows, and the rows already filed under it keep their name.

import { useCallback, useEffect, useState } from "react";
import { Modal, PrimaryButton, SecondaryButton, TextField, Badge, Spinner } from "../_shared/ui";
import { ACCOUNTS_API, apiGet, apiJson } from "../_shared/api";

export type HeadKind = "expense" | "asset";

interface Head {
  id: string | null;
  key: string;
  label: string;
  built_in: boolean;
  archived: boolean;
}

const NOUN: Record<HeadKind, string> = { expense: "Expense heads", asset: "Asset heads" };

export function ManageHeadsModal({
  open,
  kind,
  onClose,
  onChanged,
}: {
  open: boolean;
  kind: HeadKind;
  onClose: () => void;
  /** Called after any change, so the lists and dropdowns behind reload. */
  onChanged: () => void;
}) {
  const [heads, setHeads] = useState<Head[] | null>(null);
  const [newLabel, setNewLabel] = useState("");
  // The head being renamed, and the name being typed for it.
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<Record<HeadKind, Head[]>>(`${ACCOUNTS_API}/categories`);
      setHeads(res[kind] || []);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not load the heads" });
    }
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    setHeads(null);
    setNewLabel("");
    setRenaming(null);
    setMessage(null);
    load();
  }, [open, load]);

  const run = async (request: () => Promise<{ message: string }>) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await request();
      setMessage({ tone: "ok", text: res.message });
      await load();
      onChanged();
      return true;
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!newLabel.trim()) return;
    const ok = await run(() => apiJson<{ message: string }>(`${ACCOUNTS_API}/categories`, "POST", { kind, label: newLabel }));
    if (ok) setNewLabel("");
  };

  const rename = async () => {
    if (!renaming || !renaming.label.trim()) return;
    const ok = await run(() => apiJson<{ message: string }>(`${ACCOUNTS_API}/categories/${renaming.id}`, "PUT", { label: renaming.label }));
    if (ok) setRenaming(null);
  };

  const setArchived = (head: Head, archived: boolean) =>
    run(() => apiJson<{ message: string }>(`${ACCOUNTS_API}/categories/${head.id}`, "PUT", { archived }));

  const own = (heads || []).filter((head) => !head.built_in);
  const builtIn = (heads || []).filter((head) => head.built_in);

  return (
    <Modal open={open} onClose={onClose} title={NOUN[kind]} size="md">
      <div className="space-y-5">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField
              label={kind === "expense" ? "New expense head" : "New asset head"}
              value={newLabel}
              onChange={setNewLabel}
              placeholder={kind === "expense" ? "Tea, Electricity bill…" : "Boxing kit, CCTV…"}
            />
          </div>
          <PrimaryButton onClick={add} disabled={busy || !newLabel.trim()}>
            Add
          </PrimaryButton>
        </div>

        {message && (
          <p className={`rounded-lg px-3 py-2 text-sm ${message.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {message.text}
          </p>
        )}

        {!heads ? (
          <Spinner />
        ) : (
          <>
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Your heads</h3>
              {!own.length ? (
                <p className="text-[13px] text-neutral-500">None yet. Add the costs your gym tracks that the built-in list does not cover.</p>
              ) : (
                <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                  {own.map((head) => (
                    <li key={head.key} className="flex items-center gap-2 px-3 py-2">
                      {renaming && renaming.id === head.id ? (
                        <>
                          <input
                            autoFocus
                            value={renaming.label}
                            onChange={(e) => setRenaming({ id: renaming.id, label: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") rename();
                              if (e.key === "Escape") {
                                // Used here: the dialog around it stays open.
                                e.preventDefault();
                                setRenaming(null);
                              }
                            }}
                            aria-label={`New name for ${head.label}`}
                            className="h-8 flex-1 rounded-lg border border-neutral-200 px-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                          />
                          <SecondaryButton onClick={rename} disabled={busy || !renaming.label.trim()}>Save</SecondaryButton>
                          <SecondaryButton onClick={() => setRenaming(null)} disabled={busy}>Cancel</SecondaryButton>
                        </>
                      ) : (
                        <>
                          <span className={`flex-1 text-sm ${head.archived ? "text-neutral-400" : "text-neutral-800"}`}>{head.label}</span>
                          {head.archived && <Badge>archived</Badge>}
                          {!head.archived && (
                            <SecondaryButton onClick={() => setRenaming({ id: head.id || "", label: head.label })} disabled={busy}>
                              Rename
                            </SecondaryButton>
                          )}
                          <SecondaryButton onClick={() => setArchived(head, !head.archived)} disabled={busy}>
                            {head.archived ? "Restore" : "Archive"}
                          </SecondaryButton>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[12px] text-neutral-400">
                Archiving stops a head being offered for new entries. Entries already filed under it keep it.
              </p>
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Built in</h3>
              <div className="flex flex-wrap gap-1.5">
                {builtIn.map((head) => (
                  <Badge key={head.key}>{head.label}</Badge>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
