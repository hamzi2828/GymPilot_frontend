"use client";

// A payment link for one unpaid order: the address the member opens to pay
// it online (no sign-in; it opens that order only), to copy into a message,
// or sent to them now by the gym's reminder channels.
//
// POST /package-orders/:id/pay-link { send? } -> { url, expires_at, sent? }

import { useEffect, useState } from "react";
import { ButtonSpinner, PrimaryButton, SecondaryButton, useAsyncAction } from "../_shared/ui";
import { GYMFOLIO_API, apiJson } from "../_shared/api";
import { CopyButton } from "../users/PasswordDialogs";

type Channels = { email?: boolean; sms?: boolean; whatsapp?: boolean; push?: boolean };

export interface PayLinkResult {
  url: string;
  expires_at?: string | null;
  /** Which channels it went out on, when it was sent. */
  sent?: Channels;
}

const CHANNEL_NAMES: [keyof Channels, string][] = [
  ["email", "email"],
  ["sms", "SMS"],
  ["whatsapp", "WhatsApp"],
  ["push", "push notification"],
];

/** The order a link can be made for: not paid, not closed, not a transfer being checked. */
export function payLinkAllowed(order: { status: string; payment: { status: string } }) {
  return order.status !== "cancelled" && ["pending", "failed"].includes(order.payment.status);
}

async function requestPayLink(orderId: string, send: boolean): Promise<PayLinkResult> {
  const r = await apiJson<PayLinkResult & { data?: PayLinkResult }>(`${GYMFOLIO_API}/package-orders/${orderId}/pay-link`, "POST", send ? { send: true } : {});
  const result = r.data && r.data.url ? r.data : r;
  if (!result.url) throw new Error("The server did not send a link. Please try again.");
  return result;
}

function sentLine(sent: Channels) {
  const went = CHANNEL_NAMES.filter(([key]) => sent[key]).map(([, name]) => name);
  if (!went.length) return null;
  const list = went.length === 1 ? went[0] : `${went.slice(0, -1).join(", ")} and ${went[went.length - 1]}`;
  return `Sent by ${list}.`;
}

function whenLabel(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * The link for one order, fetched as soon as it is shown, with Copy and
 * Send now. `canSend`: this account may send it (package orders, manage).
 */
export function PayLinkPanel({ orderId, canSend = true }: { orderId: string; canSend?: boolean }) {
  const [link, setLink] = useState<PayLinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<{ ok: boolean; text: string } | null>(null);
  const action = useAsyncAction();

  const get = () =>
    action.run("get", async () => {
      setError(null);
      try {
        setLink(await requestPayLink(orderId, false));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not make the payment link.");
      }
    });

  const send = () =>
    action.run("send", async () => {
      setError(null);
      setSentNote(null);
      try {
        const r = await requestPayLink(orderId, true);
        setLink(r);
        const line = r.sent ? sentLine(r.sent) : null;
        setSentNote(
          line
            ? { ok: true, text: line }
            : { ok: false, text: "Not sent: no channel could reach this member (no email or phone on file, or those channels are off). Copy the link and send it yourself." }
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send the payment link.");
      }
    });

  // Shown because someone asked for the link: fetch it straight away.
  useEffect(() => {
    get();
    // Once per order shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const expires = whenLabel(link?.expires_at);

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div>
        <p className="text-sm font-semibold text-neutral-900">Payment link</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          The member opens it to pay this order online, without signing in. It opens this order only{expires ? ` and works until ${expires}` : ""}.
        </p>
      </div>

      {link ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <p className="min-w-0 flex-1 break-all font-mono text-xs text-neutral-800">{link.url}</p>
          <CopyButton text={link.url} label="Copy link" />
        </div>
      ) : (
        action.isBusy("get") && (
          <p role="status" className="flex items-center gap-2 text-xs text-neutral-500">
            <ButtonSpinner className="h-3.5 w-3.5" />
            Making the link…
          </p>
        )
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {sentNote && (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${sentNote.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {sentNote.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!link && !action.isBusy("get") && (
          <SecondaryButton onClick={get} disabled={action.busy}>
            Try again
          </SecondaryButton>
        )}
        {canSend && (
          <PrimaryButton onClick={send} loading={action.isBusy("send")} disabled={action.busy}>
            Send now
          </PrimaryButton>
        )}
      </div>
      {canSend && <p className="text-xs text-neutral-500">Send now uses the channels set under Settings → Payments → Payment reminders.</p>}
    </div>
  );
}
