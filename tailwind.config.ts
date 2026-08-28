import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Brand ramp — prefer `brand-*` in new code.
        brand: {
          50: "#fff4ed",
          100: "#ffe6d5",
          200: "#ffc8aa",
          300: "#ffb894",
          400: "#ff8f5a",
          500: "#ff6b2c",
          600: "#e85718",
          700: "#c74e1b",
          800: "#9e3d16",
          900: "#7c3113",
        },
        // `lime-*` was the old brand accent and is used across the auth screens,
        // CTAs and cards. Remapping it to the orange ramp recolours those in one
        // place instead of editing ~40 utility classes across 13 files.
        // NOTE: `green-*` is deliberately NOT remapped — it carries semantic
        // success meaning (checkout confirmation, success ticks).
        lime: {
          50: "#fff4ed",
          100: "#ffe6d5",
          200: "#ffc8aa",
          300: "#ffb894",
          400: "#ff8f5a",
          500: "#ff6b2c",
          600: "#e85718",
          700: "#c74e1b",
          800: "#9e3d16",
          900: "#7c3113",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
