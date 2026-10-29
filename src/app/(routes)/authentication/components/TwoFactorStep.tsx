"use client";

// The second sign-in step: the six-digit code the server emailed. Shown in
// place of the sign-in form once a password has been accepted for an account
// that requires it.

import React, { useEffect, useId, useState } from "react";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";
import s from "../auth.module.css";

// How long "Send a new code" rests after each send, so a slow email is not
// answered with a burst of them (only the newest code works).
const RESEND_WAIT_SECONDS = 30;

export default function TwoFactorStep({
  message,
  onVerify,
  onBack,
  onResend,
  isLoading,
  notice,
}: {
  message: string;
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
  /** Emails a fresh code; resolves true when one was sent. */
  onResend: () => Promise<boolean>;
  isLoading: boolean;
  notice: { tone: "ok" | "error"; text: string } | null;
}) {
  const [code, setCode] = useState("");
  const codeId = useId();
  const { busy: resending, run } = useAsyncAction();
  // Counts down from the moment this step opens: a code has only just gone.
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const resend = () =>
    run(async () => {
      if (await onResend()) {
        // The old code no longer works; do not leave it in the box.
        setCode("");
        setWait(RESEND_WAIT_SECONDS);
      }
    });

  const errId = `${codeId}-notice`;
  // Only the step's content: AuthPage supplies the card and the column.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isLoading || resending) return;
        if (code.replace(/\D/g, "").length === 6) onVerify(code.replace(/\D/g, ""));
      }}
      className={s.form}
    >
      <div className={s.head} style={{ marginBottom: 8 }}>
        <span className={s.eyebrow}>
          <span className={s.dot} aria-hidden="true" />
          One more step
        </span>
        <h1 className={s.title}>
          Enter your <span className={s.titleAccent}>sign-in code</span>
        </h1>
        <p className={s.sub}>{message}</p>
      </div>

      <div className={s.field}>
        <label htmlFor={codeId} className={s.label}>6-digit code</label>
        <input
          id={codeId}
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${s.input} ${s.code}`}
          placeholder="••••••"
          aria-describedby={notice ? errId : undefined}
          aria-invalid={notice?.tone === "error" || undefined}
        />
      </div>

      {notice && (
        <p
          id={errId}
          role="status"
          aria-live="polite"
          className={`${s.notice} ${notice.tone === "ok" ? s.noticeOk : s.noticeError}`}
          style={{ marginBottom: 0 }}
        >
          {notice.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading || resending || code.replace(/\D/g, "").length !== 6}
        aria-busy={isLoading || undefined}
        className="btn btn--primary btn--lg btn--block"
      >
        {isLoading && <Spinner />}
        <span>{isLoading ? "Checking…" : "Sign in"}</span>
      </button>
      <button
        type="button"
        onClick={resend}
        disabled={isLoading || resending || wait > 0}
        aria-busy={resending || undefined}
        className="btn btn--glass btn--lg btn--block"
        style={{ marginTop: -6 }}
      >
        {resending && <Spinner />}
        <span>{resending ? "Sending…" : wait > 0 ? `Send a new code (in ${wait}s)` : "Send a new code"}</span>
      </button>
      <button type="button" onClick={onBack} className={s.textBtn}>
        Back to sign in
      </button>
      <p className={s.fine}>The code expires in 10 minutes. Didn&apos;t get it? Check your spam folder, then send a new one — only the newest code works.</p>
    </form>
  );
}
