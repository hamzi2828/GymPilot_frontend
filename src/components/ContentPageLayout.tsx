import React from "react";
import Link from "next/link";
import { sanitizeHtml } from "@/helper/sanitize";
import type { ContentPage } from "@/app/(routes)/faqs/services/contentService";

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

  return (
    <main className="pt-24 pb-20 bg-white min-h-screen">
      <div className="px-4 sm:px-6 lg:px-20">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="rounded-xl border border-gray-200 overflow-hidden lg:sticky lg:top-28">
              {NAV.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block w-full px-6 py-4 text-left text-sm font-semibold border-b border-gray-100 last:border-b-0 transition-colors ${
                      active
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <i className={`${item.icon} mr-2`} aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section className="flex-1 min-w-0">
            {!page ? (
              // The API is unreachable or the page is unpublished. Say so
              // plainly rather than rendering an empty shell that looks like
              // the gym has no policy.
              <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center">
                <h1 className="text-2xl font-black text-gray-900">{fallbackTitle}</h1>
                <p className="mt-3 text-gray-500">
                  This page has not been published yet.
                </p>
                <Link
                  href="/contact-us"
                  className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-bold text-white"
                >
                  Contact us instead
                </Link>
              </div>
            ) : (
              <>
                <header className="mb-10">
                  <h1 className="text-3xl lg:text-4xl font-black text-gray-900">{page.title}</h1>
                  {page.subtitle && (
                    <p className="mt-3 max-w-2xl text-gray-600">{page.subtitle}</p>
                  )}
                  {updated && (
                    <p className="mt-4 text-[13px] text-gray-400">Last updated {updated}</p>
                  )}
                </header>

                {page.type === "faq" ? (
                  <div className="space-y-12">
                    {(page.sections || []).map((section, i) => (
                      <section key={section._id || i}>
                        {section.heading && (
                          <h2 className="mb-1 text-xl font-black text-gray-900">
                            {section.heading}
                          </h2>
                        )}
                        {section.body && (
                          <div
                            className="prose prose-sm max-w-none text-gray-600"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body) }}
                          />
                        )}

                        <dl className="mt-5 divide-y divide-gray-100 border-t border-gray-100">
                          {(section.items || []).map((item, j) => (
                            <div key={item._id || j} className="py-5">
                              <dt className="font-bold text-gray-900">{item.question}</dt>
                              <dd
                                className="prose prose-sm mt-2 max-w-none text-gray-600 prose-a:text-gray-900 prose-a:underline prose-a:underline-offset-4"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.answer) }}
                              />
                            </div>
                          ))}
                        </dl>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div
                    className="prose prose-sm sm:prose max-w-none text-gray-700 prose-headings:text-gray-900 prose-headings:font-black prose-a:text-gray-900 prose-a:underline prose-a:underline-offset-4"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }}
                  />
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default ContentPageLayout;
