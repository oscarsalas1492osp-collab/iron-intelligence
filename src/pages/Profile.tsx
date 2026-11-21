import { ImportCard, TrainingSettings } from '../ui/extras';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { download, exportBackup, exportCsv, importBackup } from '../data/backup';
import { db } from '../data/db';
import { updateProfile } from '../data/repo';
import { cloudEnabled, deleteAccount, SESSION_EXPIRED, signOut, supabase, syncNow } from '../data/sync';
import { renewing, stopRenewal } from '../data/plan';
import { ymd } from '../domain/calc';
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLES, MUSCLE_LABEL } from '../domain/muscles';
import type { Experience, Goal, Profile as P } from '../domain/types';
import { useProfile, useSyncState, useUserId } from '../hooks';
import { Btn, Card, Chip, Field, H2, Seg, Sheet, Title, useAction, useUi } from '../ui/components';
import { PlanCard } from '../ui/plan';
import { setFigureChoice, setFigureLook, useFigureChoice, useFigureLook } from '../ui/figurePref';
import { AuthForm } from './Auth';

const GOALS: { value: Goal; label: string }[] = [{ value: 'hypertrophy', label: 'Hipertrofia' }, { value: 'strength', label: 'Fuerza' }, { value: 'recomposition', label: 'Recomposición' }, { value: 'maintenance', label: 'Mantenimiento' }];
const EXP: { value: Experience; label: string }[] = [{ value: 'beginner', label: 'Principiante' }, { value: 'intermediate', label: 'Intermedio' }, { value: 'advanced', label: 'Avanzado' }];
const GOAL_NOTE: Record<Goal, string> = {
  hypertrophy: 'Las plantillas y objetivos por defecto priorizan series cerca del fallo (0–2 RIR) en rangos de 8–15 repeticiones.',
  strength: 'Para fuerza conviene configurar rangos bajos (3–6) con cargas altas y RIR 1–3 en multiarticulares: la fuerza mejora más con cargas moderadas y altas y no depende tanto de la proximidad al fallo.',
  recomposition: 'Mantén la progresión de cargas como referencia principal; registra el peso corporal para seguir la tendencia.',
  maintenance: 'Con menos series semanales suele bastar para mantener; el análisis te muestra el volumen sin sugerir aumentarlo.',
};
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export default function Profile() {
  const p = useProfile(); const uid = useUserId(); const sync = useSyncState(); const figure = useFigureChoice(); const look = useFigureLook();
  const run = useAction(); const { toast, confirm } = useUi();
  const file = useRef<HTMLInputElement>(null);
  const [auth, setAuth] = useState(false);
  const lastBackup = useLiveQuery(() => db.meta.get(`lastBackup:${uid}`), [uid])?.value as number | undefined;
  const email = useLiveQuery(async () => (await supabase?.auth.getUser())?.data.user?.email ?? null, [uid]);
  const set = (patch: Partial<P>) => run(() => updateProfile(patch));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const onDelete = async () => {
    const account = uid !== 'local';
    const text = account
      ? `Se eliminará tu cuenta y todos tus entrenamientos, rutinas y registros, en el servidor y en este dispositivo.${renewing() ? ' Tu suscripción a Pro se cancelará y no habrá más cobros.' : ''} No se puede deshacer. Si quieres conservarlos, descarga antes una copia.`
      : 'Se borrarán todos los entrenamientos, rutinas y registros guardados en este dispositivo. No se puede deshacer. Si quieres conservarlos, descarga antes una copia.';
    if (!(await confirm(text, { confirmLabel: account ? 'Eliminar todo' : 'Borrar datos', danger: true }))) return;
    await run(async () => { await stopRenewal(); await deleteAccount(); }, account ? 'Cuenta y datos eliminados' : 'Datos borrados de este dispositivo');
  };

  const onImport = async (f: File) => {
    if (!(await confirm('Se añadirán los datos de la copia a los actuales. Los registros con el mismo identificador se reemplazan.', { confirmLabel: 'Restaurar' }))) return;
    const r = await run(async () => importBackup(await f.text()));
    if (r) toast(`${r.imported} registros restaurados${r.skipped ? ` · ${r.skipped} omitidos por datos inválidos` : ''}`);
  };

  return (
    <div>
      <Title sub="Personaliza la experiencia y gestiona tus datos">Perfil y datos</Title>
      <PlanCard />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <H2>Datos personales</H2>
          <Card className="space-y-3">
            <Field label="Nombre"><input key={p.updatedAt + 'n'} defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && set({ name: e.target.value })} placeholder="¿Cómo te llamas?" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Edad"><input key={p.updatedAt + 'a'} inputMode="numeric" defaultValue={p.age ?? ''} onBlur={(e) => { const v = num(e.target.value); if (v !== p.age) set({ age: v == null ? null : Math.round(v) }); }} /></Field>
              <Field label="Altura (cm)"><input key={p.updatedAt + 'h'} inputMode="decimal" defaultValue={p.heightCm ?? ''} onBlur={(e) => { const v = num(e.target.value); if (v !== p.heightCm) set({ heightCm: v }); }} /></Field>
              <Field label="Sexo (opcional)"><select value={p.sex} onChange={(e) => set({ sex: e.target.value as P['sex'] })}><option value="">—</option><option value="m">Hombre</option><option value="f">Mujer</option><option value="x">Otro</option></select></Field>
            </div>
            <div role="group" aria-label="Figura del mapa muscular">
              <span className="label mb-1.5 block">Figura del mapa muscular</span>
              <Seg value={figure} onChange={setFigureChoice} options={[{ value: 'auto', label: 'Automática' }, { value: 'male', label: 'Masculina' }, { value: 'female', label: 'Femenina' }]} />
              <span className="mt-1 block text-xs text-mute">En automático sigue al sexo indicado arriba. Se guarda en este dispositivo.</span>
            </div>
            <div role="group" aria-label="Figura de los ejercicios">
              <span className="label mb-1.5 block">Figura de los ejercicios</span>
              <Seg value={look} onChange={setFigureLook} options={[{ value: 'piel', label: 'Atleta' }, { value: 'anatomia', label: 'Anatomía' }]} />
              <span className="mt-1 block text-xs text-mute">Atleta es la figura con piel y ropa. Anatomía muestra cada músculo por separado, sin piel. Se guarda en este dispositivo.</span>
            </div>
            <p className="text-xs text-mute">El peso corporal se registra en <Link to="/recuperacion" className="text-data underline">Recuperación</Link>.</p>
          </Card>

          <H2>Entrenamiento</H2>
          <Card className="space-y-3">
            <Field label="Objetivo principal"><select value={p.goal} onChange={(e) => set({ goal: e.target.value as Goal })}>{GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
            <p className="text-xs text-mute">{GOAL_NOTE[p.goal]}</p>
            <Field label="Experiencia"><Seg value={p.experience} onChange={(experience) => set({ experience })} options={EXP} /></Field>
            <Field label={`Días disponibles por semana · ${p.daysAvailable}`}><input type="range" min={1} max={7} value={p.daysAvailable} onChange={(e) => set({ daysAvailable: Number(e.target.value) })} aria-label="Días disponibles" /></Field>
            <Field label="Grupos musculares prioritarios" hint="Se marcan con una estrella en el análisis de volumen."><div className="flex flex-wrap gap-2">{MUSCLES.map((m) => <Chip key={m} active={p.priorityMuscles.includes(m)} color="#ff6a1a" onClick={() => set({ priorityMuscles: toggle(p.priorityMuscles, m) })}>{MUSCLE_LABEL[m]}</Chip>)}</div></Field>
            <Field label="Equipamiento disponible"><div className="flex flex-wrap gap-2">{EQUIPMENT.map((m) => <Chip key={m} active={p.equipment.includes(m)} color="#58c7ff" onClick={() => set({ equipment: toggle(p.equipment, m) })}>{EQUIPMENT_LABEL[m]}</Chip>)}</div></Field>
          </Card>
        </div>

        <div>
          <H2>Ajustes del análisis</H2>
          <Card className="space-y-4">
            <label className="flex items-center justify-between gap-3">
              <span><span className="block font-semibold">RIR con medios puntos</span><span className="block text-xs text-mute">Para quien ya estima bien su proximidad al fallo (p. ej. RIR 1.5).</span></span>
              <input type="checkbox" checked={p.halfRir} onChange={(e) => set({ halfRir: e.target.checked })} className="!w-6 h-6 accent-fire" aria-label="RIR con medios puntos" />
            </label>
            <Field label={`Coeficiente de series indirectas · ${p.indirectCoef.toFixed(2)}`} hint="Cuánto cuenta una serie para un músculo secundario. 0,5 es la convención que mejor ajustó en la metarregresión de Pelland et al.; no es una equivalencia exacta.">
              <input type="range" min={0} max={1} step={0.05} value={p.indirectCoef} onChange={(e) => set({ indirectCoef: Number(e.target.value) })} aria-label="Coeficiente de series indirectas" />
            </Field>
          </Card>

          <H2>Cuenta y sincronización</H2>
          <Card className="space-y-3">
            {!cloudEnabled ? (
              <p className="text-sm text-mute"><b className="text-chalk">Modo local.</b> Tus datos se guardan de forma persistente en este dispositivo (IndexedDB). Para tener cuenta, respaldo en la nube y sincronización entre dispositivos, configura Supabase siguiendo el README (variables <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>).</p>
            ) : uid === 'local' ? (
              <><p className="text-sm text-mute">Sin cuenta: los datos están solo en este dispositivo. Al iniciar sesión se asocian a tu cuenta y se sincronizan.</p><Btn variant="primary" icon="cloud" className="w-full" onClick={() => setAuth(true)}>Iniciar sesión o crear cuenta</Btn></>
            ) : (
              <>
                <div className="text-sm"><div className="font-semibold">{email ?? 'Cuenta conectada'}</div><div className="text-xs text-mute">{sync.status === 'error' ? `Error: ${sync.error}` : sync.status === 'syncing' ? 'Sincronizando…' : sync.status === 'offline' ? 'Sin conexión: se sincronizará al volver' : sync.lastSync ? `Última sincronización: ${new Date(sync.lastSync).toLocaleTimeString('es-CL')}` : 'Pendiente de sincronizar'}</div></div>
                {sync.error === SESSION_EXPIRED && <Btn variant="primary" className="w-full" onClick={() => setAuth(true)}>Volver a iniciar sesión</Btn>}
                <div className="flex gap-2"><Btn icon="cloud" className="flex-1" onClick={() => run(syncNow)}>Sincronizar ahora</Btn><Btn variant="danger" onClick={() => run(signOut, 'Sesión cerrada')}>Cerrar sesión</Btn></div>
              </>
            )}
          </Card>

          <H2>Copias de seguridad y exportación</H2>
          <Card className="space-y-2">
            <p className="text-xs text-mute">{lastBackup ? `Última copia descargada: ${new Date(lastBackup).toLocaleDateString('es-CL')}.` : 'Aún no has descargado una copia.'} La copia incluye perfil, rutinas, ejercicios propios, sesiones, series, recuperación y peso corporal.</p>
            <Btn className="w-full" onClick={() => run(async () => download(`iron-intelligence-${ymd(Date.now())}.json`, JSON.stringify(await exportBackup(), null, 2), 'application/json'), 'Copia descargada')}>Descargar copia completa (JSON)</Btn>
            <Btn className="w-full" onClick={() => run(async () => download(`iron-intelligence-series-${ymd(Date.now())}.csv`, '﻿' + (await exportCsv()), 'text/csv'), 'CSV descargado')}>Exportar series a CSV (Excel)</Btn>
            <Btn className="w-full" onClick={() => file.current?.click()}>Restaurar desde una copia</Btn>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Archivo de copia de seguridad" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ''; }} />
          </Card>
          <TrainingSettings />
          <ImportCard />
          <H2>Privacidad</H2>
          <Card className="space-y-3">
            <p className="text-xs text-mute">Tus registros solo se usan para mostrarte tus análisis. No hay publicidad ni se comparten con terceros.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a className="text-data underline" href="./privacidad.html">Política de privacidad</a>
              <a className="text-data underline" href="./terminos.html">Términos de uso</a>
              <a className="text-data underline" href="./eliminar-cuenta.html">Cómo eliminar tu cuenta</a>
            </div>
            <Btn variant="danger" className="w-full" onClick={onDelete}>{uid !== 'local' ? 'Eliminar cuenta y datos' : 'Borrar los datos de este dispositivo'}</Btn>
          </Card>
          <Link to="/fundamento" className="mt-4 block text-center text-sm text-data underline">Ver el fundamento científico de las recomendaciones</Link>
        </div>
      </div>
      <Sheet open={auth} onClose={() => setAuth(false)} title="Cuenta"><AuthForm onDone={() => setAuth(false)} /></Sheet>
    </div>
  );
}
