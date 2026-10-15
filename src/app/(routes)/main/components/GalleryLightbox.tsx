"use client";

// A photo from the gallery, big, over the whole page: arrows (and the arrow
// keys, and a swipe on a phone) slide through every photo in the category,
// thumbnails jump straight to one, and Esc, the close button or a click on the
// dark backdrop shut it. Rendered into <body> so no section's layout or
// animation can clip or shift it.

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LightboxPhoto = { src: string; alt: string };

// Stock photos are stored at thumbnail size (w=400); ask the image host for a
// big one here. A gym's own uploads are already full size.
function large(src: string): string {
  try {
    const url = new URL(src);
    if (url.hostname === "images.unsplash.com") {
      url.searchParams.set("w", "1800");
      url.searchParams.set("q", "85");
      return url.toString();
    }
  } catch {
    /* a relative path: leave it */
  }
  return src;
}

export default function GalleryLightbox({ photos, index, onIndex, onClose }: { photos: LightboxPhoto[]; index: number; onIndex: (next: number) => void; onClose: () => void }) {
  const count = photos.length;
  const prev = useCallback(() => onIndex((index - 1 + count) % count), [index, count, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % count), [index, count, onIndex]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const thumbs = useRef<HTMLDivElement>(null);

  // Keys, the page behind held still, and focus on the close button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, prev, next]);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  // Keep the current thumbnail in view.
  useEffect(() => {
    thumbs.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  const photo = photos[index];
  if (!photo) return null;

  return createPortal(
    <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Photo ${index + 1} of ${count}`} onClick={onClose}>
      <div className="gallery-lightbox__bar" onClick={(e) => e.stopPropagation()}>
        <span className="gallery-lightbox__count">
          {index + 1} / {count}
        </span>
        <button ref={closeButton} type="button" className="gallery-lightbox__btn" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </div>

      <div
        className="gallery-lightbox__stage"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) (dx > 0 ? prev : next)();
        }}
      >
        {count > 1 && (
          <button type="button" className="gallery-lightbox__btn gallery-lightbox__nav gallery-lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous photo">
            <ChevronLeft size={28} />
          </button>
        )}
        {/* The small photo, already loaded on the page, sits behind while the
            big one arrives, so the viewer is never empty. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- any host a gym pastes, shown at full size */}
        <img key={photo.src} src={large(photo.src)} alt={photo.alt} className="gallery-lightbox__img" style={{ backgroundImage: `url("${photo.src}")` }} onClick={(e) => e.stopPropagation()} />
        {count > 1 && (
          <button type="button" className="gallery-lightbox__btn gallery-lightbox__nav gallery-lightbox__nav--next" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next photo">
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {count > 1 && (
        <div ref={thumbs} className="gallery-lightbox__thumbs" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <button key={`${p.src}-${i}`} type="button" data-i={i} className={`gallery-lightbox__thumb ${i === index ? "is-active" : ""}`} onClick={() => onIndex(i)} aria-label={`Show photo ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
