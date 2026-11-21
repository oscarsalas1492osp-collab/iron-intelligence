// Planes en pantalla: el estado del plan, la hoja con precios y los candados de las funciones Pro.
// Mientras el cobro esté apagado nada de esto se dibuja y todo queda abierto.
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlanSnapshot, startTrial, subscribePlan } from '../data/plan';
import { money, needsPro, planState, priceFor, type Feature, type PlanState } from '../domain/plan';
import { useUserId } from '../hooks';
import { Btn, Card, Icon, Seg, Sheet, useUi } from './components';

export function usePlan(): PlanState {
  const snap = useSyncExternalStore(subscribePlan, getPlanSnapshot, getPlanSnapshot), uid = useUserId();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => planState(snap.billing, snap.uid === uid ? snap.ent : null, Date.now(), uid !== 'local'), [snap, uid]);
}

// La hoja de planes se abre desde cualquier candado.
let sheetOpen = false;
const sheetSubs = new Set<() => void>();
const setSheet = (v: boolean) => { sheetOpen = v; sheetSubs.forEach((cb) => cb()); };
export const openPlans = () => setSheet(true);
const useSheetOpen = () => useSyncExternalStore((cb) => { sheetSubs.add(cb); return () => { sheetSubs.delete(cb); }; }, () => sheetOpen, () => sheetOpen);

const days = (n: number) => (n === 1 ? '1 día' : `${n} días`);

/** Abre los planes si la función pide Pro; si no, sigue. Para botones: onClick={guard(() => hacerAlgo())}. */
export function useProGuard(feature: Feature) {
  const plan = usePlan(), locked = needsPro(plan, feature);
  return { locked, guard: (go: () => void) => () => (locked ? openPlans() : go()) };
}

const PRO_TEXT: Record<Feature, string> = {
  supersets: 'Biseries y triseries',
  techniques: 'Técnicas de intensidad: series descendentes, descanso-pausa y más',
  suggestions: 'Peso sugerido para cada ejercicio según tus últimas sesiones',
  templates: 'Plantillas de rutinas listas para usar',
  warmup: 'Calculadora de calentamiento',
  recovery: 'Recuperación y fatiga por músculo',
  assistant: 'Asistente que responde con tu propio historial',
};

function Benefits({ plan, proOnly }: { plan: PlanState; proOnly: Feature[] }) {
  const rows = [
    `Rutinas sin límite (gratis: hasta ${plan.freeRoutines})`,
    ...proOnly.map((f) => PRO_TEXT[f]),
    `Análisis de todo tu historial (gratis: los últimos ${plan.freeHistoryDays} días)`,
    `Ejercicios propios sin límite (gratis: hasta ${plan.freeCustomExercises})`,
  ];
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r} className="flex items-start gap-2.5 text-sm"><Icon name="check" size={18} className="mt-0.5 shrink-0 text-go" /><span>{r}</span></li>
      ))}
    </ul>
  );
}

/** Hoja con lo que incluye Pro, los precios y el paso siguiente según el estado de cada persona. */
export function PlanSheet() {
  const open = useSheetOpen(), plan = usePlan(), uid = useUserId(), snap = useSyncExternalStore(subscribePlan, getPlanSnapshot, getPlanSnapshot);
  const { toast } = useUi(), nav = useNavigate();
  const [period, setPeriod] = useState<'yearly' | 'monthly'>('yearly'), [busy, setBusy] = useState(false);
  const billing = snap.billing;
  if (!billing || !plan.billing) return null;
  const price = priceFor(billing, typeof navigator === 'undefined' ? 'es-CL' : navigator.language), pay = billing.checkout[period];
  const trial = async () => {
    setBusy(true);
    try { await startTrial(uid); toast(`Prueba de Pro activada: ${days(plan.trialDays)}`); setSheet(false); }
    catch (e) { toast(e instanceof Error ? e.message : 'No se pudo iniciar la prueba.', 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={() => setSheet(false)} title="Iron Intelligence Pro">
      <div className="space-y-5">
        <p className="text-sm text-mute">Registrar tus entrenamientos, la biblioteca de ejercicios y la calculadora de discos son gratis, sin anuncios. Pro abre todo lo demás:</p>
        <Benefits plan={plan} proOnly={billing.proOnly} />
        {price && (
          <div>
            <Seg value={period} onChange={setPeriod} options={[{ value: 'yearly', label: 'Anual' }, { value: 'monthly', label: 'Mensual' }]} />
            <p className="mt-3 font-wide text-3xl font-extrabold tabular-nums">{money(price[period], price.currency)}<span className="ml-2 font-sans text-sm font-medium text-mute">{period === 'yearly' ? 'al año' : 'al mes'}</span></p>
            <p className="mt-1 text-xs text-mute">{period === 'yearly'
              ? `Equivale a ${money(price.yearly / 12, price.currency)} al mes${price.saving > 0 ? `, ${price.saving} % menos que pagando mes a mes` : ''}.`
              : 'Se renueva cada mes. Puedes cancelar cuando quieras.'}</p>
          </div>
        )}
        {plan.kind === 'trial' && <p className="rounded-xl bg-card2 px-3 py-2 text-sm">Estás probando Pro. {plan.daysLeft !== null && `Te quedan ${days(plan.daysLeft)}.`}</p>}
        {plan.pro && plan.kind !== 'trial' ? (
          <p className="rounded-xl bg-card2 px-3 py-2 text-sm">{plan.kind === 'gift' ? 'Tienes Pro de regalo.' : 'Tu suscripción a Pro está activa.'}{plan.daysLeft !== null && ` Vigente por ${days(plan.daysLeft)} más.`}</p>
        ) : uid === 'local' ? (
          <div className="space-y-2">
            <p className="text-sm text-mute">Para probar Pro necesitas una cuenta: así tu plan te acompaña en todos tus dispositivos.</p>
            <Btn variant="primary" className="w-full" onClick={() => { setSheet(false); nav('/perfil'); }}>Ir a Perfil</Btn>
          </div>
        ) : plan.canTrial ? (
          <div className="space-y-2">
            <Btn variant="primary" className="w-full" disabled={busy} onClick={() => void trial()}>Probar Pro {days(plan.trialDays)} gratis</Btn>
            <p className="text-center text-xs text-mute">Sin tarjeta. Al terminar sigues en el plan gratis, con todos tus datos.</p>
          </div>
        ) : pay ? (
          <a href={pay} target="_blank" rel="noopener noreferrer" className="btn-fire hit block w-full rounded-xl px-4 py-3 text-center font-semibold text-ink">Suscribirme a Pro</a>
        ) : (
          <p className="rounded-xl bg-card2 px-3 py-2 text-sm text-mute">El pago todavía no está habilitado. Te avisaremos en la app cuando lo esté.</p>
        )}
      </div>
    </Sheet>
  );
}

/** Deja pasar si el plan lo permite; si no, explica qué es la función y ofrece ver los planes. */
export function ProGate({ feature, title, text, children }: { feature: Feature; title: string; text: string; children: ReactNode }) {
  const plan = usePlan();
  if (!needsPro(plan, feature)) return <>{children}</>;
  return (
    <div className="mx-auto max-w-md pt-10 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-card2 text-fire"><Icon name="star" size={26} /></span>
      <h1 className="font-wide text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-mute">{text}</p>
      <Btn variant="primary" className="mt-6 w-full" onClick={openPlans}>{plan.canTrial ? `Probar Pro ${days(plan.trialDays)} gratis` : 'Ver planes'}</Btn>
      <p className="mt-3 text-xs text-mute">Tus registros siguen guardados y el plan gratis no vence.</p>
    </div>
  );
}

/** Tarjeta de Perfil con el plan actual. */
export function PlanCard() {
  const plan = usePlan();
  if (!plan.billing) return null;
  const line = plan.kind === 'trial' ? `Prueba de Pro${plan.daysLeft !== null ? `: te quedan ${days(plan.daysLeft)}` : ''}`
    : plan.kind === 'gift' ? `Pro de regalo${plan.daysLeft !== null ? `, vigente por ${days(plan.daysLeft)} más` : ''}`
    : plan.kind === 'paid' ? 'Pro activo' : 'Plan gratis';
  return (
    <Card className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0"><p className="label">Tu plan</p><p className="truncate font-semibold">{line}</p></div>
      <Btn size="sm" variant={plan.pro ? 'soft' : 'primary'} onClick={openPlans}>{plan.pro ? 'Ver' : 'Ver Pro'}</Btn>
    </Card>
  );
}
