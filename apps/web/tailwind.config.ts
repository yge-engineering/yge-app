import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // YGE brand tokens will live here once the brand kit lands.
      // Placeholder until Ryan picks a direction.
      colors: {
        'yge-blue': {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#1f4e78',
          600: '#1b4368',
          700: '#163a5a',
          800: '#112a44',
          900: '#0a1c2f',
        },
        'yge-accent': {
          500: '#2e75b6',
        },
      },
      fontFamily: {
        sans: ['var(--font-yge-sans)', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
