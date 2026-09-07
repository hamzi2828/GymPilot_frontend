"use client";

// The second sign-in step: the six-digit code the server emailed. Shown in
// place of the sign-in form once a password has been accepted for an account
// that requires it.

import React, { useState } from "react";

export default function TwoFactorStep({
  message,
  onVerify,
  onBack,
  isLoading,
  notice,
}: {
  message: string;
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  notice: { tone: "ok" | "error"; text: string } | null;
}) {
  const [code, setCode] = useState("");

  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.replace(/\D/g, "").length === 6) onVerify(code.replace(/\D/g, ""));
        }}
        className="w-full max-w-md"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">One more step</p>
        <h1 className="mt-2 text-3xl font-bold text-black">Enter your sign-in code</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>

        <label className="mt-8 block">
          <span className="text-sm font-medium text-gray-700">6-digit code</span>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl font-semibold tracking-[0.4em] focus:border-black focus:outline-none"
            placeholder="••••••"
          />
        </label>

        {notice && (
          <p className={`mt-4 rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || code.replace(/\D/g, "").length !== 6}
          className="mt-6 w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Checking…" : "Sign in"}
        </button>
        <button type="button" onClick={onBack} className="mt-3 w-full text-sm text-gray-600 underline underline-offset-2">
          Back to sign in
        </button>
        <p className="mt-6 text-xs text-gray-500">The code expires in 10 minutes. Didn&apos;t get it? Check your spam folder, then sign in again to get a new one.</p>
      </form>
    </div>
  );
}
