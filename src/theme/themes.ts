/**
 * Site colour schemes.
 *
 * Every brand-coloured surface in globals.css resolves through the CSS custom
 * properties below, so switching a theme recolours the entire site — header
 * through footer — without touching component code.
 *
 * The active preset key is stored in Settings.theme on the backend and applied
 * at runtime by ThemeProvider.
 */

export type ThemeTokens = {
  /** Primary brand colour: buttons, links, active states. */
  accent: string;
  /** Hover / pressed state for accent surfaces. */
  accentDark: string;
  /** Soft tint of the accent, for subtle highlights. */
  accentSoft: string;
  /** Text/icon colour that sits legibly on top of `accent`. */
  onAccent: string;
  /** Page background for dark sections. */
  base: string;
  /** Raised surfaces on the dark base (cards, panels). */
  surface: string;
  /** Light warm/cool panel that keeps dark text readable. */
  surfaceTint: string;
  /** Hairline dividers on dark surfaces. */
  borderSubtle: string;
  /** Muted body copy on dark surfaces. */
  textMuted: string;
};

export type Theme = {
  key: string;
  name: string;
  description: string;
  tokens: ThemeTokens;
};

export const THEMES: Theme[] = [
  {
    key: 'midnight-ember',
    name: 'Midnight Ember',
    description: 'Warm ember orange on a deep charcoal base. High energy, unmistakably gym.',
    tokens: {
      accent: '#ff6b2c',
      accentDark: '#c74e1b',
      accentSoft: '#ffb894',
      onAccent: '#0e0e10',
      base: '#0e0e10',
      surface: '#1a1a1e',
      surfaceTint: '#fff4ed',
      borderSubtle: '#2c2c32',
      textMuted: '#a0a0a8',
    },
  },
  {
    key: 'graphite-mono',
    name: 'Graphite Mono',
    description: 'Near-monochrome with a bright white accent. Restrained, premium, lets photography lead.',
    tokens: {
      accent: '#f5f5f7',
      accentDark: '#c9c9cf',
      accentSoft: '#4a4a52',
      onAccent: '#0b0b0d',
      base: '#0b0b0d',
      surface: '#17171a',
      surfaceTint: '#f4f4f6',
      borderSubtle: '#2a2a2f',
      textMuted: '#9a9aa2',
    },
  },
  {
    key: 'arctic-steel',
    name: 'Arctic Steel',
    description: 'Cool cyan on deep navy. Reads as performance tech rather than warehouse gym.',
    tokens: {
      accent: '#38bdf8',
      accentDark: '#0284c7',
      accentSoft: '#bae6fd',
      onAccent: '#04121f',
      base: '#0a0f1c',
      surface: '#141b2d',
      surfaceTint: '#eff8ff',
      borderSubtle: '#24304a',
      textMuted: '#94a3b8',
    },
  },
  {
    key: 'crimson-iron',
    name: 'Crimson Iron',
    description: 'Deep crimson on near-black. Bold and aggressive, the classic strength-brand look.',
    tokens: {
      accent: '#e11d48',
      accentDark: '#9f1239',
      accentSoft: '#fda4af',
      onAccent: '#ffffff',
      base: '#09090b',
      surface: '#18181b',
      surfaceTint: '#fff1f3',
      borderSubtle: '#27272a',
      textMuted: '#a1a1aa',
    },
  },
  {
    key: 'electric-lime',
    name: 'Electric Lime',
    description: 'The original acid lime on black. High contrast and loud.',
    tokens: {
      accent: '#bee304',
      accentDark: '#6c8704',
      accentSoft: '#e8f7a0',
      onAccent: '#0a0a0a',
      base: '#000000',
      surface: '#141414',
      surfaceTint: '#feffe5',
      borderSubtle: '#262626',
      textMuted: '#a3a3a3',
    },
  },
  {
    key: 'royal-violet',
    name: 'Royal Violet',
    description: 'Electric violet on ink. Modern and distinctive — few gyms look like this.',
    tokens: {
      accent: '#8b5cf6',
      accentDark: '#6d28d9',
      accentSoft: '#ddd6fe',
      onAccent: '#ffffff',
      base: '#0b0a12',
      surface: '#17151f',
      surfaceTint: '#f5f3ff',
      borderSubtle: '#2a2637',
      textMuted: '#a5a0b5',
    },
  },
  {
    key: 'emerald-forge',
    name: 'Emerald Forge',
    description: 'Rich emerald on charcoal. Calmer and more upscale — suits wellness as much as strength.',
    tokens: {
      accent: '#10b981',
      accentDark: '#047857',
      accentSoft: '#a7f3d0',
      onAccent: '#04140e',
      base: '#0a100d',
      surface: '#151d19',
      surfaceTint: '#ecfdf5',
      borderSubtle: '#22302a',
      textMuted: '#94a89e',
    },
  },
  {
    key: 'solar-amber',
    name: 'Solar Amber',
    description: 'Amber gold on espresso. Warm and boutique rather than commercial.',
    tokens: {
      accent: '#f5a524',
      accentDark: '#b45309',
      accentSoft: '#fde68a',
      onAccent: '#1a1206',
      base: '#12100e',
      surface: '#1f1b16',
      surfaceTint: '#fffbeb',
      borderSubtle: '#332c24',
      textMuted: '#a8a096',
    },
  },
];

export const DEFAULT_THEME_KEY = 'midnight-ember';

export function getTheme(key?: string | null): Theme {
  return (
    THEMES.find((t) => t.key === key) ??
    THEMES.find((t) => t.key === DEFAULT_THEME_KEY) ??
    THEMES[0]
  );
}

/** Maps theme tokens onto the CSS custom properties globals.css consumes. */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const t = theme.tokens;
  return {
    '--accent': t.accent,
    '--accent-dark': t.accentDark,
    '--accent-soft': t.accentSoft,
    '--on-accent': t.onAccent,
    '--base': t.base,
    '--surface': t.surface,
    '--surface-tint': t.surfaceTint,
    '--border-subtle': t.borderSubtle,
    '--text-muted': t.textMuted,
  };
}

/** Applies a theme to the document root. Safe to call on the client only. */
export function applyTheme(theme: Theme, root?: HTMLElement) {
  if (typeof document === 'undefined') return;
  const el = root ?? document.documentElement;
  const vars = themeToCssVars(theme);
  for (const [prop, value] of Object.entries(vars)) {
    el.style.setProperty(prop, value);
  }
  el.setAttribute('data-theme', theme.key);
}
