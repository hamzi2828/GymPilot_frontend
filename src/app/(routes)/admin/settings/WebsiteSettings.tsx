"use client";

// Settings → General → Website: the site language and direction, what
// search engines and social previews show, the Google Maps embed, opening
// hours, and the snippet for embedding the timetable elsewhere. One card
// per topic; the page's sticky bar saves them all.

import { Card, TextField, TextArea, SelectField } from "../_shared/ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface WebsiteFields {
  siteUrl?: string;
  seo?: { title?: string; description?: string; keywords?: string; ogImage?: string };
  maps?: { embedUrl?: string; placeUrl?: string; latitude?: number | null; longitude?: number | null };
  openingHours?: { day: string; open: string; close: string; closed: boolean }[];
  locale?: { language?: string; direction?: "ltr" | "rtl" };
}

function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export default function WebsiteSettings<T extends WebsiteFields>({ settings, setSettings }: { settings: T; setSettings: (next: T) => void }) {
  const hours = DAYS.map((day) => (settings.openingHours || []).find((h) => h.day === day) || { day, open: "06:00", close: "22:00", closed: false });
  const setHour = (day: string, patch: Partial<{ open: string; close: string; closed: boolean }>) =>
    setSettings({ ...settings, openingHours: hours.map((h) => (h.day === day ? { ...h, ...patch } : h)) });
  const origin = (settings.siteUrl || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");

  return (
    <>
      <Card className="p-6">
        <Heading title="Language" hint="The language the public site and member portal open in. Visitors can still switch in the header." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label="Site language"
            value={settings.locale?.language ?? "en"}
            allowClear={false}
            onChange={(v) => setSettings({ ...settings, locale: { language: v, direction: v === "ar" || v === "ur" ? "rtl" : "ltr" } })}
            options={[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية (RTL)" },
              { value: "ur", label: "اردو (RTL)" },
              { value: "es", label: "Español" },
              { value: "fr", label: "Français" },
            ]}
          />
          <SelectField label="Text direction" value={settings.locale?.direction ?? "ltr"} allowClear={false} onChange={(v) => setSettings({ ...settings, locale: { ...(settings.locale || {}), direction: v as "ltr" | "rtl" } })} options={[{ value: "ltr", label: "Left to right" }, { value: "rtl", label: "Right to left" }]} />
        </div>
      </Card>

      <Card className="p-6">
        <Heading title="Search & social" hint="What Google shows for your site and what appears when a link is shared on WhatsApp or social media." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Search title (browser tab / Google)" value={settings.seo?.title ?? ""} onChange={(v) => setSettings({ ...settings, seo: { ...(settings.seo || {}), title: v } })} placeholder="Iron Works Gym | Lahore" />
          <TextField label="Keywords (comma separated)" value={settings.seo?.keywords ?? ""} onChange={(v) => setSettings({ ...settings, seo: { ...(settings.seo || {}), keywords: v } })} placeholder="gym, lahore, personal training" />
          <div className="md:col-span-2">
            <TextArea label="Search description (up to 300 characters)" value={settings.seo?.description ?? ""} onChange={(v) => setSettings({ ...settings, seo: { ...(settings.seo || {}), description: v } })} />
          </div>
          <div className="md:col-span-2">
            <TextField label="Social preview image URL" value={settings.seo?.ogImage ?? ""} onChange={(v) => setSettings({ ...settings, seo: { ...(settings.seo || {}), ogImage: v } })} placeholder="https://…/photo.jpg" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <Heading title="Map" hint="Shown on the contact page. Only Google Maps embed links are accepted." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextField label="Google Maps embed URL (Share → Embed a map → copy the src)" value={settings.maps?.embedUrl ?? ""} onChange={(v) => setSettings({ ...settings, maps: { ...(settings.maps || {}), embedUrl: v } })} placeholder="https://www.google.com/maps/embed?pb=…" />
          </div>
          <TextField label="Google Maps place link" value={settings.maps?.placeUrl ?? ""} onChange={(v) => setSettings({ ...settings, maps: { ...(settings.maps || {}), placeUrl: v } })} placeholder="https://maps.app.goo.gl/…" />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Latitude" type="number" value={settings.maps?.latitude ?? ""} onChange={(v) => setSettings({ ...settings, maps: { ...(settings.maps || {}), latitude: v === "" ? null : Number(v) } })} />
            <TextField label="Longitude" type="number" value={settings.maps?.longitude ?? ""} onChange={(v) => setSettings({ ...settings, maps: { ...(settings.maps || {}), longitude: v === "" ? null : Number(v) } })} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <Heading title="Opening hours" hint="Shown on the website and in search results. Tick closed for days the gym does not open." />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {hours.map((row) => (
            <div key={row.day} className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-neutral-700">{row.day}</span>
              <input type="time" value={row.open} disabled={row.closed} onChange={(e) => setHour(row.day, { open: e.target.value })} className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs disabled:opacity-40" />
              <span className="text-neutral-400">–</span>
              <input type="time" value={row.close} disabled={row.closed} onChange={(e) => setHour(row.day, { close: e.target.value })} className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs disabled:opacity-40" />
              <label className="ml-auto flex items-center gap-1 text-xs text-neutral-600">
                <input type="checkbox" checked={row.closed} onChange={(e) => setHour(row.day, { closed: e.target.checked })} /> closed
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <Heading title="Embed the timetable on another website" hint="Paste this where the timetable should appear. It shows this gym's live classes." />
        <code className="block overflow-x-auto rounded-lg bg-neutral-50 p-3 font-mono text-[11px] text-neutral-800">{`<iframe src="${origin}/embed/timetable" width="100%" height="900" style="border:0" loading="lazy"></iframe>`}</code>
      </Card>
    </>
  );
}
