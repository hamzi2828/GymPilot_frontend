"use client";

import React, { useState } from "react";
import { useSiteSettings } from "@/components/ThemeProvider";
import { useLanguage } from "@/i18n/LanguageProvider";
import { newsletterService } from "@/app/(routes)/blogs-detail/services/newsletterService";
import Image from "next/image";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";

const Footer = () => {
  // Logo and business name come from admin settings rather than a hardcoded
  // asset, so rebranding needs no code change.
  const {
    logoUrl,
    footerLogoUrl,
    siteName,
    facebookUrl,
    instagramUrl,
    youtubeUrl,
    twitterUrl,
    tiktokUrl,
  } = useSiteSettings();
  const { t } = useLanguage();
  const brandLogo = footerLogoUrl || logoUrl;

  // The sign-up joins the gym's newsletter list, the one its campaigns are
  // sent to. The form used to do nothing at all when submitted.
  const [email, setEmail] = useState("");
  const { busy: sending, run } = useAsyncAction();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    await run(async () => {
      setNotice(null);
      try {
        await newsletterService.subscribe(value, "footer");
        setNotice({ tone: "ok", text: t("footer.newsDone") });
        setEmail("");
      } catch (err) {
        const status = (err as { status?: number } | null)?.status;
        if (status === 409) {
          setNotice({ tone: "ok", text: t("footer.newsAlready") });
          return;
        }
        // A refusal the server explained ("Please enter a valid email") is
        // shown in its words: the visitor can fix the address. No answer at
        // all, or a server fault, gets the general "try again".
        const said = status && status < 500 && err instanceof Error ? err.message.trim() : "";
        setNotice({ tone: "error", text: said || t("footer.newsError") });
      }
    });
  };

  // Only profiles the admin has actually filled in get a link — an unset
  // network is omitted rather than pointing at the platform's homepage.
  const socials = [
    { label: "Instagram", href: instagramUrl, icon: "fab fa-instagram" },
    { label: "Facebook", href: facebookUrl, icon: "fab fa-facebook" },
    { label: "YouTube", href: youtubeUrl, icon: "fab fa-youtube" },
    { label: "X", href: twitterUrl, icon: "fab fa-x-twitter" },
    { label: "TikTok", href: tiktokUrl, icon: "fab fa-tiktok" },
  ].filter((s): s is { label: string; href: string; icon: string } => !!s.href?.trim());

  const columns = [
    {
      heading: t("footer.programs"),
      links: [
        { href: "/packages", label: t("footer.packages") },
        { href: "/classes", label: t("footer.classes") },
        { href: "/trainers", label: t("footer.trainers") },
      ],
    },
    {
      heading: t("footer.support"),
      links: [
        { href: "/contact-us", label: t("footer.contact") },
        { href: "/trainers", label: t("footer.trainerDetails") },
        { href: "/faqs", label: t("footer.faqs") },
      ],
    },
    {
      heading: t("footer.company"),
      links: [
        { href: "/about-us", label: t("footer.about") },
        { href: "/privacy-policy", label: t("footer.privacy") },
        { href: "/contact-us", label: t("footer.getInTouch") },
      ],
    },
  ];
  const linkClass =
    "text-[15px] text-white/60 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:underline underline-offset-4";

  return (
    <footer className="relative overflow-hidden border-t border-[var(--border-subtle)] bg-[var(--base)] px-4 pb-10 pt-16 text-white sm:px-8 lg:px-16 lg:pt-20">
      {/* Accent hairline and soft glow along the top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)", opacity: 0.6 }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(ellipse, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1400px]">
        {/* Newsletter */}
        <section className="grid grid-cols-1 items-end gap-8 rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 sm:p-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <h2 className="font-['Montserrat'] text-3xl font-extrabold tracking-tight sm:text-4xl">{t("footer.newsTitle")}</h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--text-muted)]">{t("footer.newsText")}</p>
          </div>
          <form className="w-full" onSubmit={subscribe}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                className="h-14 min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-5 text-white placeholder-white/40 transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
                placeholder={t("footer.newsPlaceholder")}
                aria-label={t("footer.newsEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
                required
              />
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={sending}
                aria-busy={sending || undefined}
              >
                <span className="inline-flex items-center">
                  {sending && <Spinner className="mr-2" />}
                  {sending ? t("footer.newsSending") : t("footer.newsSubscribe")}
                </span>
              </button>
            </div>
            {notice && (
              <p
                role="status"
                aria-live="polite"
                className={`mt-3 text-sm ${notice.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}
              >
                {notice.text}
              </p>
            )}
          </form>
        </section>

        {/* Links */}
        <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]" aria-label="Go to homepage">
              <Image
                width={160}
                height={56}
                src={brandLogo}
                alt={`${siteName} logo`}
                className="h-auto max-h-12 w-auto max-w-[200px] object-contain"
              />
            </Link>
          </div>

          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-white">{col.heading}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className={linkClass}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-white">{t("footer.follow")}</h4>
            {socials.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      title={s.label}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] text-white/70 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      <i className={s.icon} aria-hidden="true"></i>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-4">
                <li>
                  <Link href="/contact-us" className={linkClass}>{t("footer.getInTouch")}</Link>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-14 flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteName ? `${siteName} — ` : ""}{t("footer.rights")}
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy-policy" className={linkClass}>{t("footer.privacy")}</Link>
            <Link href="/terms" className={linkClass}>{t("footer.terms")}</Link>
            <Link href="/contact-us" className={linkClass}>{t("footer.contact")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;