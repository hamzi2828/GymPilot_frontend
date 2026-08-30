// Homepage sections service.
//
// Everything below the hero banner is driven by the `/home-sections` API:
// the admin panel controls each section's order, visibility and content.
// The DEFAULTS here mirror the backend seed so the homepage still renders
// (with the shipped copy) when the API is unreachable.

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
// Defaults — keep in sync with DEFAULT_SECTIONS in
// GymPilot_backend/src/models/homeSectionModel.js
// ---------------------------------------------------------------------------

export const DEFAULT_ABOUT: AboutContent = {
  badge: "About Us",
  heading: "The best fitness gym in town",
  description:
    "A full strength and conditioning floor, a dedicated studio for group classes, and coaches who actually watch your form. Whether you are lifting for the first time or chasing a personal best, you get a plan built around your goal, not a generic programme handed to everyone who walks in.",
  bullets: [
    "Open 7 days, with 24/7 access for members",
    "Certified coaches on the floor at all times",
    "Programmes tracked and reviewed every month",
  ],
  ctaText: "Let's Start",
  ctaLink: "/packages",
  image: "/images/gym-large.webp",
  secondHeading: "Strength that shows",
  secondDescription:
    "Strength work is the fastest route to a body that performs as well as it looks. Our coaches build progressive lifting blocks around squat, hinge, push and pull, then track your numbers week to week so the progress is something you can see rather than something you hope for.",
  progress: [
    { label: "Strength & Conditioning", value: 85 },
    { label: "Muscle Tone", value: 90 },
  ],
};

export const DEFAULT_STATS: StatsContent = {
  items: [
    { value: "1200", suffix: "+", label: "Active members" },
    { value: "15", suffix: "+", label: "Certified coaches" },
    { value: "40", suffix: "+", label: "Classes every week" },
    { value: "10", suffix: "yrs", label: "Coaching experience" },
  ],
};

export const DEFAULT_CLASSES: SectionHeaderContent = {
  badge: "Classes",
  heading: "What we do in our classes",
  description:
    "Classes run from sunrise to late evening and are capped so nobody trains unwatched. Strength, conditioning, mobility and recovery sessions, each with a scaled option so beginners and regulars can share the same floor.",
};

export const DEFAULT_GALLERY: GalleryContent = {
  badge: "Gallery",
  heading: "Believe in yourself be *fit* & *healthier*",
  groups: [
    {
      title: "Strength",
      images: [
        {
          src: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          alt: "Strength workout session",
        },
        {
          src: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          alt: "Gym equipment and weights",
        },
        {
          src: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          alt: "Personal training session",
        },
        {
          src: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          alt: "Barbell training",
        },
      ],
    },
    {
      title: "Cardio",
      images: [
        {
          src: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          alt: "Cardio workout equipment",
        },
        {
          src: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          alt: "Conditioning session",
        },
      ],
    },
  ],
};

export const DEFAULT_VIDEOS: VideosContent = {
  badge: "Videos",
  heading: "See the floor in *action*",
  description:
    "Walk the gym before you ever set foot in it — classes mid-session, coaching on the floor and the community that keeps people coming back.",
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
      .filter((img) => img.src)
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
    groups = legacy.length ? [{ title: "Gallery", images: legacy }] : DEFAULT_GALLERY.groups;
  }

  return { badge, heading, groups };
}

export const DEFAULT_TRAINERS: TrainersContent = {
  badge: "Our Trainers",
  heading: "Coaches who train you like an athlete",
  description:
    "Every coach on the floor is certified, insured and has come up through the same programmes they now teach. Book an intro session and you will be paired with the one whose speciality matches what you are training for.",
  limit: 4,
};

export const DEFAULT_TESTIMONIALS_HEADER: SectionHeaderContent = {
  badge: "Testimonials",
  heading: "What our members say",
  description:
    "Real progress, told by the people who made it. Every review below comes from a member training on this floor right now.",
};

export const DEFAULT_CONTACT: ContactContent = {
  badge: "Contact Form",
  heading: "Believe in yourself be *fit* & *healthier*",
  description:
    "Tell us what you are training for and we will point you at the right membership, class or coach. No hard sell, and no obligation to sign up on the spot.",
  formTitle: "Registration Form",
  buttonText: "Contact Us",
};

export const DEFAULT_BLOGS: BlogsContent = {
  badge: "Fitness Tips",
  heading: "Stay Fit Stay Strong",
};

/** Rendered when the API has no sections (offline / first run). */
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

/**
 * Shown when no testimonials have been added yet, so the section demonstrates
 * itself instead of rendering empty. Replaced by real reviews the moment the
 * admin adds one.
 */
export const FALLBACK_TESTIMONIALS: Testimonial[] = [
  {
    _id: "fallback-t1",
    name: "Sarah M.",
    role: "Member for 2 years",
    quote:
      "I walked in never having touched a barbell. Two years later I deadlift double my bodyweight and actually look forward to 6am sessions. The coaches never let you drift.",
    rating: 5,
    imageUrl: "",
    isActive: true,
    order: 1,
  },
  {
    _id: "fallback-t2",
    name: "James K.",
    role: "Competitive athlete",
    quote:
      "The programming here is the real thing — periodised, tracked and adjusted every block. My sprint times dropped within one season of moving my strength work here.",
    rating: 5,
    imageUrl: "",
    isActive: true,
    order: 2,
  },
  {
    _id: "fallback-t3",
    name: "Priya R.",
    role: "Lost 18kg with us",
    quote:
      "No judgement, no gimmicks. A coach sat down with me, built a plan I could keep, and checked in every month. It is the first gym that ever felt like mine.",
    rating: 5,
    imageUrl: "",
    isActive: true,
    order: 3,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Uploaded assets live on the backend host; bundled /images stay on Next. */
export function resolveMediaUrl(url?: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/uploads")) return `${API_BASE_URL}${url}`;
  return url;
}

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Fills any missing/empty fields in the stored content from the defaults, so
 * a half-edited section never renders with blank headings or empty lists.
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
