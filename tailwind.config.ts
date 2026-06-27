import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "sans-serif"],
      },
      colors: {
        // هویت برند مهرجامه: سبز جنگلی + صورتی
        brand: {
          50: "#e9f4f0",
          100: "#c8e3da",
          200: "#9fcdbf",
          300: "#6fb3a0",
          400: "#449683",
          500: "#1f7a66",
          600: "#136451",
          700: "#0f4f41",
          800: "#0c3f34",
          900: "#0a332b",
        },
        rose: {
          50: "#fdeef0",
          100: "#fad7dc",
          200: "#f4b3bc",
          300: "#ec8b98",
          400: "#e3727f",
          500: "#d76d7a",
          600: "#c25563",
          700: "#a23f4c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
