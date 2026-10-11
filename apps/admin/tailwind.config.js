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
        gaming: {
          950: '#090d16',
          900: '#0f172a',
          850: '#131d35',
          800: '#1e293b',
          700: '#334155',
          neon: '#10b981',
          accent: '#3b82f6',
          orange: '#f97316',
          red: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 20px -3px rgba(16, 185, 129, 0.3)',
        'glow-blue': '0 0 20px -3px rgba(59, 130, 246, 0.3)',
        'glow-orange': '0 0 20px -3px rgba(249, 115, 22, 0.3)',
      }
    },
  },
  plugins: [],
}
