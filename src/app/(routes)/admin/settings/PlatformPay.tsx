"use client";

// The pieces of paying GymsPilotPro that are not Stripe's: the amount due,
// GymsPilotPro's own bank accounts (a large QR code, and Copy beside the
// numbers), and the receipt the gym uploads after a bank transfer for the
// super admin to approve. Used by Settings → Billing and by the renew page a
// lapsed gym shows (components/TenantUnavailable).

import { useRef, useState } from "react";
import { CircleAlert, Clock, FileText, Mail, Upload } from "lucide-react";
import { PrimaryButton, TextField, useAsyncAction } from "../_shared/ui";
import { absoluteUrl } from "../_shared/api";
import { CopyButton } from "../users/PasswordDialogs";
import {
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
  formatDate,
  formatMoney,
  uploadReceipt,
  type PendingPayRequest,
  type PlatformBankAccount,
} from "./billingApi";

const RECEIPT_ACCEPT = [...RECEIPT_TYPES, ".jpg", ".jpeg", ".png", ".webp", ".pdf"].join(",");
const RECEIPT_EXTENSION = /\.(jpe?g|png|webp|pdf)$/i;

/** True when a YYYY-MM-DD (or ISO) day is already behind us. */
export function isPastDay(day: string | null | undefined): boolean {
  if (!day) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return false;
  const due = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** "Due 19 Nov 2026", or "Was due …" in red once that day has gone. */
export function DueLine({ day }: { day?: string | null }) {
  const due = formatDate(day);
  if (!due) return null;
  const late = isPastDay(day);
  return <p className={`text-sm ${late ? "font-medium text-rose-700" : "text-neutral-500"}`}>{late ? `Was due ${due}` : `Due ${due}`}</p>;
}

/** "PKR 5,000" in large type, with its due date under it. */
export function AmountDue({ amount, dueDate, label = "Amount due" }: { amount: string; dueDate?: string | null; label?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-900">{amount}</p>
      <DueLine day={dueDate} />
    </div>
  );
}

/** "To pay, contact GymsPilotPro: billing@…", for when there is no way to pay from here. */
export function ContactToPay({ email, what = "To pay" }: { email?: string; what?: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-neutral-700">
      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
      <span className="min-w-0">
        {what}, contact GymsPilotPro
        {email ? (
          <>
            :{" "}
            <a href={`mailto:${email}`} className="break-words font-semibold text-neutral-900 underline underline-offset-2">
              {email}
            </a>
          </>
        ) : (
          " support."
        )}
      </span>
    </p>
  );
}

/** One line of an account: what it is, the value, and Copy for the numbers. */
function Detail({ label, value, copy }: { label: string; value?: string; copy?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 flex items-center justify-between gap-3">
        <span className={`min-w-0 break-all text-sm font-semibold text-neutral-900 ${copy ? "font-mono" : ""}`}>{value}</span>
        {copy && <CopyButton text={value} />}
      </dd>
    </div>
  );
}

/** GymsPilotPro's bank accounts, each with its QR code large enough to scan from the screen. */
export function PlatformBankAccounts({ accounts, contactEmail }: { accounts: PlatformBankAccount[]; contactEmail?: string }) {
  if (!accounts.length) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-4">
        <ContactToPay email={contactEmail} what="Bank details aren't listed yet. To pay" />
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {accounts.map((account, index) => {
        const qr = account.qr_code_url ? absoluteUrl(account.qr_code_url) : "";
        return (
          <li
            key={`${account.account_number || account.iban}-${index}`}
            className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-start sm:gap-5"
          >
            {qr && (
              <a href={qr} target="_blank" rel="noopener noreferrer" className="mx-auto shrink-0 sm:mx-0" title="Open the QR code">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr}
                  alt={`QR code to pay ${account.bank_name || "GymsPilotPro"}`}
                  className="h-48 w-48 rounded-lg border border-neutral-200 bg-white object-contain p-2 sm:h-52 sm:w-52"
                />
              </a>
            )}
            <dl className="min-w-0 flex-1 space-y-3">
              <Detail label="Bank" value={account.bank_name} />
              <Detail label="Account title" value={account.account_title} />
              <Detail label="Account number" value={account.account_number} copy />
              <Detail label="IBAN" value={account.iban} copy />
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The receipt, after a bank transfer: the form to upload it, or what became
 * of the last one -- sent and waiting for GymsPilotPro, or turned down with
 * the reason (and the form again). A new upload replaces a waiting one.
 * `onSent` gets the request the API answered with.
 */
export function ReceiptUpload({
  request,
  currency,
  onSent,
}: {
  request: PendingPayRequest | null | undefined;
  currency?: string;
  onSent: (next: PendingPayRequest | null) => unknown;
}) {
  const status = request?.status || null;
  const [replacing, setReplacing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sending = useAsyncAction();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const pick = (picked: File | null) => {
    setError(null);
    if (!picked) return setFile(null);
    const typeOk = picked.type ? RECEIPT_TYPES.includes(picked.type) : RECEIPT_EXTENSION.test(picked.name);
    if (!typeOk) {
      setFile(null);
      clearInput();
      return setError("Choose a photo (JPG, PNG, WebP) or a PDF.");
    }
    if (picked.size > RECEIPT_MAX_BYTES) {
      setFile(null);
      clearInput();
      return setError("That file is over 4 MB. Choose a smaller one.");
    }
    setFile(picked);
  };

  const send = () =>
    sending.run(async () => {
      if (!file) return;
      setError(null);
      try {
        const res = await uploadReceipt(file, { reference });
        if (res.ok) {
          setFile(null);
          setReference("");
          setReplacing(false);
          clearInput();
          await onSent(res.data?.pending_request ?? { status: "pending", submitted_at: new Date().toISOString() });
          return;
        }
        setError(
          res.status === 413
            ? "That file is too large — 4 MB at most."
            : res.status === 429
            ? res.message || "Too many uploads. Please try again in a few minutes."
            : res.message || "Could not send the receipt. Please try again."
        );
      } catch {
        setError("Could not reach the server. Please try again.");
      }
    });

  if (status === "pending" && !replacing) {
    const sentOn = formatDate(request?.submitted_at);
    const amount = request?.amount && currency ? formatMoney(request.amount, currency) : "";
    return (
      <div>
        <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">Receipt sent — GymsPilotPro will confirm it.</p>
            {(sentOn || amount) && <p className="mt-0.5 text-xs text-emerald-800">{[sentOn && `Sent ${sentOn}`, amount].filter(Boolean).join(" · ")}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReplacing(true)}
          className="mt-3 text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
        >
          Send a different receipt
        </button>
      </div>
    );
  }

  const busy = sending.busy;
  return (
    <div className="space-y-4">
      {status === "rejected" && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-900">Receipt not accepted</p>
            {request?.reason?.trim() && <p className="mt-0.5 break-words text-sm text-rose-800">{request.reason.trim()}</p>}
            <p className="mt-1 text-xs text-rose-800">Upload the right one below.</p>
          </div>
        </div>
      )}

      <div>
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-4 transition-colors focus-within:ring-2 focus-within:ring-neutral-300 ${
            file ? "border-neutral-400 bg-neutral-50" : error ? "border-rose-300" : "border-neutral-300 hover:border-neutral-400"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600" aria-hidden="true">
            {file ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-neutral-900">{file ? file.name : "Choose the receipt"}</span>
            <span className="block text-xs text-neutral-500">{file ? `${fileSize(file.size)} · tap to change` : "Photo or PDF, up to 4 MB"}</span>
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={RECEIPT_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0] || null)}
          />
        </label>
        {error && (
          <p role="alert" className="mt-1.5 text-xs text-rose-700">
            {error}
          </p>
        )}
      </div>

      <div className="sm:max-w-xs">
        <TextField label="Transaction ID (optional)" value={reference} onChange={setReference} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={send} loading={busy} disabled={!file}>
          {status === "rejected" ? "Upload again" : "Upload receipt"}
        </PrimaryButton>
        {replacing && (
          <button
            type="button"
            onClick={() => {
              setReplacing(false);
              setFile(null);
              setError(null);
            }}
            disabled={busy}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
