"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  Card,
  PrimaryButton,
  TextField,
  TextArea,
  Spinner,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { THEMES, DEFAULT_THEME_KEY } from "@/theme/themes";
import { setActiveTheme } from "@/components/ThemeProvider";

interface Settings {
  _id?: string;
  siteName?: string;
  siteDescription?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  theme?: string;
}

const SETTINGS_API = `${API_BASE}/settings`;

export default function SettingsAdminPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: Settings; settings?: Settings }>(SETTINGS_API);
      setSettings(r.data || r.settings || {});
    } catch {
      setSettings({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await apiJson(SETTINGS_API, "PUT", settings);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <Spinner />;

  return (
    <div>
      <PageHeader eyebrow="System" title="Settings" />

      <Card className="p-6 max-w-3xl">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Site Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Site Name" value={settings.siteName} onChange={(v) => setSettings({ ...settings, siteName: v })} />
          <TextField label="Contact Email" type="email" value={settings.contactEmail} onChange={(v) => setSettings({ ...settings, contactEmail: v })} />
          <TextField label="Contact Phone" value={settings.contactPhone} onChange={(v) => setSettings({ ...settings, contactPhone: v })} />
          <TextField label="Address" value={settings.address} onChange={(v) => setSettings({ ...settings, address: v })} />
          <div className="md:col-span-2">
            <TextArea label="Site Description" value={settings.siteDescription} onChange={(v) => setSettings({ ...settings, siteDescription: v })} />
          </div>
        </div>

        <h2 className="text-sm font-semibold text-neutral-900 mt-8 mb-4">Social Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Facebook" value={settings.facebook} onChange={(v) => setSettings({ ...settings, facebook: v })} />
          <TextField label="Instagram" value={settings.instagram} onChange={(v) => setSettings({ ...settings, instagram: v })} />
          <TextField label="Twitter" value={settings.twitter} onChange={(v) => setSettings({ ...settings, twitter: v })} />
          <TextField label="YouTube" value={settings.youtube} onChange={(v) => setSettings({ ...settings, youtube: v })} />
          <TextField label="LinkedIn" value={settings.linkedin} onChange={(v) => setSettings({ ...settings, linkedin: v })} />
        </div>

        <div className="flex justify-end mt-6">
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</PrimaryButton>
        </div>
      </Card>

      <Card className="p-6 max-w-3xl mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">Colour Scheme</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-4">
          Applies across the whole public site — header, buttons, links and footer.
          Selecting a scheme previews it instantly; press Save to make it live for everyone.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const active = (settings.theme || DEFAULT_THEME_KEY) === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setSettings({ ...settings, theme: t.key });
                  setActiveTheme(t.key); // live preview
                }}
                aria-pressed={active}
                className={`text-left rounded-xl border p-3 transition-all ${
                  active
                    ? "border-neutral-900 ring-2 ring-neutral-900/10 bg-neutral-50"
                    : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/10"
                    style={{ background: t.tokens.base }}
                  >
                    <span
                      className="h-5 w-5 rounded-full"
                      style={{ background: t.tokens.accent }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900 truncate">{t.name}</span>
                      {active && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-neutral-900 rounded px-1.5 py-0.5">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{t.description}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-1.5">
                  {[t.tokens.accent, t.tokens.accentDark, t.tokens.accentSoft, t.tokens.surface, t.tokens.base].map(
                    (c) => (
                      <span
                        key={c}
                        title={c}
                        className="h-5 flex-1 rounded border border-black/10"
                        style={{ background: c }}
                      />
                    )
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Colour Scheme"}</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
