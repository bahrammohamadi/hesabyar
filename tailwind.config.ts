import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    // سیستم اصلی UI و runtime پنل‌ها اینجا هستند؛ بدون این مسیر، کلاس‌هایی که
    // فقط در src/ استفاده می‌شوند (مثل overscroll-contain در PanelShell) اصلاً
    // در CSS خروجی تولید نمی‌شدند.
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /*
        شعاع گوشه از توکن CSS مشتق می‌شود.
        پیش از این ۸ مقدار پراکنده در کد بود (rounded-[24px]، rounded-3xl، …)
        که تغییر یکپارچه‌ی ظاهر را غیرممکن می‌کرد.
      */
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      fontFamily: {
        sans: ["var(--font-vazirmatn)", "Vazirmatn", "Tahoma", "sans-serif"],
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
      },
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          text: "hsl(var(--destructive-text))",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
          soft: "hsl(var(--success-soft) / <alpha-value>)",
          onSoft: "hsl(var(--success-on-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
          soft: "hsl(var(--warning-soft) / <alpha-value>)",
          onSoft: "hsl(var(--warning-on-soft))",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
          soft: "hsl(var(--info-soft) / <alpha-value>)",
          onSoft: "hsl(var(--info-on-soft))",
          text: "hsl(var(--info-text))",
        },
        finance: {
          profit: "hsl(var(--finance-profit) / <alpha-value>)",
          loss: "hsl(var(--finance-loss) / <alpha-value>)",
          debt: "hsl(var(--finance-debt) / <alpha-value>)",
          credit: "hsl(var(--finance-credit) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        rose: {
          50: "rgb(var(--rose-50) / <alpha-value>)",
          100: "rgb(var(--rose-100) / <alpha-value>)",
          200: "rgb(var(--rose-200) / <alpha-value>)",
          300: "rgb(var(--rose-300) / <alpha-value>)",
          400: "rgb(var(--rose-400) / <alpha-value>)",
          500: "rgb(var(--rose-500) / <alpha-value>)",
          600: "rgb(var(--rose-600) / <alpha-value>)",
          700: "rgb(var(--rose-700) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
