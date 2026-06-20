import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Existing semantic tokens, refreshed toward the logo's vibrance so
        // class names like `bg-leaf` / `text-mint` keep working everywhere.
        ink: "#1E1B4B",      // warm dark, slight indigo tint
        leaf: "#65A30D",     // warm lime (lime-600) — matches the logo's bag, harmonises with the warm end of the gradient
        mint: "#ECFCCB",     // yellow-leaning soft lime (lime-100) — pills + soft highlights
        clay: "#F97316",     // saturated orange — danger, warm accent
        maize: "#FACC15",    // vivid yellow — warning, attention
        mist: "#F8FAFC",     // cool off-white background

        // New tokens pulled directly from the logo gradient. Reserve these
        // for hero moments, brand chips, gradient utilities — don't paint
        // dashboards in them.
        brand: "#4F46E5",    // deep indigo — anchors the wordmark
        sky: "#3B82F6",      // clear blue — opening note of the rainbow
        iris: "#7C3AED",     // vivid violet
        coral: "#EC4899",    // hot pink
        sunset: "#F97316"    // warm orange — matches the checkmark
      },
      boxShadow: {
        soft: "0 12px 40px rgba(23, 33, 27, 0.08)"
      },
      fontFamily: {
        sans: [
          "var(--font-jakarta)",
          "system-ui",
          ...defaultTheme.fontFamily.sans
        ]
      },
      fontSize: {
        "display-xl": [
          "3.5rem",
          { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "700" }
        ],
        "display-lg": [
          "2.75rem",
          { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "700" }
        ],
        "display-md": [
          "2rem",
          { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "700" }
        ],
        h1: ["1.625rem", { lineHeight: "1.25", fontWeight: "600" }],
        h2: ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["1.0625rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.55" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.45", letterSpacing: "0.01em" }]
      }
    }
  },
  plugins: []
};

export default config;
