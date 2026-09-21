"use client";

// Newsletter unsubscribe, linked from the footer of every campaign email.
//
// The link carries the address and a token the API signed for it. Nothing
// happens on page load -- mail scanners open every link in an email, and a
// visit alone must not take anybody off the list -- so the reader confirms
// with the button. A link without its token cannot unsubscribe anyone, so it
// says where to find a working one instead of offering a form.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSiteSettings } from "@/components/ThemeProvider";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function UnsubscribeContent() {
  const params = useSearchParams();
  const { siteName } = useSiteSettings();
  const email = (params.get("email") || "").trim();
  const token = (params.get("token") || "").trim();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async () => {
    setState("busy");
    try {
      const res = await fetch(`${API_BASE}/api/newsletter/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Could not unsubscribe");
      setMessage(json?.message || "You have been unsubscribed.");
      setState("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not unsubscribe");
      setState("error");
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="text-2xl font-bold text-black">Unsubscribe</h1>
      {!email || !token ? (
        <p className="mt-4 text-gray-700">
          This unsubscribe link is incomplete. Please use the Unsubscribe link at the bottom of one of our {siteName} newsletter emails, or contact the gym and we will take you off the list.
        </p>
      ) : state === "done" ? (
        <p className="mt-4 text-gray-700">{message} You will no longer receive {siteName} newsletters.</p>
      ) : (
        <div className="mt-6">
          <p className="text-sm text-gray-600">
            Stop sending {siteName} newsletters to <span className="font-semibold text-black break-all">{email}</span>?
          </p>
          {state === "error" && <p className="mt-3 text-sm text-red-600">{message}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={state === "busy"}
            className="mt-4 h-11 w-full rounded-lg bg-black text-sm font-semibold text-white disabled:opacity-50"
          >
            {state === "busy" ? "Please wait…" : "Unsubscribe"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeContent />
    </Suspense>
  );
}
