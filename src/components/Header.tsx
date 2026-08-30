"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, LogOut, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import { getCurrentUser, getRole, removeToken } from "@/helper/helper";
import { useSiteSettings } from "@/components/ThemeProvider";

/** Distance scrolled before the bar leaves its "over the hero" state. */
const CONDENSE_AT = 28;

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  // Logo and business name come from admin settings, not a hardcoded asset.
  const { logoUrl, logoWidth, logoHeight, siteName } = useSiteSettings();

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
      setIsLoggedIn(false);
      setIsAdmin(false);
    } finally {
      closeMobileMenu();
      router.replace("/");
      // Ensure components re-render to reflect auth change
      router.refresh();
    }
  };

  // Initialize auth state after mount to prevent hydration issues
  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!getCurrentUser());
    setIsAdmin(getRole() === "admin");
  }, []);

  // Keep auth state in sync across tabs and navigations
  useEffect(() => {
    if (!mounted) return;

    const update = () => {
      setIsLoggedIn(!!getCurrentUser());
      setIsAdmin(getRole() === "admin");
    };
    window.addEventListener("focus", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("storage", update);
    };
  }, [mounted]);

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

  // Admins land on the dashboard rather than the member profile page.
  const accountHref = isAdmin ? routes.admin : routes.userDetails;
  const accountLabel = isAdmin ? "Admin Panel" : "My Account";

  // Create navigation items from featured categories and static pages
  const navItems = [
    { key: "about", label: "About", href: routes.about },
    { key: "packages", label: "Packages", href: routes.packages },
    { key: "classes", label: "Classes", href: routes.classes },
    { key: "timetable", label: "Timetable", href: routes.timetable },
    { key: "trainers", label: "Trainers", href: routes.trainers },
    { key: "contact", label: "Contact", href: routes.contact },
    { key: "blogs", label: "Blog", href: routes.blogs },
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
          aria-label={`${siteName} — go to homepage`}
        >
          <Image
            src={logoUrl}
            alt={`${siteName} logo`}
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
          <div className="site-header__actions-desktop">{desktopActions()}</div>

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
