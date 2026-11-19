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
              <h3 className="wd-w font-bold leading-tight">{e.topic}</h3>
              <span className={`shrink-0 rounded-full wd-c px-2.5 py-0.5 text-xs font-semibold ${e.kind === 'evidencia' ? 'bg-go/15 text-go' : 'bg-fire/15 text-fire'}`}>{e.kind}</span>
            </div>
            <p className="text-sm text-chalk/90">{e.finding}</p>
            <p className="mt-2 text-sm text-mute"><b className="text-chalk">En la app:</b> {e.appRule}</p>
            {e.refs.length > 0 && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">{e.refs.map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="text-data underline">{r.label}</a>)}</div>}
          </Card>
        ))}
      </div>

      <h2 className="wd-w mb-2 mt-8 border-t border-line pt-4 text-[15px] font-bold">Créditos del modelo anatómico</h2>
      <p className="max-w-prose text-sm text-mute">
        El modelo 3D proviene de <a className="text-data underline" href="https://www.z-anatomy.com/" target="_blank" rel="noreferrer">Z-Anatomy</a>, en la versión para navegador de{' '}
        <a className="text-data underline" href="https://github.com/hpfrei/body-anatomy-3d-viewer" target="_blank" rel="noreferrer">hpfrei/body-anatomy-3d-viewer</a>, con licencia{' '}
        <a className="text-data underline" href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. Para esta app se reagruparon sus mallas por grupo muscular y se quitaron estructuras internas; el archivo resultante se distribuye con la misma licencia.
        El mapa 2D usa la geometría de <a className="text-data underline" href="https://github.com/vulovix/body-muscles" target="_blank" rel="noreferrer">body-muscles</a> (Apache-2.0). La tipografía es Archivo (SIL Open Font License).
      </p>
    </div>
  );
}
