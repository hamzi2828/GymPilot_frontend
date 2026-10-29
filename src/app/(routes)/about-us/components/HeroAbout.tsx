"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSiteSettings } from "@/components/ThemeProvider";
import { heroService } from "../../main/services/heroService";
import { resolveMediaUrl } from "../../main/services/homeService";
import PageHero, { type Crumb } from "@/components/site/PageHero";

/**
 * The banner of the About page, and of the classes and trainers pages. It
 * says only what is true of any gym: the gym's own name and the page's title.
 * The backdrop is the gym's own first banner photo when it has one, and the
 * plain dark plate when it has not.
 */
const HeroAbout: React.FC<{ title?: string; lead?: string; parent?: Crumb; image?: string }> = ({ title = "About us", lead, parent, image }) => {
  const { siteName } = useSiteSettings();
  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    let cancelled = false;
    heroService
      .getActiveSlides()
      .then((slides) => {
        const first = [...slides]
          .sort((a, b) => a.order - b.order)
          .map((s) => resolveMediaUrl(s.imageUrl))
          .find(Boolean);
        if (!cancelled && first) setBgImage(first);
      })
      .catch(() => {
        /* no photo: the plain plate is the banner */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageHero
      title={title}
      eyebrow={siteName || undefined}
      image={image || bgImage || undefined}
      lead={lead}
      crumbs={[{ label: "Home", href: "/" }, ...(parent ? [parent] : []), { label: title }]}
      tall
      actions={
        <>
          <Link href="/contact-us" className="btn btn--primary btn--lg">
            <span>Contact Us</span>
            <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
          </Link>
          <Link href="/packages" className="btn btn--glass btn--lg">
            <span>See Memberships</span>
            <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </>
      }
    />
  );
};

export default HeroAbout;
