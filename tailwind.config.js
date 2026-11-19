/** @type {import('tailwindcss').Config} */
// Sistema visual "forja": grafito y antracita como base, tiza para el texto y una escala de
// incandescencia (hierro frío → rojo cereza → naranja → blanco) para la proximidad al fallo.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16181b',       // grafito: fondo
        graphite: '#1b1e22',  // barras y hojas
        card: '#202328',      // antracita: superficies
        card2: '#2a2e34',     // controles
        line: '#363b43',      // filetes
        mute: '#9299a3',      // texto secundario
        chalk: '#f3f1ec',     // tiza: texto
        fire: '#ff6a1a',      // intensidad y acción principal
        ember: '#ff3b30',     // fallo y acciones destructivas
        go: '#3ddc84',        // progresión positiva
        data: '#5aa9ff',      // estadísticas (azul de acero templado)
      },
      fontFamily: {
        sans: ['"Archivo Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { sheet: '28px', panel: '20px', ctl: '12px' },
      keyframes: {
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        rise: { '0%': { transform: 'translateY(18px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        strike: { '0%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: { pop: 'pop .18s cubic-bezier(.16,1,.3,1)', rise: 'rise .26s cubic-bezier(.16,1,.3,1)', strike: 'strike .28s cubic-bezier(.16,1,.3,1)' },
    },
  },
  plugins: [],
};
