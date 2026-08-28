"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {  FaArrowRight, FaBars, FaTimes } from "react-icons/fa";
import "@fortawesome/fontawesome-free/css/all.css";
import { getCurrentUser, removeToken } from "@/helper/helper";

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const toggleMobileMenu = () => setIsMobileMenuOpen((s) => !s);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);



  const handleLogout = () => {
    try {
      removeToken();
      setIsLoggedIn(false);
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
  }, []);




  // Keep auth state in sync across tabs and navigations
  useEffect(() => {
    if (!mounted) return;
    
    const update = () => setIsLoggedIn(!!getCurrentUser());
    window.addEventListener("focus", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("storage", update);
    };
  }, [mounted]);



  // Only routes that exist
  const routes = {
    home: "/",
    about: "/about-us",
    packages: "/packages",
    classes: "/classes",
    trainers: "/trainers",
    contact: "/contact-us",
    blogs: "/blogs",
    userDetails: "/user-detail",
    auth: "/authentication",
  };

  // Create navigation items from featured categories and static pages
  const navItems = [
    { key: "about", label: "About", href: routes.about },
    { key: "packages", label: "Packages", href: routes.packages },
    { key: "classes", label: "Classes", href: routes.classes },
    { key: "trainers", label: "Trainers", href: routes.trainers },
    { key: "contact", label: "Contact", href: routes.contact },
    { key: "blogs", label: "Blog", href: routes.blogs },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="fixed w-full top-0 z-50">
      <nav className="nav-bar">
        {/* Brand Logo */}
        <div className="flex-shrink-0">
          <Link
            href={routes.home}
            className="logo no-underline hover:opacity-80 transition-opacity duration-300"
            onClick={closeMobileMenu}
            aria-label="Go to homepage"
          >
            <Image src="/images/logo.png" alt="Logo" width={100} height={100} style={{ verticalAlign: "middle" }} />
          </Link>
        </div>

        {/* Desktop Menu */}
        <ul className="menu" role="menubar">
          {navItems.map((item) => (
            <li key={item.key} className="nav-item" role="none">
              <Link
                href={item.href}
                className={`nav-link ${isActive(item.href) ? "active" : ""}`}
                role="menuitem"
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={closeMobileMenu}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right Section */}
        <div className="right-section">


          {!mounted ? (
            // Show default state during SSR/hydration to prevent mismatch
            <Link
              href={routes.auth}
              className="cta-button for-mobile hidden md:flex"
              aria-label="Sign In or Sign Up"
              onClick={closeMobileMenu}
            >
              <span className="cta-text">Sign In / Sign Up</span>
              <FaArrowRight size={15} aria-hidden="true" className="text-black" />
            </Link>
          ) : isLoggedIn ? (
            <>
              <Link
                href={routes.userDetails}
                className="cta-button for-mobile hidden md:flex"
                aria-label="View your account"
                onClick={closeMobileMenu}
              >
                <span className="cta-text">My Account</span>
                <FaArrowRight size={15} aria-hidden="true" className="text-black" />
              </Link>
              <button
                type="button"
                className="cta-button for-mobile hidden md:flex ml-2"
                aria-label="Logout"
                onClick={handleLogout}
              >
                <span className="cta-text">Logout</span>
                <i className="fas fa-sign-out-alt ml-2" aria-hidden="true" />
              </button>
            </>
          ) : (
            <Link
              href={routes.auth}
              className="cta-button for-mobile hidden md:flex"
              aria-label="Sign In or Sign Up"
              onClick={closeMobileMenu}
            >
              <span className="cta-text">Sign In / Sign Up</span>
              <FaArrowRight size={15} aria-hidden="true" className="text-black" />
            </Link>
          )}

          <button
            className="mobile-menu-button lg:hidden"
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`mobile-menu ${isMobileMenuOpen ? "active" : ""}`} role="menu">
          <ul className="flex flex-col">
            {navItems.map((item) => (
              <li key={item.key} className="mobile-nav-item" role="none">
                <Link
                  href={item.href}
                  className={`mobile-nav-link ${isActive(item.href) ? "active" : ""}`}
                  role="menuitem"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              </li>
            ))}

    
          </ul>

          <div className="mt-6 pt-6 border-t border-gray-700">
            {!mounted ? (
              // Show default state during SSR/hydration to prevent mismatch
              <Link
                href={routes.auth}
                className="cta-button w-full justify-center"
                aria-label="Sign In or Sign Up"
                onClick={closeMobileMenu}
              >
                <span className="cta-text">Sign In / Sign Up</span>
                <FaArrowRight size={15} aria-hidden="true" className="text-black" />
              </Link>
            ) : isLoggedIn ? (
              <>
                <Link
                  href={routes.userDetails}
                  className="cta-button w-full justify-center mb-3"
                  aria-label="View your account"
                  onClick={closeMobileMenu}
                >
                  <span className="cta-text">My Account</span>
                  <FaArrowRight size={15} aria-hidden="true" className="text-black" />
                </Link>
                <button
                  type="button"
                  className="cta-button w-full justify-center"
                  aria-label="Logout"
                  onClick={handleLogout}
                >
                  <span className="cta-text">Logout</span>
                  <i className="fas fa-sign-out-alt ml-2" aria-hidden="true" />
                </button>
              </>
            ) : (
              <Link
                href={routes.auth}
                className="cta-button w-full justify-center"
                aria-label="Sign In or Sign Up"
                onClick={closeMobileMenu}
              >
                <span className="cta-text">Sign In / Sign Up</span>
                <FaArrowRight size={15} aria-hidden="true" className="text-black" />
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;