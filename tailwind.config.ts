import type { Config } from "tailwindcss";

// Clinic Glass design tokens. The palette is the United Endodontics brand.
// A gray ramp is tinted very slightly toward green so light and dark feel
// cohesive. endo is the single accent, used with restraint.
export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A1A1A",
        forest: "#1E3A28",
        endo: "#3A7D44",
        sage: "#7CB68A",
        parchment: "#F5F0E8",
        // Green-tinted neutral ramp.
        clay: {
          50: "#F7F8F6",
          100: "#EEF0EC",
          200: "#DCE0D8",
          300: "#C2C9BD",
          400: "#9CA697",
          500: "#788273",
          600: "#5C6557",
          700: "#454D42",
          800: "#2F352D",
          900: "#1D211C",
          950: "#121512",
        },
        // Clinical status hues, only as small chips and dots.
        urgent: "#C0432F",
        caution: "#C98A2B",
        info: "#5B6B7C",
        complete: "#7CB68A",
        // Semantic tokens wired to CSS variables for light and dark parity.
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        hairline: "var(--hairline)",
        content: "var(--content)",
        "content-soft": "var(--content-soft)",
        accent: "var(--accent)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "sans-serif",
        ],
        serif: ["Merriweather", "ui-serif", "New York", "Georgia", "serif"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
        panel: "0 8px 40px rgba(0,0,0,0.14)",
      },
      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
