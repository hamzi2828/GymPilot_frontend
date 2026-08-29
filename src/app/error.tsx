"use client";

// Catches render and data errors anywhere under the app shell. Without this a
// single failed request leaves the visitor on a blank white page.

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the detail in the console for debugging; visitors see the message
    // below, never a stack trace.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6 py-24">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-neutral-900">Something went wrong</h1>
        <p className="mt-3 text-neutral-600">
          We couldn&apos;t load this page. Try again — if it keeps happening, get in
          touch and we&apos;ll sort it out.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent, #ff6b2c)", color: "var(--on-accent, #0e0e10)" }}
          >
            Try again
          </button>
          <Link
            href="/contact-us"
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          >
            Contact us
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-neutral-400">Reference: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
