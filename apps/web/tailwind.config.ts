import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14171a",
        line: "#d8dee4",
        mist: "#f5f8fa",
        action: "#0f7bff",
        money: "#16803c",
        lead: "#b7791f",
        legal: "#9f1239"
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(15, 123, 255, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
