import { EVIDENCE } from '../domain/evidence';
import { Card, Title } from '../ui/components';

export default function Science() {
  return (
    <div>
      <Title sub="Qué respalda la evidencia y qué es criterio práctico">Fundamento</Title>
      <p className="mb-4 text-sm text-mute">Cada regla de la aplicación está marcada como <b className="text-go">evidencia</b> (respaldada por revisiones o metaanálisis) o como <b className="text-fire">estimación práctica</b> (criterio de entrenamiento razonable sin un valor exacto en la literatura). La app no conoce tu estímulo muscular real: trabaja con lo que registras.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {EVIDENCE.map((e) => (
          <Card key={e.topic}>
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="font-bold leading-tight">{e.topic}</h3>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${e.kind === 'evidencia' ? 'bg-go/15 text-go' : 'bg-fire/15 text-fire'}`}>{e.kind}</span>
            </div>
            <p className="text-sm text-white/90">{e.finding}</p>
            <p className="mt-2 text-sm text-mute"><b className="text-white">En la app:</b> {e.appRule}</p>
            {e.refs.length > 0 && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">{e.refs.map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="text-data underline">{r.label}</a>)}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}
