import React from "react";
import Link from "next/link";
import { sanitizeHtml } from "@/helper/sanitize";
import type { ContentPage } from "@/app/(routes)/faqs/services/contentService";
import PageHero from "@/components/site/PageHero";
import FaqAccordion from "@/components/site/FaqAccordion";

/**
 * The shared chrome for the three CMS-backed pages.
 *
 * One component rather than three near-identical ones: FAQs, the privacy
 * policy and the terms differ only in whether the body is a list of questions
 * or a block of prose, and they all want the same sidebar, heading and
 * "last updated" line.
 *
 * Everything rendered here is admin-authored HTML. It is sanitised on the way
 * INTO the database as well, but it is sanitised again here — the stored value
 * predates that sanitising for any page written earlier, and a render-time
 * pass is the one that actually protects the visitor.
 */

const NAV = [
  { href: "/faqs", label: "FAQs", icon: "fas fa-question-circle" },
  { href: "/privacy-policy", label: "Privacy", icon: "fas fa-shield-alt" },
  { href: "/terms", label: "Terms", icon: "fas fa-file-contract" },
  { href: "/contact-us", label: "Contact us", icon: "fas fa-envelope" },
];

function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function ContentPageLayout({
  page,
  activeHref,
  fallbackTitle,
}: {
  page: ContentPage | null;
  activeHref: string;
  fallbackTitle: string;
}) {
  const updated = formatDate(page?.effectiveFrom || page?.updatedAt);

  const navLabel = NAV.find((n) => n.href === activeHref)?.label;

  return (
    <main className="min-h-screen bg-[var(--base)] text-white">
      <PageHero
        title={page?.title || fallbackTitle}
        lead={page?.subtitle || undefined}
        crumbs={[{ label: "Home", href: "/" }, { label: navLabel || page?.title || fallbackTitle }]}
      >
        {updated && <p className="mt-5 text-[13px] text-white/50">Last updated {updated}</p>}
      </PageHero>

      <div className="px-4 pb-24 sm:px-6 lg:px-20">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 lg:flex-row lg:gap-14">
          <aside className="flex-shrink-0 lg:w-60">
            <nav
              aria-label="Help pages"
              className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2 lg:sticky lg:top-28 lg:flex lg:flex-col"
            >
              {NAV.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-w-0 items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                      active
                        ? "bg-[var(--accent)] text-[var(--on-accent)]"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <i className={`${item.icon} w-4 text-center`} aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0 flex-1">
            {!page ? (
              // The API is unreachable or the page is unpublished. Say so
              // plainly rather than rendering an empty shell that looks like
              // the gym has no policy.
              <div className="rounded-3xl border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center">
                <p className="text-[var(--text-muted)]">This page has not been published yet.</p>
                <Link href="/contact-us" className="btn btn--primary mt-6">
                  <span>Contact us instead</span>
                </Link>
              </div>
            ) : page.type === "faq" ? (
              <div className="space-y-14">
                {(page.sections || []).map((section, i) => (
                  <section key={section._id || i}>
                    {section.heading && (
                      <h2 className="mb-2 font-['Montserrat'] text-2xl font-extrabold tracking-tight text-white">
                        {section.heading}
                      </h2>
                    )}
                    {section.body && (
                      <div
                        className="prose prose-sm prose-invert mb-5 max-w-none text-[var(--text-muted)]"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body) }}
                      />
                    )}
                    <div className="mt-5">
                      <FaqAccordion
                        items={(section.items || []).map((item, j) => ({
                          id: item._id || `${i}-${j}`,
                          question: item.question,
                          answerHtml: sanitizeHtml(item.answer),
                        }))}
                      />
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 sm:p-10">
                <div
                  className="prose prose-sm sm:prose prose-invert max-w-none text-white/75 prose-headings:font-extrabold prose-headings:text-white prose-a:text-[var(--accent)] prose-a:underline-offset-4"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default ContentPageLayout;
