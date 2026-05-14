/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e6f2f8",
          100: "#c0dff0",
          200: "#93c9e5",
          300: "#5fb0d8",
          400: "#2f9acb",
          500: "#0083bc",
          600: "#006fa0",
          700: "#005a82",
          800: "#004468",
          900: "#00395A",
          950: "#00243F",
        },
        surface: {
          50: "#f8f9fb",
          100: "#f0f2f5",
          200: "#e4e7ec",
          300: "#cdd3dc",
          400: "#9aa3b4",
          500: "#6b7689",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
        accent: {
          DEFAULT: "#24BBEE",
          dark: "#009EDC",
        },
        amcorGreen: {
          DEFAULT: "#1BCDAC",
          light: "#93E7D7",
        },
        risk: {
          low: "#10b981",
          medium: "#f59e0b",
          high: "#f97316",
          critical: "#ef4444",
        },
        perf: {
          excellent: "#10b981",
          good: "#3b82f6",
          average: "#f59e0b",
          poor: "#ef4444",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Outfit"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
