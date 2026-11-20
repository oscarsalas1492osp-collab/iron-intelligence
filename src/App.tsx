import Coach from './pages/Coach';
import { ImportRoutinePage } from './ui/extras';
import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { onLocalChange } from './data/repo';
import { cloudEnabled, initAuth, scheduleSync, syncNow, takeReturnError } from './data/sync';
import { useUserId } from './hooks';
import Assistant from './pages/Assistant';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import More from './pages/More';
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

// Vista previa incrustada (VITE_PREVIEW=1): navegación en memoria, porque el visor no admite rutas en el hash.
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : HashRouter;

const SKIP_KEY = 'ii_skip_auth';

/** Avisa si Google devolvió un error al volver a la app. */
function ReturnNotice() {
  const { toast } = useUi();
  useEffect(() => { const e = takeReturnError(); if (e) toast(e, 'error'); }, [toast]);
  return null;
}

export default function App() {
  const uid = useUserId();
  const [skipped, setSkipped] = useState(() => { try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; } });

  useEffect(() => initAuth(), []);

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
        {cloudEnabled && uid === 'local' && !skipped ? (
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
                <Route path="/recuperacion" element={<Recovery />} />
                <Route path="/asistente" element={<Assistant />} />
                <Route path="/perfil" element={<Profile />} />
                <Route path="/fundamento" element={<Science />} />
                <Route path="/mas" element={<More />} />
                <Route path="/importar" element={<ImportRoutinePage />} />
                <Route path="/entrenador" element={<Coach />} />
                <Route path="*" element={<Dashboard />} />
              </Route>
            </Routes>
            </Suspense>
          </Router>
        )}
      </UiProvider>
    </ErrorBoundary>
  );
}
