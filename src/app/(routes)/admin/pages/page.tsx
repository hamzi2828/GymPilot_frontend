"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiExternalLink, FiRotateCcw } from "react-icons/fi";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  TextField,
  TextArea,
  Toggle,
  Spinner,
  Badge,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";

interface FaqItem {
  _id?: string;
  question: string;
  answer: string;
}

interface Section {
  _id?: string;
  heading: string;
  body?: string;
  items: FaqItem[];
}

interface ContentPage {
  slug: "faqs" | "privacy-policy" | "terms";
  title: string;
  subtitle?: string;
  type: "faq" | "richtext";
  body?: string;
  sections?: Section[];
  seo?: { metaTitle?: string; metaDescription?: string };
  isPublished: boolean;
  effectiveFrom?: string | null;
  updatedAt?: string;
  updatedByName?: string;
}

const PUBLIC_PATH: Record<ContentPage["slug"], string> = {
  faqs: "/faqs",
  "privacy-policy": "/privacy-policy",
  terms: "/terms",
};

export default function ContentPagesAdmin() {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [active, setActive] = useState<ContentPage["slug"]>("faqs");
  const [draft, setDraft] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: ContentPage[] }>(`${API_BASE}/content`);
      setPages(r.data || []);
      const found = (r.data || []).find((p) => p.slug === active);
      if (found) setDraft(structuredClone(found));
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load pages" });
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    try {
      await apiJson(`${API_BASE}/content/${draft.slug}`, "PUT", {
        title: draft.title,
        subtitle: draft.subtitle,
        body: draft.body,
        sections: draft.sections,
        seo: draft.seo,
        isPublished: draft.isPublished,
        effectiveFrom: draft.effectiveFrom,
      });
      setNotice({ tone: "ok", text: "Saved. The public page updates within five minutes." });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!draft) return;
    if (!confirm("Replace this page with the text it shipped with? Your edits will be lost.")) return;
    setSaving(true);
    try {
      await apiJson(`${API_BASE}/content/${draft.slug}/reset`, "POST");
      setNotice({ tone: "ok", text: "Reset to the default text." });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not reset" });
    } finally {
      setSaving(false);
    }
  };

  const patch = (change: Partial<ContentPage>) => draft && setDraft({ ...draft, ...change });

  const patchSection = (index: number, change: Partial<Section>) => {
    if (!draft?.sections) return;
    patch({
      sections: draft.sections.map((s, i) => (i === index ? { ...s, ...change } : s)),
    });
  };

  const patchItem = (si: number, ii: number, change: Partial<FaqItem>) => {
    if (!draft?.sections) return;
    patch({
      sections: draft.sections.map((s, i) =>
        i === si
          ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, ...change } : it)) }
          : s
      ),
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Pages"
        actions={
          draft && (
            <div className="flex gap-2">
              <a
                href={`${PUBLIC_PATH[draft.slug]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-400"
              >
                <FiExternalLink className="h-3.5 w-3.5" /> View page
              </a>
              <SecondaryButton onClick={reset} disabled={saving}>
                <FiRotateCcw className="h-3.5 w-3.5" /> Reset to default
              </SecondaryButton>
              <PrimaryButton onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </PrimaryButton>
            </div>
          )
        }
      />

      {notice && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {pages.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setActive(p.slug)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              active === p.slug
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-700 hover:border-neutral-400"
            }`}
          >
            {p.title}
            {!p.isPublished && <span className="ml-2 text-[11px] opacity-70">draft</span>}
          </button>
        ))}
      </div>

      {loading || !draft ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="Title" value={draft.title} onChange={(v) => patch({ title: v })} />
              <TextField
                label="Effective from"
                type="date"
                value={draft.effectiveFrom ? String(draft.effectiveFrom).slice(0, 10) : ""}
                onChange={(v) => patch({ effectiveFrom: v || null })}
              />
              <div className="md:col-span-2">
                <TextField
                  label="Subtitle"
                  value={draft.subtitle || ""}
                  onChange={(v) => patch({ subtitle: v })}
                />
              </div>
              <TextField
                label="SEO title"
                value={draft.seo?.metaTitle || ""}
                onChange={(v) => patch({ seo: { ...draft.seo, metaTitle: v } })}
              />
              <TextField
                label="SEO description"
                value={draft.seo?.metaDescription || ""}
                onChange={(v) => patch({ seo: { ...draft.seo, metaDescription: v } })}
              />
              <div className="md:col-span-2 flex items-center justify-between border-t border-neutral-100 pt-4">
                <Toggle
                  label="Published"
                  checked={draft.isPublished}
                  onChange={(v) => patch({ isPublished: v })}
                />
                {draft.updatedByName && (
                  <span className="text-[12px] text-neutral-500">
                    Last edited by {draft.updatedByName}
                  </span>
                )}
              </div>
              {!draft.isPublished && (
                <p className="md:col-span-2 text-[12px] text-amber-700">
                  Unpublished pages return a 404 on the public site — visitors see a
                  &ldquo;not published yet&rdquo; message instead of the text.
                </p>
              )}
            </div>
          </Card>

          {draft.type === "richtext" ? (
            <Card className="p-5">
              <TextArea
                label="Page content (HTML)"
                value={draft.body || ""}
                rows={26}
                onChange={(v) => patch({ body: v })}
              />
              <p className="mt-2 text-[12px] text-neutral-500">
                Headings, lists, links and tables are kept. Scripts, styles, images and
                embedded content are stripped when you save.
              </p>
            </Card>
          ) : (
            <div className="space-y-5">
              {(draft.sections || []).map((section, si) => (
                <Card key={section._id || si} className="p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex-1">
                      <TextField
                        label="Section heading"
                        value={section.heading}
                        onChange={(v) => patchSection(si, { heading: v })}
                      />
                    </div>
                    <div className="pt-5">
                      <DangerButton
                        onClick={() =>
                          patch({ sections: (draft.sections || []).filter((_, i) => i !== si) })
                        }
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </DangerButton>
                    </div>
                  </div>

                  <div className="space-y-4 border-l-2 border-neutral-100 pl-4">
                    {section.items.map((item, ii) => (
                      <div key={item._id || ii} className="rounded-lg border border-neutral-200 p-4">
                        <div className="mb-3 flex items-start gap-3">
                          <div className="flex-1">
                            <TextField
                              label={`Question ${ii + 1}`}
                              value={item.question}
                              onChange={(v) => patchItem(si, ii, { question: v })}
                            />
                          </div>
                          <div className="pt-5">
                            <DangerButton
                              onClick={() =>
                                patchSection(si, {
                                  items: section.items.filter((_, j) => j !== ii),
                                })
                              }
                            >
                              <FiTrash2 className="h-3.5 w-3.5" />
                            </DangerButton>
                          </div>
                        </div>
                        <TextArea
                          label="Answer (HTML)"
                          value={item.answer}
                          rows={4}
                          onChange={(v) => patchItem(si, ii, { answer: v })}
                        />
                      </div>
                    ))}

                    <SecondaryButton
                      onClick={() =>
                        patchSection(si, {
                          items: [...section.items, { question: "", answer: "<p></p>" }],
                        })
                      }
                    >
                      <FiPlus className="h-3.5 w-3.5" /> Add a question
                    </SecondaryButton>
                  </div>
                </Card>
              ))}

              <SecondaryButton
                onClick={() =>
                  patch({
                    sections: [...(draft.sections || []), { heading: "New section", items: [] }],
                  })
                }
              >
                <FiPlus className="h-3.5 w-3.5" /> Add a section
              </SecondaryButton>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
            <p className="text-[12px] text-neutral-600">
              {draft.slug === "faqs" ? (
                <>Questions appear on <Badge color="neutral">/faqs</Badge> in the order shown.</>
              ) : (
                <>
                  This is a starting template, not legal advice — have it reviewed before you
                  rely on it.
                </>
              )}
            </p>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
