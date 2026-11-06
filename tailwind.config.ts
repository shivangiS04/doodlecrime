import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "#0c0c0d",
          900: "#141416",
          800: "#1c1c1f",
          700: "#27272b",
          600: "#34343a",
        },
        tape: {
          DEFAULT: "#f2c200",
          dark: "#d4a800",
        },
        blood: {
          DEFAULT: "#9e1b1b",
          light: "#c23b3b",
        },
        paper: "#ece6d6",
      },
      fontFamily: {
        typewriter: ["var(--font-typewriter)", "monospace"],
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        corkboard:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
      },
      keyframes: {
        "stamp-in": {
          "0%": { transform: "scale(2.2) rotate(-8deg)", opacity: "0" },
          "60%": { transform: "scale(0.95) rotate(-8deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-8deg)", opacity: "1" },
        },
        "tape-flutter": {
          "0%, 100%": { transform: "rotate(-1.5deg)" },
          "50%": { transform: "rotate(1.5deg)" },
        },
      },
      animation: {
        "stamp-in": "stamp-in 0.4s cubic-bezier(.2,1.4,.4,1) forwards",
        "tape-flutter": "tape-flutter 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
