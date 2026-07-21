import type { Config } from "tailwindcss";

// Tailwind 配置：接入 shadcn 约定（CSS 变量主题 + 容器 + 关键帧）
// 新增：POMOS 增强仪表盘设计系统（cyan/amber 强调色、自定义字体、动效）
const config: Config = {
  darkMode: ["class", "[data-theme=\"dark\"]"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        // POMOS 增强仪表盘设计系统
        cyan: {
          DEFAULT: "#00F0C8",
          50: "#E6FEFA",
          100: "#B3FDF1",
          200: "#80FCE9",
          300: "#4DFAE0",
          400: "#1AF9D8",
          500: "#00F0C8",
          600: "#00C0A0",
          700: "#009078",
          800: "#006050",
          900: "#003028",
        },
        amber: {
          DEFAULT: "#F0C800",
          50: "#FEFBE6",
          100: "#FDF5B3",
          200: "#FBEF80",
          300: "#FAE94D",
          400: "#F9E31A",
          500: "#F0C800",
          600: "#C0A000",
          700: "#907800",
          800: "#605000",
          900: "#302800",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // POMOS 增强仪表盘动效
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards",
        "fade-in": "fade-in 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards",
        "scale-in": "scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Noto Sans SC"', "sans-serif"],
        body: ['"Plus Jakarta Sans"', '"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Noto Sans SC"', "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
