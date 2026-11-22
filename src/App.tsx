import Coach from './pages/Coach';
import { ImportRoutinePage } from './ui/extras';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { onLocalChange } from './data/repo';
import { cloudEnabled, initAuth, scheduleSync, syncNow, takeReturnError } from './data/sync';
import { useUserId } from './hooks';
import { confirmPayment, paymentReturn, refreshPlan } from './data/plan';
import { PlanSheet, ProGate } from './ui/plan';
import Assistant from './pages/Assistant';
import Auth, { NewPassword, useRecovering } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import More from './pages/More';
import Plates from './pages/Plates';
import Profile from './pages/Profile';
import RoutineEditor from './pages/RoutineEditor';
import Routines from './pages/Routines';
import Science from './pages/Science';
import Workout from './pages/Workout';
import { ErrorBoundary, UiProvider, useUi } from './ui/components';
import Layout from './ui/Layout';

// Las pantallas con gráficos se cargan bajo demanda para que la app abra más rápido.
const Analysis = lazy(() => import('./pages/Analysis'));
const History = lazy(() => import('./pages/History'));
const Recovery = lazy(() => import('./pages/Recovery'));
// Panel interno: solo lo descarga quien entra a esa ruta, y el servidor solo le responde a la cuenta que administra.
const Panel = lazy(() => import('./panel/Panel'));

// Vista previa incrustada (VITE_PREVIEW=1): navegación en memoria, porque el visor no admite rutas en el hash.
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : HashRouter;

const SKIP_KEY = 'ii_skip_auth';

/** Avisa si Google devolvió un error al volver a la app. */
function ReturnNotice() {
  const { toast } = useUi();
  useEffect(() => { const e = takeReturnError(); if (e) toast(e, 'error'); }, [toast]);
  return null;
}

/** Al volver de Mercado Pago: confirma el pago con el servidor y avisa cómo quedó. Espera a que la sesión esté lista. */
function PaymentReturn({ uid }: { uid: string }) {
  const { toast } = useUi(), done = useRef(false);
  useEffect(() => {
    if (!paymentReturn || done.current || uid === 'local') return;
    done.current = true;
    void confirmPayment(uid, paymentReturn.id).then((ok) => toast(
      ok ? 'Pro activado. Gracias por suscribirte.' : 'Todavía no vemos tu pago. Si lo completaste, Pro se activará en unos minutos.', ok ? 'ok' : 'error'));
  }, [uid, toast]);
  return null;
}

export default function App() {
  const uid = useUserId();
  const recovering = useRecovering();
  const [skipped, setSkipped] = useState(() => { try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; } });

  useEffect(() => initAuth(), []);

  // Plan del usuario: al abrir, al cambiar de cuenta y al volver a la app.
  useEffect(() => {
    void refreshPlan(uid, true);
    const vis = () => document.visibilityState === 'visible' && void refreshPlan(uid);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [uid]);

  // Sincroniza al abrir, al recuperar conexión, al volver a la app y tras cada cambio local.
  useEffect(() => {
    if (!cloudEnabled || uid === 'local') return;
    void syncNow();
    const off = onLocalChange(() => scheduleSync());
    const go = () => void syncNow();
    const vis = () => document.visibilityState === 'visible' && go();
    window.addEventListener('online', go);
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(go, 60000);
    return () => { off(); window.removeEventListener('online', go); document.removeEventListener('visibilitychange', vis); clearInterval(t); };
  }, [uid]);

  return (
    <ErrorBoundary>
      <UiProvider>
        <ReturnNotice />
        <PaymentReturn uid={uid} />
        {recovering ? <NewPassword /> : cloudEnabled && uid === 'local' && !skipped ? (
          <Auth onSkip={() => { try { localStorage.setItem(SKIP_KEY, '1'); } catch { /* sin almacenamiento */ } setSkipped(true); }} />
        ) : (
          <Router>
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-mute">Cargando…</div>}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/entrenar" element={<Workout />} />
                <Route path="/rutinas" element={<Routines />} />
                <Route path="/rutinas/:id" element={<RoutineEditor />} />
                <Route path="/ejercicios" element={<Library />} />
                <Route path="/historial" element={<History />} />
                <Route path="/analisis" element={<Analysis />} />
                <Route path="/discos" element={<Plates />} />
                <Route path="/recuperacion" element={<ProGate feature="recovery" title="Recuperación" text="Registra sueño y fatiga, y mira cuánto se ha recuperado cada músculo antes de volver a entrenarlo."><Recovery /></ProGate>} />
                <Route path="/asistente" element={<ProGate feature="assistant" title="Asistente" text="Pregunta qué subir, qué te falta entrenar o cómo vas, y recibe respuestas armadas solo con tu historial."><Assistant /></ProGate>} />
                <Route path="/perfil" element={<Profile />} />
                <Route path="/fundamento" element={<Science />} />
                <Route path="/mas" element={<More />} />
                <Route path="/importar" element={<ImportRoutinePage />} />
                <Route path="/entrenador" element={<Coach />} />
                <Route path="/panel" element={<Panel />} />
                <Route path="*" element={<Dashboard />} />
              </Route>
            </Routes>
            </Suspense>
            <PlanSheet />
          </Router>
        )}
      </UiProvider>
    </ErrorBoundary>
  );
}
