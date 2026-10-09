"use client";

import React, { useState } from "react";
import { useSiteSettings } from "@/components/ThemeProvider";
import { useLanguage } from "@/i18n/LanguageProvider";
import { newsletterService } from "@/app/(routes)/blogs-detail/services/newsletterService";
import Image from "next/image";
import Link from "next/link";

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
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || sending) return;
    setSending(true);
    setNotice(null);
    try {
      await newsletterService.subscribe(value, "footer");
      setNotice({ tone: "ok", text: t("footer.newsDone") });
      setEmail("");
    } catch (err) {
      const already = (err as { status?: number } | null)?.status === 409;
      setNotice({ tone: already ? "ok" : "error", text: t(already ? "footer.newsAlready" : "footer.newsError") });
    } finally {
      setSending(false);
    }
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

  return (
  <footer className="footer-main">
    <div className="footer-container">
      {/* Newsletter: heading on the left, sign-up on the right. */}
      <section className="footer-newsletter-section">
        <div className="footer-newsletter-text">
          <h2 className="footer-main-heading">{t("footer.newsTitle")}</h2>
          <p className="footer-newsletter-subtext">{t("footer.newsText")}</p>
        </div>

        <form className="footer-email-form" onSubmit={subscribe}>
          <div className="footer-input-wrapper">
            <input
              type="email"
              className="footer-email-input"
              placeholder={t("footer.newsPlaceholder")}
              aria-label={t("footer.newsEmail")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
              required
            />
            {notice && (
              <p
                role="status"
                aria-live="polite"
                className={`footer-newsletter-status ${notice.tone === "ok" ? "is-ok" : "is-error"}`}
              >
                {notice.text}
              </p>
            )}
          </div>
          <button type="submit" className="footer-subscribe-button" disabled={sending}>
            <span className="footer-subscribe-text">
              {sending ? t("footer.newsSending") : t("footer.newsSubscribe")}
            </span>
          </button>
        </form>
      </section>

      {/* Main Footer Links */}
      <section className="footer-links-section">
        <div className="footer-links-container">
          {/* Logo */}
          <div className="footer-logo-section">
            <div className="footer-logo-wrapper">
              <Link href="/" className="footer-logo-link" aria-label="Go to homepage">
                <Image
                  width={100}
                  height={100}
                  src={brandLogo}
                  alt={`${siteName} logo`}
                  className="footer-logo-image"
                />
              </Link>
            </div>
          </div>

          {/* Columns */}
          <div className="footer-links-content">
            {/* Programs */}
            <div className="footer-links-column">
              <h4 className="footer-column-heading">{t("footer.programs")}</h4>
              <nav className="footer-nav-links">
                <Link href="/packages" className="footer-nav-link">{t("footer.packages")}</Link>
                <Link href="/classes" className="footer-nav-link">{t("footer.classes")}</Link>
                <Link href="/trainers" className="footer-nav-link">{t("footer.trainers")}</Link>
              </nav>
            </div>

            {/* Support */}
            <div className="footer-links-column">
              <h4 className="footer-column-heading">{t("footer.support")}</h4>
              <nav className="footer-nav-links">
                <Link href="/contact-us" className="footer-nav-link">{t("footer.contact")}</Link>
                <Link href="/trainers" className="footer-nav-link">{t("footer.trainerDetails")}</Link>
                <Link href="/faqs" className="footer-nav-link">{t("footer.faqs")}</Link>
              
              </nav>
            </div>

            {/* Company */}
            <div className="footer-links-column">
              <h4 className="footer-column-heading">{t("footer.company")}</h4>
              <nav className="footer-nav-links">
                <Link href="/about-us" className="footer-nav-link">{t("footer.about")}</Link>
                <Link href="/privacy-policy" className="footer-nav-link">{t("footer.privacy")}</Link>
               
                <Link href="/contact-us" className="footer-nav-link">{t("footer.getInTouch")}</Link>
              </nav>
            </div>

            {/* Social */}
            <div className="footer-links-column footer-social-column">
              <h4 className="footer-column-heading">{t("footer.follow")}</h4>
              <nav className="footer-nav-links">
                {socials.length > 0 ? (
                  socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-social-link"
                      aria-label={s.label}
                    >
                      <i className={s.icon} aria-hidden="true"></i>
                      <span>{s.label}</span>
                    </a>
                  ))
                ) : (
                  <Link href="/contact-us" className="footer-nav-link">
                    {t("footer.getInTouch")}
                  </Link>
                )}
              </nav>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom-section">
          <div className="footer-bottom-content">
            <p className="footer-copyright">
              <span className="footer-copyright-symbol">©</span>
              <span className="footer-copyright-year">{new Date().getFullYear()}</span>
              <span className="footer-copyright-text">
                {" "}{siteName} — {t("footer.rights")}
              </span>
            </p>
            <nav className="footer-legal-links">
              <Link href="/privacy-policy" className="footer-legal-link">{t("footer.privacy")}</Link>
              <Link href="/terms" className="footer-legal-link">{t("footer.terms")}</Link>
              <Link href="/contact-us" className="footer-legal-link">{t("footer.contact")}</Link>
            </nav>
          </div>
        </div>
      </section>

    </div>
  </footer>
  );
};

export default Footer;