"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  Card,
  PrimaryButton,
  TextField,
  TextArea,
  Toggle,
  Spinner,
} from "../_shared/ui";
import { API_BASE, apiGet, apiForm } from "../_shared/api";

interface BlogHero {
  _id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  backgroundImage?: string;
  isActive?: boolean;
}

const HERO_API = `${API_BASE}/blog-hero`;

export default function BlogSettingsAdminPage() {
  const [hero, setHero] = useState<BlogHero | null>(null);
  const [loading, setLoading] = useState(true);
  const [bg, setBg] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: BlogHero[]; hero?: BlogHero }>(HERO_API);
      const data = (r.data && r.data[0]) || r.hero || null;
      setHero(data || { title: "", subtitle: "", description: "", isActive: true });
    } catch {
      setHero({ title: "", subtitle: "", description: "", isActive: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!hero) return;
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(hero).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (k === "_id" || k === "backgroundImage") return;
        fd.append(k, String(v));
      });
      if (bg) fd.append("backgroundImage", bg);
      if (hero._id) {
        await apiForm(`${HERO_API}/${hero._id}`, "PUT", fd);
      } else {
        await apiForm(HERO_API, "POST", fd);
      }
      setBg(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !hero) return <Spinner />;

  return (
    <div>
      <PageHeader eyebrow="Content" title="Blog Settings" />

      <Card className="p-6 max-w-3xl">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Blog Hero</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Title" value={hero.title} onChange={(v) => setHero({ ...hero, title: v })} />
          <TextField label="Subtitle" value={hero.subtitle} onChange={(v) => setHero({ ...hero, subtitle: v })} />
          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Background Image</span>
            <input type="file" accept="image/*" onChange={(e) => setBg(e.target.files?.[0] || null)} className="mt-1 w-full text-sm" />
          </label>
          <div className="md:col-span-2">
            <TextArea label="Description" value={hero.description} onChange={(v) => setHero({ ...hero, description: v })} />
          </div>
          <Toggle label="Active" checked={!!hero.isActive} onChange={(v) => setHero({ ...hero, isActive: v })} />
        </div>
        <div className="flex justify-end mt-6">
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
