// app/not-found.tsx
//
// Must live at the app root — a not-found.tsx inside a route group is only used
// for notFound() calls within that group, never for unmatched URLs.

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6 py-24">
      <div className="text-center max-w-md">
        <p
          className="text-sm font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--accent, #ff6b2c)" }}
        >
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-neutral-900">Page not found</h1>
        <p className="mt-3 text-neutral-600">
          That page doesn&apos;t exist or has moved. Try one of these instead.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent, #ff6b2c)", color: "var(--on-accent, #0e0e10)" }}
          >
            Go home
          </Link>
          <Link
            href="/classes"
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          >
            Browse classes
          </Link>
          <Link
            href="/packages"
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          >
            See packages
          </Link>
        </div>
      </div>
    </main>
  );
}
