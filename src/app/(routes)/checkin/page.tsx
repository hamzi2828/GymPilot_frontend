"use client";

// What a phone opens when its camera app reads the check-in code on the
// front-desk screen: /checkin?c=GPD1.…  Signed in, the code is sent straight
// away and the answer fills the screen. Not signed in, the route guard
// (src/middleware.ts) -- or, for a sign-in that has run out, this page --
// sends the member to sign in and back here with the code. By then the
// screen has usually moved on to a new code, so the server answers "that
// code has changed" and the camera opens to scan it again.
//
// Opened without a code (a bookmark, the portal's link), it offers the
// scanner.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CheckinFlow from "@/components/checkin/CheckinFlow";
import { getCurrentUser, removeToken, signInUrl } from "@/helper/helper";

const CHECKIN_PATH = "/checkin";

const returnTo = (code: string | null) => (code ? `${CHECKIN_PATH}?c=${encodeURIComponent(code)}` : CHECKIN_PATH);

function Waiting() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--accent)]" aria-label="Loading" />
    </div>
  );
}

function CheckinContent() {
  const router = useRouter();
  const params = useSearchParams();
  // The code to send, once it is known the member is signed in.
  const [start, setStart] = useState<{ code: string | null } | null>(null);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    const raw = params.get("c");
    if (!getCurrentUser()) {
      router.replace(signInUrl(returnTo(raw)));
      return;
    }
    // A code is sent once. Off the address, so reloading the answer does not
    // send it again (and, inside the minute it lasts, check the member out).
    if (raw !== null) {
      try {
        window.history.replaceState(null, "", CHECKIN_PATH);
      } catch {
        /* the address keeps the code; the server still counts it once */
      }
    }
    setStart({ code: raw });
  }, [params, router]);

  const endSession = useCallback(
    (code: string | null) => {
      removeToken();
      router.replace(signInUrl(returnTo(code)));
    },
    [router]
  );

  return (
    <main className="min-h-[80vh] bg-white px-4 pb-16 pt-24 sm:pt-28">
      <div className="mx-auto w-full max-w-md">
        {start ? <CheckinFlow variant="page" initialCode={start.code} onSessionEnded={endSession} /> : <Waiting />}
      </div>
    </main>
  );
}

export default function CheckinPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[80vh] bg-white px-4 pb-16 pt-24 sm:pt-28">
          <Waiting />
        </main>
      }
    >
      <CheckinContent />
    </Suspense>
  );
}
