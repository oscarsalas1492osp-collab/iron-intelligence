/** @type {import('tailwindcss').Config} */
// Sistema visual "acero nocturno": una sala azul noche con una fuente de luz. La luz es cálida cuando se entrena y
// fría cuando se analiza; las superficies son vidrio que la deja pasar. El naranja queda para la acción y el esfuerzo.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#060914',                      // fondo de la sala
        graphite: '#0b1020',                 // barras y hojas (base opaca bajo el desenfoque)
        card: 'rgba(160,190,255,0.035)',    // vidrio: superficies (con desenfoque, ver index.css)
        card2: 'rgba(170,198,255,0.10)',     // vidrio más denso: controles
        line: 'rgba(180,205,255,0.13)',      // filetes
        mute: '#949fb8',                     // texto secundario
        chalk: '#f2f6f6',                    // texto
        fire: '#ff6a1a',                     // intensidad y acción principal
        amber: '#ffb054',                    // reflejo cálido
        ember: '#ff4d4d',                    // fallo y acciones destructivas
        go: '#34e0a1',                       // progresión positiva
        data: '#58c7ff',                     // estadísticas (luz fría)
      },
      fontFamily: {
        sans: ['"Archivo Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { sheet: '32px', panel: '24px', ctl: '14px' },
      // Movimiento: salida fuerte por defecto (la interfaz responde al instante) y `scale` dentro de las transiciones,
      // para que la respuesta al toque de los botones no salte.
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.23, 1, 0.32, 1)', out: 'cubic-bezier(0.23, 1, 0.32, 1)', drawer: 'cubic-bezier(0.32, 0.72, 0, 1)' },
      transitionProperty: { DEFAULT: 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, scale, filter, backdrop-filter' },
      keyframes: {
        sheet: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        fade: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        rise: { '0%': { transform: 'translateY(18px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        strike: { '0%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        slidel: { '0%': { transform: 'translateX(32px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        breathe: { '0%,100%': { transform: 'scale(1)', opacity: '.55' }, '50%': { transform: 'scale(1.18)', opacity: '0' } },
        slider: { '0%': { transform: 'translateX(-32px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
      },
      animation: { sheet: 'sheet .34s cubic-bezier(.32,.72,0,1)', fade: 'fade .2s cubic-bezier(.23,1,.32,1)', breathe: 'breathe 2.4s ease-in-out infinite', pop: 'pop .18s cubic-bezier(.16,1,.3,1)', rise: 'rise .26s cubic-bezier(.16,1,.3,1)', strike: 'strike .28s cubic-bezier(.16,1,.3,1)', slidel: 'slidel .22s cubic-bezier(.16,1,.3,1)', slider: 'slider .22s cubic-bezier(.16,1,.3,1)' },
    },
  },
  future: { hoverOnlyWhenSupported: true }, // en pantallas táctiles el estado hover no se queda pegado tras tocar
  plugins: [],
};
