"use client";

// The front-desk Windows app: where to download it, and a one-time code that
// links a desk to this gym and signs it in -- instead of typing a server
// address, the gym's domain and a password into the desk.
//
// The code is made by the backend's platform/controllers/deskLinkController.js
// for the signed-in account: the desk is signed in as whoever pressed the
// button. It works once, for 15 minutes. Below it, the desks signed in right
// now, each of which can be signed out ("Unlink") from here.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiCopy, FiDownload, FiMonitor } from "react-icons/fi";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import {
  PageHeader,
  Card,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  useConfirm,
  useAsyncAction,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";

const DESK_LINK_API = `${API_BASE}/api/desk-link`;

// Where the installer is downloaded from. Unset: the copy on the GymsPilotPro
// site. Set to an empty value on purpose: there is no installer to offer yet,
// and the page says so instead of linking to a missing file.
const DEFAULT_DOWNLOAD_URL = "https://gymspilotpro.com/downloads/GymsPilotPro-Desk-Setup.exe";
const configuredUrl = process.env.NEXT_PUBLIC_DESK_APP_URL;
const DOWNLOAD_URL = configuredUrl === undefined ? DEFAULT_DOWNLOAD_URL : configuredUrl.trim();

// While a code is on screen the desk list is re-read this often, so the
// page can say "linked" the moment the desk signs in.
const WATCH_MS = 8000;

interface Desk {
  id: string;
  device: string;
  kind: "desk" | "kiosk";
  account: string;
  mine: boolean;
  signed_in_at: string | null;
  last_seen_at: string | null;
  expires_at: string | null;
}

interface Overview {
  can_link: boolean;
  grants_access_on_link: boolean;
  not_allowed_reason: string | null;
  code_minutes: number;
  scope: "all" | "own";
  desks: Desk[];
}

interface LinkCode {
  code: string;
  expires_at: string;
  minutes: number;
  granted_app_access: boolean;
}

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function DeskAppPage() {
  const { me } = usePermissions();
  const { ask, dialog } = useConfirm();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState<LinkCode | null>(null);
  const makeAction = useAsyncAction();
  const making = makeAction.busy;
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // The desk that signed in with the code on screen, once it has.
  const [linkedDevice, setLinkedDevice] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const unlinking = useAsyncAction();

  // Desks already signed in when the code was made, so a new one stands out.
  const knownDesks = useRef<Set<string>>(new Set());

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await apiGet<{ data?: Overview }>(DESK_LINK_API);
      setOverview(res.data || null);
      setError(null);
      return res.data || null;
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "Could not load the desk app page");
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const expiresAt = code ? new Date(code.expires_at).getTime() : 0;
  const expired = !!code && now >= expiresAt;
  const watching = !!code && !expired && !linkedDevice;

  // The countdown.
  useEffect(() => {
    if (!code || linkedDevice) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [code, linkedDevice]);

  // Watch for the desk signing in with this account.
  useEffect(() => {
    if (!watching) return;
    const t = setInterval(async () => {
      const fresh = await load(true);
      const arrived = fresh?.desks.find((d) => d.mine && d.kind === "desk" && !knownDesks.current.has(d.id));
      if (arrived) setLinkedDevice(arrived.device || "The desk");
    }, WATCH_MS);
    return () => clearInterval(t);
  }, [watching, load]);

  const getCode = () => makeAction.run(async () => {
    setCodeError(null);
    setCopied(false);
    setLinkedDevice(null);
    try {
      const res = await apiJson<{ data: LinkCode }>(`${DESK_LINK_API}/codes`, "POST");
      knownDesks.current = new Set((overview?.desks || []).map((d) => d.id));
      setCode(res.data);
      setNow(Date.now());
      // The grant may just have been switched on; the page's own flags follow.
      if (res.data.granted_app_access) load(true);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Could not make a link code");
    }
  });

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an old browser, or not allowed): the code is on screen
      // in large type to read off instead.
    }
  }

  async function unlink(desk: Desk) {
    const name = desk.device || "this desk";
    const answer = await ask({
      title: `Unlink ${name}?`,
      body: "It is signed out straight away and will need a new link code (or a password) to sign in again. Attendance already recorded stays.",
      confirmLabel: "Unlink desk",
    });
    if (answer === null) return;

    await unlinking.run(desk.id, async () => {
      try {
        await apiJson(`${DESK_LINK_API}/desks/${desk.id}/unlink`, "POST");
        setNotice(`${name} has been unlinked.`);
        await load(true);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Could not unlink that desk");
      }
    });
  }

  const desks = overview?.desks || [];

  return (
    <div>
      <PageHeader eyebrow="Front desk" title="Desk app" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Download */}
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
              <FiMonitor className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">GymsPilotPro Desk for Windows</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Checks members and staff in at the front desk by fingerprint or face, and shows the check-in code members scan
                with their phone.
              </p>
            </div>
          </div>

          <div className="mt-5">
            {DOWNLOAD_URL ? (
              <a
                href={DOWNLOAD_URL}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              >
                <FiDownload className="h-4 w-4" aria-hidden="true" />
                Download for Windows
              </a>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Download coming soon — contact GymsPilotPro support for the installer.
              </p>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">You will need</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              <li>A PC with Windows 10 or Windows 11, connected to the internet.</li>
              <li>
                A DigitalPersona U.are.U fingerprint reader, with its driver installed, for fingerprint check-in.
              </li>
              <li>A USB webcam facing the desk, for face check-in.</li>
              <li>
                Neither? The app still shows the check-in code members scan with their phone, and staff can check anyone
                in by name.
              </li>
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Set up a desk</h3>
            <ol className="mt-2 space-y-2 text-sm text-neutral-700">
              {[
                "Download the app on the front-desk PC and run the installer.",
                "Press “Get link code” on this page.",
                "Open the desk app, choose “Link with code” and type the code. The desk is now linked to your gym and signed in.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </Card>

        {/* 2. Link code */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-neutral-900">Link a desk</h2>
          <p className="mt-1 text-sm text-neutral-500">
            The desk will be signed in as you{me?.name ? ` (${me.name})` : ""}. To sign a desk in as someone else, they
            get the code from their own account.
          </p>

          {loading ? (
            <div className="mt-6">
              <Spinner />
            </div>
          ) : error ? (
            <div className="mt-6">
              <ErrorState message={error} onRetry={() => load()} />
            </div>
          ) : overview && !overview.can_link ? (
            <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {overview.not_allowed_reason}
            </p>
          ) : (
            <div className="mt-6">
              {code && !expired && !linkedDevice && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Your link code</p>
                  <p
                    className="mt-2 select-all font-mono text-4xl font-bold tracking-[0.15em] text-neutral-900"
                    aria-live="polite"
                  >
                    {code.code}
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <SecondaryButton onClick={copyCode}>
                      {copied ? <FiCheck className="mr-1.5 h-4 w-4" aria-hidden="true" /> : <FiCopy className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                      {copied ? "Copied" : "Copy"}
                    </SecondaryButton>
                  </div>
                  <p className="mt-4 text-sm text-neutral-700">
                    Open the desk app → <strong>Link with code</strong> → type this code.
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Works once. Expires in <span className="font-semibold tabular-nums">{countdown(expiresAt - now)}</span>.
                  </p>
                </div>
              )}

              {code && linkedDevice && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Linked — {linkedDevice} is signed in and ready.
                </p>
              )}

              {code && expired && !linkedDevice && (
                <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                  That code has expired. Get a new one when you are at the desk.
                </p>
              )}

              {code?.granted_app_access && (
                <p className="mt-3 text-xs text-neutral-500">
                  Front-desk app access has been switched on for your account.
                </p>
              )}
              {!code && overview?.grants_access_on_link && (
                <p className="mb-3 text-xs text-neutral-500">
                  Getting a code also switches on front-desk app access for your account.
                </p>
              )}

              {codeError && (
                <p role="alert" className="mt-3 text-sm text-rose-700">
                  {codeError}
                </p>
              )}

              <div className="mt-4">
                {!code || expired || linkedDevice ? (
                  <PrimaryButton onClick={getCode} loading={making}>
                    {code ? "Get a new code" : "Get link code"}
                  </PrimaryButton>
                ) : (
                  <SecondaryButton onClick={getCode} loading={making}>
                    Get a new code
                  </SecondaryButton>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 3. Linked desks */}
      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-900">Linked desks</h2>
          {overview?.scope === "own" && (
            <p className="text-xs text-neutral-500">Showing the desks signed in with your account.</p>
          )}
        </div>

        {notice && (
          <p role="status" className="mt-3 text-sm text-neutral-700">
            {notice}
          </p>
        )}

        <div className="mt-4">
          {loading ? (
            <Spinner />
          ) : error ? null : desks.length === 0 ? (
            <EmptyState title="No desks are signed in" hint="Link one with a code above." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {desks.map((desk) => (
                <li key={desk.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                      <span className="truncate">{desk.device || "Unnamed PC"}</span>
                      <Badge color={desk.kind === "kiosk" ? "blue" : "neutral"}>
                        {desk.kind === "kiosk" ? "Web kiosk" : "Desk app"}
                      </Badge>
                      {desk.mine && <Badge color="green">You</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Signed in as {desk.account} · since {formatWhen(desk.signed_in_at)} · last used{" "}
                      {formatWhen(desk.last_seen_at)}
                    </p>
                  </div>
                  <DangerButton onClick={() => unlink(desk)} loading={unlinking.isBusy(desk.id)}>
                    Unlink
                  </DangerButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {dialog}
    </div>
  );
}
