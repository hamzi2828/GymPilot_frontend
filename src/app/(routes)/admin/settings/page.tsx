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
    </div>
  );
}
