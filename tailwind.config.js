/** @type {import('tailwindcss').Config} */
// Sistema visual "brasa y vidrio": una sala oscura con una fuente de luz. La luz es cálida cuando se entrena y
// fría cuando se analiza; las superficies son vidrio que la deja pasar. El naranja queda para la acción y el esfuerzo.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0c',                      // fondo de la sala
        graphite: '#131316',                 // barras y hojas (base opaca bajo el desenfoque)
        card: 'rgba(255,255,255,0.055)',     // vidrio: superficies
        card2: 'rgba(255,255,255,0.09)',     // vidrio más denso: controles
        line: 'rgba(255,255,255,0.11)',      // filetes
        mute: '#9a9fa9',                     // texto secundario
        chalk: '#f5f3ee',                    // texto
        fire: '#ff6a1a',                     // intensidad y acción principal
        amber: '#ffb054',                    // reflejo cálido
        ember: '#ff453a',                    // fallo y acciones destructivas
        go: '#3ddc84',                       // progresión positiva
        data: '#6fb4ff',                     // estadísticas (luz fría)
      },
      fontFamily: {
        sans: ['"Archivo Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { sheet: '32px', panel: '24px', ctl: '14px' },
      keyframes: {
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        rise: { '0%': { transform: 'translateY(18px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        strike: { '0%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        slidel: { '0%': { transform: 'translateX(32px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        breathe: { '0%,100%': { transform: 'scale(1)', opacity: '.55' }, '50%': { transform: 'scale(1.18)', opacity: '0' } },
        slider: { '0%': { transform: 'translateX(-32px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
      },
      animation: { breathe: 'breathe 2.4s ease-in-out infinite', pop: 'pop .18s cubic-bezier(.16,1,.3,1)', rise: 'rise .26s cubic-bezier(.16,1,.3,1)', strike: 'strike .28s cubic-bezier(.16,1,.3,1)', slidel: 'slidel .22s cubic-bezier(.16,1,.3,1)', slider: 'slider .22s cubic-bezier(.16,1,.3,1)' },
    },
  },
  plugins: [],
};
