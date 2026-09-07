"use client";

// Shown instead of the site when the API says this domain does not lead to a
// gym, or the gym it leads to is not being served right now. Plain and
// unbranded on purpose: there is no gym to take the branding from.

const COPY: Record<string, { title: string; body: string }> = {
  TENANT_NOT_FOUND: {
    title: "This domain isn't connected to a gym yet",
    body: "If you are setting this gym up, add this domain to the gym in the GymPilot platform panel. It usually takes effect within a minute.",
  },
  TENANT_SUSPENDED: {
    title: "This gym's website is currently suspended",
    body: "Please contact GymPilot support to restore access.",
  },
  SUBSCRIPTION_INACTIVE: {
    title: "This gym's GymPilot subscription is not active",
    body: "Please contact GymPilot support to renew the subscription and bring the website back.",
  },
};

export default function TenantUnavailable({ code, message, host }: { code: string; message?: string; host?: string | null }) {
  const copy = COPY[code] || { title: "This website is unavailable", body: message || "Please try again later." };

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-6 py-24 text-neutral-900">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">GymPilot</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm text-neutral-600">{copy.body}</p>
        {host && (
          <p className="mt-6 rounded-lg border border-neutral-200 bg-white px-4 py-2 font-mono text-xs text-neutral-500">
            {host}
          </p>
        )}
      </div>
    </main>
  );
}
