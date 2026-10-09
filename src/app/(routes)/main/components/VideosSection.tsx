"use client";

import React, { useState } from "react";
import Image from "next/image";
import { DEFAULT_VIDEOS, VideosContent, resolveMediaUrl } from "../services/homeService";
import { SectionHeading, Reveal } from "./SectionHeading";

/** Returns an embeddable player URL for YouTube/Vimeo links, else null. */
function toEmbedUrl(url: string): string | null {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return null;
}

/**
 * Gym video clips managed from /admin/homepage. Accepts direct video files
 * (mp4/webm — played inline) and YouTube/Vimeo links (embedded players).
 * Renders nothing while the admin hasn't added any clips.
 */
const VideosSection = ({ content = DEFAULT_VIDEOS }: { content?: VideosContent }) => {
  const videos = (content.videos ?? []).filter((v) => v && typeof v.url === "string" && resolveMediaUrl(v.url.trim()));
  const [playing, setPlaying] = useState<number | null>(null);

  if (videos.length === 0) return null;

  return (
    <section className="section surface-dark home-dark-section relative overflow-hidden">
      <div className="home-testimonials-glow" aria-hidden="true"></div>

      <div className="mx-auto relative">
        <Reveal>
          <SectionHeading
            dark
            badge={content.badge}
            heading={content.heading}
            description={content.description}
            className="mb-12 lg:mb-16"
          />
        </Reveal>

        <div className={`grid grid-cols-1 gap-6 ${videos.length === 1 ? "max-w-3xl mx-auto" : "md:grid-cols-2"}`}>
          {videos.map((video, idx) => {
            const url = resolveMediaUrl(video.url);
            const poster = resolveMediaUrl(video.poster);
            const embed = toEmbedUrl(video.url);
            const isPlaying = playing === idx;

            return (
              <Reveal key={idx} delay={(idx % 2) * 90}>
                <figure className="home-video-card group">
                  <div className="home-video-frame">
                    {isPlaying ? (
                      embed ? (
                        <iframe
                          src={embed}
                          title={video.title || `Video ${idx + 1}`}
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 h-full w-full"
                        />
                      ) : (
                        <video
                          src={url}
                          poster={poster || undefined}
                          controls
                          autoPlay
                          // Muted so playback starts instantly — browsers block
                          // unmuted autoplay; viewers unmute via the controls.
                          muted
                          playsInline
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPlaying(idx)}
                        className="absolute inset-0 h-full w-full text-left"
                        aria-label={`Play ${video.title || "video"}`}
                      >
                        {poster ? (
                          <Image
                            src={poster}
                            alt={video.title || "Video poster"}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                            unoptimized={/^https?:\/\//i.test(poster)}
                          />
                        ) : (
                          <span className="home-video-placeholder" aria-hidden="true"></span>
                        )}
                        <span className="home-video-scrim" aria-hidden="true"></span>
                        <span className="home-video-play" aria-hidden="true">
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </button>
                    )}
                  </div>
                  {video.title && <figcaption className="home-video-title">{video.title}</figcaption>}
                </figure>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default VideosSection;
