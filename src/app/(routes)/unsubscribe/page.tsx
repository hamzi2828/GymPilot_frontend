"use client";

// Newsletter unsubscribe, linked from the footer of every campaign email.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSiteSettings } from "@/components/ThemeProvider";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function UnsubscribeContent() {
  const params = useSearchParams();
  const { siteName } = useSiteSettings();
  const [email, setEmail] = useState(params.get("email") || "");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (value: string) => {
    if (!value) return;
    setState("busy");
    try {
      const res = await fetch(`${API_BASE}/api/newsletter/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: value }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Could not unsubscribe");
      setMessage(json?.message || "You have been unsubscribed.");
      setState("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not unsubscribe");
      setState("error");
    }
  };

  useEffect(() => {
    const initial = params.get("email");
    if (initial) submit(initial);
    // Only on first load: the link carries the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="text-2xl font-bold text-black">Unsubscribe</h1>
      {state === "done" ? (
        <p className="mt-4 text-gray-700">{message} You will no longer receive {siteName} newsletters.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(email);
          }}
          className="mt-6"
        >
          <p className="text-sm text-gray-600">Enter the address you would like to remove from {siteName} newsletters.</p>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-4 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" placeholder="you@example.com" />
          {state === "error" && <p className="mt-3 text-sm text-red-600">{message}</p>}
          <button type="submit" disabled={state === "busy"} className="mt-4 h-11 w-full rounded-lg bg-black text-sm font-semibold text-white disabled:opacity-50">
            {state === "busy" ? "Please wait…" : "Unsubscribe"}
          </button>
        </form>
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
