"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSiteSettings } from "@/components/ThemeProvider";
import { heroService } from "../../main/services/heroService";

// Uploaded slide images live on the API host.
const resolveImage = (imageUrl: string): string =>
  imageUrl.startsWith("/uploads") ? `${process.env.NEXT_PUBLIC_BACKEND_URL ?? ""}${imageUrl}` : imageUrl;

/**
 * The banner of the About page, and of the classes and trainers pages. It
 * says only what is true of any gym: the gym's own name and the page's title.
 * The backdrop is the gym's own first banner photo when it has one, and the
 * plain dark plate when it has not.
 */
const HeroAbout: React.FC<{ title?: string }> = ({ title = "About us" }) => {
  const { siteName } = useSiteSettings();
  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    let cancelled = false;
    heroService
      .getActiveSlides()
      .then((slides) => {
        const first = [...slides].sort((a, b) => a.order - b.order).find((s) => s.imageUrl);
        if (!cancelled && first) setBgImage(resolveImage(first.imageUrl));
      })
      .catch(() => {
        /* no photo: the plain plate is the banner */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="hero" className="hero hero--compact" aria-label={`${title} banner`}>
      <div className="hero__stage">
        <div className="hero__slide is-active">
          {bgImage && <div className="hero__media" style={{ backgroundImage: `url('${bgImage}')` }} aria-hidden="true" />}
        </div>
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__vignette" aria-hidden="true" />
      </div>

      <div className="hero__inner">
        <div className="hero__content">
          {siteName && (
            <span className="hero__eyebrow">
              <span className="hero__eyebrow-dot" aria-hidden="true" />
              {siteName}
            </span>
          )}
          <h1 className="hero__title">{title}</h1>
          <div className="hero__actions">
            <Link href="/contact-us" className="btn btn--primary btn--lg">
              <span>Contact Us</span>
              <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
            </Link>
            <Link href="/packages" className="btn btn--glass btn--lg">
              <span>See Memberships</span>
              <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroAbout;
