"use client";

// Choosing somebody's username. Everyone gets one generated (their name plus
// three digits); a gym may prefer something it can read out more easily. It
// signs in on the website, the front-desk app and the phone app, so changing
// it stops the old one working everywhere -- the person has to be told.
//
// The rules are checked here only to save a round trip; the API
// (services/username.js) is what decides.

import { useEffect, useState } from "react";
import { Modal, PrimaryButton, SecondaryButton, TextField } from "../_shared/ui";
import { apiJson } from "../_shared/api";

export interface UsernameTarget {
  /** PUT endpoint, e.g. `${API_BASE}/admin/users/<id>/username`. */
  endpoint: string;
  who: string;
  current?: string | null;
}

function problem(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (!text) return "Type a username.";
  if (!/^[a-z0-9]+$/.test(text)) return "Letters and digits only: no spaces, dots or symbols.";
  if (text.length < 3) return "At least 3 characters.";
  if (text.length > 30) return "At most 30 characters.";
  if (!/[a-z]/.test(text)) return "Needs at least one letter.";
  return null;
}

export default function UsernameModal({
  target,
  onClose,
  onDone,
}: {
  target: UsernameTarget | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(target?.current || "");
    setError(null);
  }, [target]);

  if (!target) return null;

  const save = async () => {
    const wrong = problem(value);
    if (wrong) {
      setError(wrong);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<{ message: string }>(target.endpoint, "PUT", { username: value.trim().toLowerCase() });
      onDone(res.message || "Username changed.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the username.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Username for ${target.who}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          They sign in with it instead of an email, on the website, the front desk and the phone app. The old one stops
          working straight away, so tell them the new one.
        </p>
        <TextField label="Username" value={value} onChange={setValue} placeholder="e.g. alikhan" />
        <p className="-mt-2 text-xs text-neutral-500">Letters and digits, 3–30 characters, at least one letter. Not case sensitive.</p>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save username"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
