"use client";

// Shown while the member's email address is still unconfirmed (a new sign-up,
// or an address they have just changed). The account works as it is; until
// the link in the email is opened it simply does not pick up anything bought
// with that address before they had an account. One button sends the link
// again, and the API's answer is shown as it comes.

import React, { useState } from "react";
import { sendEmailConfirmation, SessionEndedError } from "../service/userDetailService";

export const EmailConfirmNotice: React.FC<{
  /** The address turned out to be confirmed already; the API's sentence saying so. */
  onConfirmed: (message: string) => void;
  onSessionEnded: () => void;
}> = ({ onConfirmed, onSessionEnded }) => {
  const [sending, setSending] = useState(false);
  const [answer, setAnswer] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const send = async () => {
    setSending(true);
    setAnswer(null);
    try {
      const r = await sendEmailConfirmation();
      // Nothing left to confirm: the page says so and takes this notice away.
      if (r.alreadyVerified) return onConfirmed(r.message || "Your email address is already confirmed.");
      setAnswer({ tone: "ok", text: r.message || "We sent you a new link. Open it to confirm the address is yours." });
    } catch (e) {
      if (e instanceof SessionEndedError) return onSessionEnded();
      setAnswer({ tone: "error", text: e instanceof Error ? e.message : "We could not send the email just now. Please try again later." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-8 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-black">Your email is not confirmed yet</p>
          <p className="text-sm text-gray-700">
            We emailed you a link. Open it to confirm the address is yours. You can keep using your account in the meantime.
          </p>
        </div>
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send the link again"}
        </button>
      </div>
      {answer && (
        <p role="status" className={`mt-3 text-sm ${answer.tone === "ok" ? "text-green-800" : "text-red-700"}`}>
          {answer.text}
        </p>
      )}
    </div>
  );
};

export default EmailConfirmNotice;
