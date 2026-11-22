// Selector de idioma. Cada idioma se muestra con su propio nombre para que se reconozca sin entender el actual.
import { getLang, LANGS, setLang } from '../i18n';

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const cur = getLang();
  return (
    <div role="group" aria-label="Idioma" className={`flex gap-1.5 ${compact ? 'justify-center' : ''}`} data-notr>
      {LANGS.map((l) => (
        <button key={l.id} type="button" aria-pressed={l.id === cur} onClick={() => { if (l.id !== cur) setLang(l.id); }}
          className={`hit rounded-xl px-3 text-sm font-semibold transition-colors ${compact ? 'h-9' : 'h-11 flex-1'} ${l.id === cur ? 'bg-card2 text-chalk ring-1 ring-inset ring-white/15' : 'text-mute'}`}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
