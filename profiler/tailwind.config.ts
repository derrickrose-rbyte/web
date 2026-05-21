import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-archivo)", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
      colors: {
        black: "#0A0A0A",
        white: "#FFFFFF",
        gray: {
          100: "#F5F5F3",
          200: "#EBEBEA",
          300: "#D4D4D0",
          500: "#8A8A85",
          600: "#6B6B66",
          700: "#4A4A47",
        },
      },
    },
  },
  plugins: [],
};

export default config;
