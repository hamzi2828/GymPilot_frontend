"use client";

import React from "react";
import { useSiteSettings } from "@/components/ThemeProvider";
import Image from "next/image";
import Link from "next/link";

const Footer = () => {
  // Logo and business name come from admin settings rather than a hardcoded
  // asset, so rebranding needs no code change.
  const { logoUrl, footerLogoUrl, siteName } = useSiteSettings();
  const brandLogo = footerLogoUrl || logoUrl;

  return (
  <footer className="footer-main">
    <div className="footer-container">
      {/* Newsletter: heading on the left, sign-up on the right. */}
      <section className="footer-newsletter-section">
        <div className="footer-newsletter-text">
          <h2 className="footer-main-heading">JOIN THE FITNESS COMMUNITY</h2>
          <p className="footer-newsletter-subtext">
            Training tips, timetable changes and member offers. No spam, unsubscribe any time.
          </p>
        </div>

        <form className="footer-email-form" onSubmit={(e) => e.preventDefault()}>
          <div className="footer-input-wrapper">
            <input
              type="email"
              className="footer-email-input"
              placeholder="Enter your email"
              aria-label="Email address"
              required
            />
          </div>
          <button type="submit" className="footer-subscribe-button" aria-label="Subscribe to newsletter">
            <span className="footer-subscribe-text">Subscribe</span>
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
              <h4 className="footer-column-heading">Programs</h4>
              <nav className="footer-nav-links">
                <Link href="/packages" className="footer-nav-link">Packages</Link>
                <Link href="/classes" className="footer-nav-link">Our Classes</Link>
                <Link href="/classdetail" className="footer-nav-link">Class Details</Link>
              </nav>
            </div>

            {/* Support */}
            <div className="footer-links-column">
              <h4 className="footer-column-heading">Support</h4>
              <nav className="footer-nav-links">
                <Link href="/contact-us" className="footer-nav-link">Contact Us</Link>
                <Link href="/trainers" className="footer-nav-link">Trainer Details</Link>
                <Link href="/faqs" className="footer-nav-link">FAQs</Link>
              
              </nav>
            </div>

            {/* Company */}
            <div className="footer-links-column">
              <h4 className="footer-column-heading">Company</h4>
              <nav className="footer-nav-links">
                <Link href="/about-us" className="footer-nav-link">About Us</Link>
                <Link href="/privacy-policy" className="footer-nav-link">Privacy Policy</Link>
               
                <Link href="/contact-us" className="footer-nav-link">Get In Touch</Link>
              </nav>
            </div>

            {/* Social */}
            <div className="footer-links-column footer-social-column">
              <h4 className="footer-column-heading">Follow Us</h4>
              <nav className="footer-nav-links">
                <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="Instagram">
                  <i className="fab fa-instagram"></i>
                  <span>Instagram</span>
                </a>
                <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="Facebook">
                  <i className="fab fa-facebook"></i>
                  <span>Facebook</span>
                </a>
                <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="YouTube">
                  <i className="fab fa-youtube"></i>
                  <span>YouTube</span>
                </a>
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
                {" "}{siteName} — All rights reserved
              </span>
            </p>
            <nav className="footer-legal-links">
              <Link href="/privacy-policy" className="footer-legal-link">Privacy Policy</Link>
              
              <Link href="/contact-us" className="footer-legal-link">Contact Us</Link>
            </nav>
          </div>
        </div>
      </section>

    </div>
  </footer>
  );
};

export default Footer;