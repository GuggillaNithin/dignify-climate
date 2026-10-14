/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        space: {
          950: "#070b14", // Deepest navy charcoal background
          900: "#0b1220", // Card and container surface
          850: "#101a2e", // Hover / elevated surface
          800: "#16223b", // Panel surfaces
          700: "#223354", // Borders & separators
          600: "#324872",
        },
        cyan: {
          accent: "#06b6d4",
          bright: "#22d3ee",
          muted: "#083344",
        },
        hazard: {
          heat: "#f97316",     // Orange
          drought: "#eab308",  // Amber
          rain: "#38bdf8",     // Cyan/Sky
          alert: "#ef4444",    // Red
        }
      },
      fontFamily: {
        sans: [
          '"Noto Sans"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}
