"use client";

// Handing somebody a password at the desk. A password only ever reaching a
// person by email meant that with the gym's email down nobody new could sign
// in; these two dialogs are the other way:
//
//   SetPasswordModal -- Users / Staff → "Set password": type one, or have a
//                       strong one generated.
//   PasswordReveal   -- the generated password, shown this once (the server
//                       keeps only its hash), with a copy button.
//
// Both screens use them with their own endpoint; who may set whose password
// is decided by the API (services/adminPasswords.js), not here.

import { useEffect, useState } from "react";
import { Modal, PrimaryButton, SecondaryButton, TextField } from "../_shared/ui";
import { apiJson } from "../_shared/api";

export const MIN_PASSWORD_LENGTH = 8;

/** Where a new account's first password goes, as the create forms offer it. */
export type CredentialMode = "email" | "show" | "set";

export interface RevealedPassword {
  /** Whose password it is, as the admin knows them. */
  who: string;
  password: string;
  /** Their sign-in username, handed over with the password. */
  username?: string | null;
  /** Why it is being shown: a failed email reads differently from a request. */
  note?: string;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers refuse clipboard access; the text is selectable.
      setFailed(true);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
      title={failed ? "Your browser would not let the page copy. Select it and copy it by hand." : undefined}
    >
      {copied ? "Copied" : failed ? "Select to copy" : label}
    </button>
  );
}

/** The password, shown once. Closing it is final: it cannot be fetched again. */
export function PasswordReveal({ reveal, onClose }: { reveal: RevealedPassword | null; onClose: () => void }) {
  return (
    <Modal open={!!reveal} onClose={onClose} title="Password — shown once" size="sm">
      {reveal && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {reveal.note || `Hand this to ${reveal.who}.`} It is not stored anywhere readable and will not be shown
            again — if it is lost, set a new one.
          </p>
          {reveal.username && (
            <div>
              <p className="text-xs font-semibold text-neutral-700">Username</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 select-all rounded-lg bg-neutral-50 px-3 py-2 font-mono text-sm text-neutral-900">
                  {reveal.username}
                </code>
                <CopyButton text={reveal.username} />
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-neutral-700">Password</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 select-all break-all rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-base font-semibold tracking-wide text-neutral-900">
                {reveal.password}
              </code>
              <CopyButton text={reveal.password} />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            They can sign in with their username or email and this password, and change it from their account page.
          </p>
          <div className="flex justify-end pt-1">
            <PrimaryButton onClick={onClose}>Done — I have handed it over</PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

export interface PasswordTarget {
  /** POST endpoint, e.g. `${API_BASE}/admin/users/<id>/password`. */
  endpoint: string;
  who: string;
  username?: string | null;
}

/**
 * "Set password": generate one (the default, shown once afterwards) or type
 * one. Every session the account had ends either way.
 */
export function SetPasswordModal({
  target,
  onClose,
  onDone,
}: {
  target: PasswordTarget | null;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const [mode, setMode] = useState<"generate" | "type">("generate");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealedPassword | null>(null);

  useEffect(() => {
    setMode("generate");
    setPassword("");
    setError(null);
    setReveal(null);
  }, [target]);

  if (!target) return null;

  const submit = async () => {
    if (mode === "type" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`A password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<{ message: string; data: { generated: boolean; password?: string; username?: string | null } }>(
        target.endpoint,
        "POST",
        mode === "type" ? { password } : {}
      );
      onDone?.(res.message);
      if (res.data.password) {
        setReveal({ who: target.who, password: res.data.password, username: res.data.username ?? target.username });
      } else {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set the password.");
    } finally {
      setBusy(false);
    }
  };

  if (reveal) return <PasswordReveal reveal={reveal} onClose={onClose} />;

  return (
    <Modal open onClose={onClose} title={`Set a password for ${target.who}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          For when they cannot reset it by email. Their current password stops working and they are signed out of every
          device, the front-desk app included.
        </p>
        <div className="space-y-2 text-sm">
          <label className="flex cursor-pointer items-start gap-2">
            <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={mode === "generate"} onChange={() => setMode("generate")} />
            <span>
              <span className="font-medium text-neutral-900">Generate one</span>
              <span className="block text-xs text-neutral-500">A strong password you are shown once, to hand over.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={mode === "type"} onChange={() => setMode("type")} />
            <span>
              <span className="font-medium text-neutral-900">Type one</span>
              <span className="block text-xs text-neutral-500">At least {MIN_PASSWORD_LENGTH} characters.</span>
            </span>
          </label>
        </div>
        {mode === "type" && (
          <TextField label="New password" type="text" value={password} onChange={setPassword} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
        )}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? "Setting…" : mode === "type" ? "Set password" : "Generate password"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The create forms' "How will they get their password?" choice. `password`
 * is only used for "set".
 */
export function CredentialsChoice({
  mode,
  onMode,
  password,
  onPassword,
  hasEmail = true,
}: {
  mode: CredentialMode;
  onMode: (mode: CredentialMode) => void;
  password: string;
  onPassword: (value: string) => void;
  /** Without an email address there is nowhere to send one. */
  hasEmail?: boolean;
}) {
  const options: { value: CredentialMode; label: string; hint: string; disabled?: boolean }[] = [
    {
      value: "email",
      label: "Email it to them",
      hint: hasEmail
        ? "A password is generated and emailed. If the email cannot be sent, you are shown it instead."
        : "Needs an email address.",
      disabled: !hasEmail,
    },
    { value: "show", label: "Show me a password to hand over", hint: "Generated now and shown to you once." },
    { value: "set", label: "Type a password", hint: `At least ${MIN_PASSWORD_LENGTH} characters; tell them what it is.` },
  ];
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-700">Password</p>
      <div className="mt-2 space-y-2 text-sm">
        {options.map((option) => (
          <label key={option.value} className={`flex items-start gap-2 ${option.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
            <input
              type="radio"
              className="mt-0.5 accent-[var(--accent)]"
              checked={mode === option.value}
              disabled={option.disabled}
              onChange={() => onMode(option.value)}
            />
            <span>
              <span className="font-medium text-neutral-900">{option.label}</span>
              <span className="block text-xs text-neutral-500">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {mode === "set" && (
        <div className="mt-3">
          <TextField label="Password" type="text" value={password} onChange={onPassword} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
        </div>
      )}
    </div>
  );
}
