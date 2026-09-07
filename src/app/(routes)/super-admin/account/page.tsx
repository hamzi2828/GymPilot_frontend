"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, PrimaryButton, SecondaryButton, TextField } from "../../admin/_shared/ui";
import { platformFetch, type PlatformAdmin } from "../_shared/api";

export default function SuperAdminAccountPage() {
  const [admin, setAdmin] = useState<(PlatformAdmin & { two_factor?: boolean }) | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = () => platformFetch<{ admin: PlatformAdmin & { two_factor?: boolean } }>("/auth/me").then((r) => setAdmin(r.admin));
  useEffect(() => {
    load().catch(() => setAdmin(null));
  }, []);

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setNotice(null);
    try {
      setNotice({ tone: "ok", text: await fn() });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Platform" title="My account" />
      {notice && <p className={`mb-4 rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Two-factor sign-in</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {admin?.two_factor ? "On — a 6-digit code is emailed to you at every sign-in." : "Off — add an emailed 6-digit code to every sign-in. Requires working platform email (SMTP)."}
          </p>
          <div className="mt-4">
            <SecondaryButton disabled={busy === "2fa" || !admin} onClick={() => run("2fa", async () => { const r = await platformFetch<{ admin: { two_factor: boolean } }>("/auth/two-factor", { method: "PUT", body: { enabled: !admin?.two_factor } }); return r.admin.two_factor ? "Two-factor sign-in is on." : "Two-factor sign-in is off."; })}>
              {admin?.two_factor ? "Turn off" : "Turn on"}
            </SecondaryButton>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Change password</h2>
          <div className="mt-4 space-y-3">
            <TextField label="Current password" type="password" value={current} onChange={setCurrent} />
            <TextField label="New password (min 10 characters)" type="password" value={next} onChange={setNext} />
          </div>
          <div className="mt-4">
            <PrimaryButton disabled={busy === "pw" || next.length < 10 || !current} onClick={() => run("pw", async () => { await platformFetch("/auth/password", { method: "PUT", body: { currentPassword: current, newPassword: next } }); setCurrent(""); setNext(""); return "Password updated."; })}>
              Update password
            </PrimaryButton>
          </div>
        </Card>
      </div>
    </>
  );
}
