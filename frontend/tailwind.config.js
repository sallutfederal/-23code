/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          '000': 'hsl(var(--bg-000))',
          '100': 'hsl(var(--bg-100))',
          '200': 'hsl(var(--bg-200))',
          '300': 'hsl(var(--bg-300))',
          '400': 'hsl(var(--bg-400))',
        },
        text: {
          '000': 'hsl(var(--text-000))',
          '100': 'hsl(var(--text-100))',
          '200': 'hsl(var(--text-200))',
          '300': 'hsl(var(--text-300))',
          '500': 'hsl(var(--text-500))',
        },
        border: {
          '200': 'hsl(var(--border-200))',
          '300': 'hsl(var(--border-300))',
          '400': 'hsl(var(--border-400))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          light: 'hsl(var(--accent-light))',
          hover: 'hsl(var(--accent-hover))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          hover: 'hsl(var(--danger-hover))',
        },
        fill: {
          secondary: 'hsl(var(--fill-secondary))',
          'secondary-hover': 'hsl(var(--fill-secondary-hover))',
        },
      },
    },
  },
  plugins: [],
}
