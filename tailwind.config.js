/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0b0d',
        graphite: '#111316',
        card: '#17191d',
        card2: '#1e2126',
        line: '#2a2d34',
        mute: '#8b919c',
        fire: '#ff6a1a',
        ember: '#ff3b30',
        go: '#2fd17a',
        data: '#3b9dff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        rise: { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: { pop: 'pop .18s ease-out', rise: 'rise .22s ease-out' },
    },
  },
  plugins: [],
};
