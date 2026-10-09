"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, LogOut, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import { getAuthHeader, getAuthToken, getCurrentUser, getRole, removeToken } from "@/helper/helper";
import { useSiteSettings } from "@/components/ThemeProvider";
import { LanguageSwitcher, useLanguage } from "@/i18n/LanguageProvider";

/** Distance scrolled before the bar leaves its "over the hero" state. */
const CONDENSE_AT = 28;

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

// Anyone who is not a plain gym member works here. This is the quick answer
// from what sign-in stored; the panel's own test is asked of the server below.
const worksHere = (role: string | null) => !!role && role !== "user";

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  // "Would the admin panel let this account in" -- every staff role, not only
  // the one called admin. Checking role === "admin" left a receptionist or a
  // trainer with no way back to the panel from the public site.
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  // The server's answer to that question, and the session it was given for.
  const panelAnswer = useRef<{ token: string | null; admits: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  // Logo and business name come from admin settings, not a hardcoded asset.
  const { logoUrl, logoWidth, logoHeight, siteName } = useSiteSettings();
  const { t } = useLanguage();
  // Empty until the gym's settings have loaded. The logo's words must not
  // read " logo" in the meantime, so they fall back to where the link goes.
  const brandName = (siteName || "").trim();

  // Routes whose first element is a full-bleed photographic banner. On these
  // the bar carries no surface at all, so the artwork reaches the top edge of
  // the screen; everywhere else it keeps its glass panel.
  const HERO_ROUTES = ["/", "/about-us", "/packages", "/classes", "/trainers"];
  const overHero = HERO_ROUTES.includes(pathname);

  const toggleMobileMenu = () => setIsMobileMenuOpen((s) => !s);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  const handleLogout = () => {
    try {
      removeToken();
      panelAnswer.current = null;
      setIsLoggedIn(false);
      setIsAdmin(false);
    } finally {
      closeMobileMenu();
      router.replace("/");
      // Ensure components re-render to reflect auth change
      router.refresh();
    }
  };

  // Who is signed in, from what the browser holds. The server's answer about
  // the panel wins while it is for this same session; until it arrives the
  // stored role decides.
  const readAuth = useCallback(() => {
    const signedIn = !!getCurrentUser();
    const known = panelAnswer.current && panelAnswer.current.token === getAuthToken() ? panelAnswer.current.admits : null;
    setIsLoggedIn(signedIn);
    setIsAdmin(signedIn && (known ?? worksHere(getRole())));
  }, []);

  // Initialize auth state after mount to prevent hydration issues
  useEffect(() => {
    setMounted(true);
    readAuth();
  }, [readAuth]);

  // Keep auth state in sync across tabs and navigations
  useEffect(() => {
    if (!mounted) return;

    window.addEventListener("focus", readAuth);
    window.addEventListener("storage", readAuth);
    return () => {
      window.removeEventListener("focus", readAuth);
      window.removeEventListener("storage", readAuth);
    };
  }, [mounted, readAuth]);

  // The panel admits whoever holds at least one of its tabs (admin/layout.tsx),
  // and only the server knows that -- a role can exist and hold none. So for
  // anyone who is not a plain member, ask what the panel itself asks. A plain
  // fetch on purpose: a failure here must never sign a visitor out of the
  // public site, it just leaves the stored role's answer standing.
  useEffect(() => {
    if (!mounted || !isLoggedIn || !worksHere(getRole())) return;
    const token = getAuthToken();
    if (panelAnswer.current?.token === token) return;
    let cancelled = false;
    fetch(`${API_BASE}/roles/me`, { headers: getAuthHeader() })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json || !Array.isArray(json.tabs)) return;
        panelAnswer.current = { token, admits: json.tabs.length > 0 };
        readAuth();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mounted, isLoggedIn, readAuth]);

  // Condense the bar once the page moves, and drive the reading-progress rule.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > CONDENSE_AT);
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, y / scrollable) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The drawer is a full-height overlay, so the page behind it must not scroll,
  // and Escape has to get the user back out.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isMobileMenuOpen, closeMobileMenu]);

  // A route change while the drawer is open should dismiss it.
  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  // Only routes that exist
  const routes = {
    home: "/",
    about: "/about-us",
    packages: "/packages",
    classes: "/classes",
    timetable: "/timetable",
    trainers: "/trainers",
    contact: "/contact-us",
    blogs: "/blogs",
    userDetails: "/user-detail",
    admin: "/admin",
    auth: "/authentication",
  };

  // Staff land on the dashboard rather than the member profile page. Their
  // own account (profile, security, "My work") stays one tap away beside it.
  const accountHref = isAdmin ? routes.admin : routes.userDetails;
  const accountLabel = isAdmin ? t("nav.admin") : t("nav.account");

  // Create navigation items from featured categories and static pages
  const navItems = [
    { key: "about", label: t("nav.about"), href: routes.about },
    { key: "packages", label: t("nav.packages"), href: routes.packages },
    { key: "classes", label: t("nav.classes"), href: routes.classes },
    { key: "timetable", label: t("nav.timetable"), href: routes.timetable },
    { key: "trainers", label: t("nav.trainers"), href: routes.trainers },
    { key: "contact", label: t("nav.contact"), href: routes.contact },
    { key: "blogs", label: t("nav.blog"), href: routes.blogs },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  /* Desktop actions. Exactly one accent button is allowed here — two solid
     brand pills side by side read as an error rather than as emphasis — so the
     secondary action always takes the ghost treatment. */
  const desktopActions = () => {
    if (!mounted) {
      // Render the logged-out shape during SSR/hydration to avoid a mismatch.
      return (
        <Link href={routes.auth} className="nav-btn nav-btn--primary" aria-label="Sign in or join">
          <span>Join Now</span>
          <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      );
    }

    if (isLoggedIn) {
      return (
        <>
          <Link
            href={accountHref}
            className="nav-btn nav-btn--ghost"
            aria-label={isAdmin ? "Open admin panel" : "View your account"}
          >
            {isAdmin ? (
              <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <UserRound size={16} strokeWidth={2} aria-hidden="true" />
            )}
            <span>{accountLabel}</span>
          </Link>
          {isAdmin && (
            <Link href={routes.userDetails} className="nav-icon-btn" aria-label={t("nav.account")} title={t("nav.account")}>
              <UserRound size={17} strokeWidth={2} aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            className="nav-icon-btn"
            aria-label="Log out"
            title="Log out"
            onClick={handleLogout}
          >
            <LogOut size={17} strokeWidth={2} aria-hidden="true" />
          </button>
        </>
      );
    }

    return (
      <>
        <Link href={routes.auth} className="nav-btn nav-btn--ghost" aria-label="Sign in">
          <span>Sign In</span>
        </Link>
        <Link href={routes.auth} className="nav-btn nav-btn--primary" aria-label="Join now">
          <span>Join Now</span>
          <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </>
    );
  };

  return (
    <header
      className={[
        "site-header",
        scrolled ? "is-scrolled" : "",
        overHero && !scrolled ? "is-over-hero" : "",
        isMobileMenuOpen ? "is-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="site-header__bar">
        {/* Brand */}
        <Link
          href={routes.home}
          className="site-brand"
          onClick={closeMobileMenu}
          aria-label={brandName ? `${brandName} — go to homepage` : "Go to homepage"}
        >
          <Image
            src={logoUrl}
            alt={brandName ? `${brandName} logo` : "Home"}
            width={logoWidth}
            height={logoHeight}
            // height:auto keeps the aspect ratio when CSS constrains the width,
            // which is what next/image warns about otherwise.
            style={{ height: "auto", width: "auto" }}
            priority
            unoptimized={/^https?:\/\//i.test(logoUrl)}
          />
        </Link>

        {/* Desktop navigation */}
        <nav className="site-nav" aria-label="Primary">
          <ul className="site-nav__list">
            {navItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`site-nav__link ${isActive(item.href) ? "is-active" : ""}`}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Actions */}
        <div className="site-header__actions">
          <div className="site-header__actions-desktop">
            <LanguageSwitcher className="mr-2 hidden lg:inline-block" />
            {desktopActions()}
          </div>

          <button
            type="button"
            className="nav-toggle"
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="site-drawer"
          >
            {isMobileMenuOpen ? (
              <X size={20} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <Menu size={20} strokeWidth={2.2} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Reading progress — a hairline, not a chrome element. */}
        <span
          className="site-header__progress"
          style={{ transform: `scaleX(${progress})` }}
          aria-hidden="true"
        />
      </div>

      {/* Mobile drawer */}
      <div className="site-drawer__scrim" onClick={closeMobileMenu} aria-hidden="true" />
      <div
        id="site-drawer"
        className="site-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isMobileMenuOpen}
      >
        <nav className="site-drawer__nav" aria-label="Mobile">
          <ul>
            {navItems.map((item, idx) => (
              <li key={item.key} style={{ "--i": idx } as React.CSSProperties}>
                <Link
                  href={item.href}
                  className={`site-drawer__link ${isActive(item.href) ? "is-active" : ""}`}
                  onClick={closeMobileMenu}
                >
                  <span className="site-drawer__index">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="site-drawer__label">{item.label}</span>
                  <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-drawer__footer">
          {/* The bar's own switcher is hidden below desktop width, and this
              drawer is the whole menu on a phone: without it here a phone
              visitor could not change language at all. 16px text, or iOS
              zooms the page when the list is opened. */}
          <label className="mb-1 flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
            {t("nav.language")}
            <LanguageSwitcher className="h-11 w-full !text-base font-medium normal-case tracking-normal text-white [&>option]:text-neutral-900" />
          </label>
          {!mounted ? (
            <Link
              href={routes.auth}
              className="nav-btn nav-btn--primary nav-btn--block"
              onClick={closeMobileMenu}
            >
              <span>Join Now</span>
              <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          ) : isLoggedIn ? (
            <>
              <Link
                href={accountHref}
                className="nav-btn nav-btn--primary nav-btn--block"
                onClick={closeMobileMenu}
              >
                <span>{accountLabel}</span>
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
              {isAdmin && (
                <Link
                  href={routes.userDetails}
                  className="nav-btn nav-btn--ghost nav-btn--block"
                  onClick={closeMobileMenu}
                >
                  <UserRound size={16} strokeWidth={2} aria-hidden="true" />
                  <span>{t("nav.account")}</span>
                </Link>
              )}
              <button
                type="button"
                className="nav-btn nav-btn--ghost nav-btn--block"
                onClick={handleLogout}
              >
                <LogOut size={16} strokeWidth={2} aria-hidden="true" />
                <span>Log Out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href={routes.auth}
                className="nav-btn nav-btn--primary nav-btn--block"
                onClick={closeMobileMenu}
              >
                <span>Join Now</span>
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
              <Link
                href={routes.auth}
                className="nav-btn nav-btn--ghost nav-btn--block"
                onClick={closeMobileMenu}
              >
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
