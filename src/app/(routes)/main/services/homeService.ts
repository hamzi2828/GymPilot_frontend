// Homepage sections service.
//
// Everything below the hero banner is driven by the `/home-sections` API:
// the admin panel controls each section's order, visibility and content.
// The DEFAULTS here are neutral labels only, so the homepage still renders
// its live sections (classes, trainers, the enquiry form) when the API is
// unreachable, without saying anything the gym has not said.

import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export type SectionKey =
  | "about"
  | "stats"
  | "classes"
  | "gallery"
  | "videos"
  | "trainers"
  | "testimonials"
  | "contact"
  | "blogs";

// ---------------------------------------------------------------------------
// Per-section content shapes (what the admin panel edits)
// ---------------------------------------------------------------------------

export interface AboutContent {
  badge: string;
  heading: string;
  description: string;
  bullets: string[];
  ctaText: string;
  ctaLink: string;
  image: string;
  secondHeading: string;
  secondDescription: string;
  progress: { label: string; value: number }[];
}

export interface StatsContent {
  items: { value: string; suffix: string; label: string }[];
}

export interface SectionHeaderContent {
  badge: string;
  heading: string;
  description: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
}

/** A named sub-section of the gallery (e.g. Strength, Cardio). Max 12 photos. */
export interface GalleryGroup {
  title: string;
  images: GalleryImage[];
}

export interface GalleryContent {
  badge: string;
  heading: string;
  groups: GalleryGroup[];
}

/** Photos per gallery group the admin may store. */
export const GALLERY_MAX_PHOTOS = 12;
/** Photos shown per page on the site: 4 per row × 2 rows, then a slider. */
export const GALLERY_PAGE_SIZE = 8;

export interface VideoItem {
  title: string;
  url: string;
  poster: string;
}

export interface VideosContent {
  badge: string;
  heading: string;
  description: string;
  videos: VideoItem[];
}

export interface TrainersContent extends SectionHeaderContent {
  limit: number;
}

export interface ContactContent extends SectionHeaderContent {
  formTitle: string;
  buttonText: string;
}

export interface BlogsContent {
  badge: string;
  heading: string;
}

export interface HomeSection {
  key: SectionKey;
  enabled: boolean;
  order: number;
  content: Record<string, unknown>;
}

export interface Testimonial {
  _id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  imageUrl: string;
  isActive: boolean;
  order: number;
}

// ---------------------------------------------------------------------------
// Defaults
//
// A gym's site may only say what the gym has said. So these hold section
// labels and nothing else: no description, no figures, no photos. Whatever
// has no content of the gym's own is left out by the section that renders it.
// ---------------------------------------------------------------------------

export const DEFAULT_ABOUT: AboutContent = {
  badge: "About Us",
  // Empty: the section falls back to "About <the gym's name>".
  heading: "",
  description: "",
  bullets: [],
  ctaText: "",
  ctaLink: "/packages",
  image: "",
  secondHeading: "",
  secondDescription: "",
  progress: [],
};

export const DEFAULT_STATS: StatsContent = {
  items: [],
};

export const DEFAULT_CLASSES: SectionHeaderContent = {
  badge: "Classes",
  heading: "Our classes",
  description: "",
};

export const DEFAULT_GALLERY: GalleryContent = {
  badge: "Gallery",
  heading: "Gallery",
  groups: [],
};

export const DEFAULT_VIDEOS: VideosContent = {
  badge: "Videos",
  heading: "Videos",
  description: "",
  videos: [],
};

/**
 * Accepts stored gallery content in either shape: the current `groups` form,
 * or the original flat `images` list (older documents / cached responses),
 * which is wrapped into a single unnamed group. Photos are capped per group.
 */
export function normalizeGalleryContent(raw: Record<string, unknown> | GalleryContent | undefined): GalleryContent {
  const content = (raw ?? {}) as Record<string, unknown>;
  const badge = typeof content.badge === "string" && content.badge ? content.badge : DEFAULT_GALLERY.badge;
  const heading = typeof content.heading === "string" && content.heading ? content.heading : DEFAULT_GALLERY.heading;

  const cleanImages = (list: unknown): GalleryImage[] =>
    (Array.isArray(list) ? list : [])
      .filter((img): img is Record<string, unknown> => !!img && typeof img === "object")
      .map((img) => ({
        src: typeof img.src === "string" ? img.src : "",
        alt: typeof img.alt === "string" ? img.alt : "",
      }))
      // Only photos that resolve to the gym's own media (see resolveMediaUrl).
      .filter((img) => resolveMediaUrl(img.src))
      .slice(0, GALLERY_MAX_PHOTOS);

  let groups: GalleryGroup[] = (Array.isArray(content.groups) ? content.groups : [])
    .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
    .map((g) => ({
      title: typeof g.title === "string" ? g.title : "",
      images: cleanImages(g.images),
    }))
    .filter((g) => g.images.length > 0);

  if (groups.length === 0) {
    const legacy = cleanImages(content.images);
    // No photos of the gym's own: the gallery renders nothing.
    groups = legacy.length ? [{ title: "Gallery", images: legacy }] : [];
  }

  return { badge, heading, groups };
}

export const DEFAULT_TRAINERS: TrainersContent = {
  badge: "Our Trainers",
  heading: "Meet the team",
  description: "",
  limit: 4,
};

export const DEFAULT_TESTIMONIALS_HEADER: SectionHeaderContent = {
  badge: "Testimonials",
  heading: "What our members say",
  description: "",
};

export const DEFAULT_CONTACT: ContactContent = {
  badge: "Contact",
  heading: "Get in touch",
  description: "Leave your details and we will get back to you.",
  formTitle: "Send us a message",
  buttonText: "Contact Us",
};

export const DEFAULT_BLOGS: BlogsContent = {
  badge: "Blog",
  heading: "Latest articles",
};

/**
 * Rendered when the API has no sections (offline / first run). About, stats
 * and gallery have nothing to show without the gym's own content, so in
 * practice this is the classes, trainers, reviews, enquiry form and articles.
 */
export const DEFAULT_SECTIONS: HomeSection[] = [
  { key: "about", enabled: true, order: 1, content: DEFAULT_ABOUT as unknown as Record<string, unknown> },
  { key: "stats", enabled: true, order: 2, content: DEFAULT_STATS as unknown as Record<string, unknown> },
  { key: "classes", enabled: true, order: 3, content: DEFAULT_CLASSES as unknown as Record<string, unknown> },
  { key: "gallery", enabled: true, order: 4, content: DEFAULT_GALLERY as unknown as Record<string, unknown> },
  // Ships hidden until the admin adds video clips.
  { key: "videos", enabled: false, order: 5, content: DEFAULT_VIDEOS as unknown as Record<string, unknown> },
  { key: "trainers", enabled: true, order: 6, content: DEFAULT_TRAINERS as unknown as Record<string, unknown> },
  { key: "testimonials", enabled: true, order: 7, content: DEFAULT_TESTIMONIALS_HEADER as unknown as Record<string, unknown> },
  { key: "contact", enabled: true, order: 8, content: DEFAULT_CONTACT as unknown as Record<string, unknown> },
  { key: "blogs", enabled: true, order: 9, content: DEFAULT_BLOGS as unknown as Record<string, unknown> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Where a stored media path is served from. Only the gym's own media
 * resolves: an upload on the API host, or a full URL. Any other path points
 * into this app's bundled pictures, which is where the first seed put its
 * stock photo; a gym never chose it, so it resolves to nothing and the caller
 * leaves the image out.
 */
export function resolveMediaUrl(url?: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/uploads")) return `${API_BASE_URL}${url}`;
  return "";
}

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Fills any missing/empty fields in the stored content from the defaults, so
 * a half-edited section never renders with a blank heading. Lists and body
 * copy have no default: left empty, that part of the section is not shown.
 */
export function mergeContent<T extends object>(defaults: T, incoming?: Record<string, unknown>): T {
  if (!incoming) return defaults;
  const out = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    const candidate = incoming[key];
    if (!isEmptyValue(candidate)) out[key] = candidate;
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const homeService = {
  /** Enabled homepage sections, in display order. */
  async getSections(): Promise<HomeSection[]> {
    const res = await axios.get<ApiResponse<HomeSection[]>>(`${API_BASE_URL}/home-sections/public`);
    if (!res.data.success) throw new Error(res.data.message || "Failed to fetch home sections");
    return res.data.data;
  },

  /** Active testimonials, in display order. */
  async getTestimonials(): Promise<Testimonial[]> {
    const res = await axios.get<ApiResponse<Testimonial[]>>(`${API_BASE_URL}/testimonials/active`);
    if (!res.data.success) throw new Error(res.data.message || "Failed to fetch testimonials");
    return res.data.data;
  },
};

export default homeService;
