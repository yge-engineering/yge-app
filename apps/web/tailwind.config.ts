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
          500: '#1f4e78',
          700: '#163a5a',
        },
        'yge-accent': {
          500: '#2e75b6',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
