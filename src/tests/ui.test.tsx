// Pruebas de interfaz: flujos reales del usuario sobre la app completa.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { db } from '../data/db';
import * as repo from '../data/repo';
import { resetDb } from './helpers';

beforeEach(async () => { await resetDb(); window.location.hash = '#/'; });

const go = (path: string) => { window.location.hash = `#${path}`; };

describe('interfaz', () => {
  it('sin datos no muestra información ficticia y guía a crear una rutina', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /CREAR RUTINA/ })).toBeInTheDocument();
    expect(screen.getByText(/Aún no has completado ninguna sesión/)).toBeInTheDocument();
    expect(screen.getByText('Sin datos suficientes')).toBeInTheDocument();
  });

  it('todas las pantallas abren sin errores con la base vacía', async () => {
    const { unmount } = render(<App />);
    for (const [path, text] of [['/rutinas', 'Aún no tienes rutinas'], ['/ejercicios', 'Press de pecho en máquina'], ['/historial', 'Sin entrenamientos este mes'], ['/analisis', 'Sin datos para analizar'], ['/recuperacion', 'Registro de hoy'], ['/asistente', 'Cómo funciona'], ['/perfil', 'Modo local.'], ['/fundamento', 'Precisión del RIR'], ['/mas', 'Asistente'], ['/entrenar', 'Entrenamiento libre (sin rutina)']] as const) {
      go(path);
      expect((await screen.findAllByText(text, { exact: false })).length).toBeGreaterThan(0);
    }
    unmount();
  });

  it('flujo completo: iniciar, registrar una serie con RIR, cerrar la app, recuperar y finalizar', async () => {
    const user = userEvent.setup();
    const r = await repo.createRoutine('Push', 'PPL', [new Date().getDay()]);
    await repo.addItem(r.id, 'chest_press_machine');
    const first = render(<App />);

    await user.click(await screen.findByRole('button', { name: /INICIAR ENTRENAMIENTO/ }));
    await waitFor(() => expect(document.querySelector('[data-session-head]')).toHaveTextContent('En curso'));
    expect(await screen.findByText('0/3 series')).toBeInTheDocument();
    expect(screen.getByText(/sin registros previos/)).toBeInTheDocument();

    // Peso con el botón +, RIR con un toque, completar con un toque.
    await user.click(screen.getByRole('button', { name: 'Aumentar Peso serie 1' }));
    await user.click(await screen.findByRole('button', { name: 'RIR 2' }));
    await waitFor(() => expect(screen.getByText('Proximidad elevada al fallo')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Completar serie 1' }));
    expect(await screen.findByText('1/3 series')).toBeInTheDocument();
    expect(screen.getByRole('timer', { name: 'Descanso' })).toBeInTheDocument();
    const saved = (await db.sets.toArray()).find((s) => s.done)!;
    expect(saved).toMatchObject({ weight: 5, reps: 8, rir: 2, rpe: 8, done: true });

    // Cierre accidental: se desmonta todo y se vuelve a abrir.
    first.unmount();
    window.location.hash = '#/';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /CONTINUAR ENTRENAMIENTO/ }));
    expect(await screen.findByText('1/3 series')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Serie 1 completada/ })).toHaveTextContent('5 kg × 8');

    // Editar una serie ya completada (pasado el instante en que la lista se reacomoda y los toques se ignoran).
    await new Promise((r) => setTimeout(r, 650));
    await user.click(screen.getByRole('button', { name: /Serie 1 completada/ }));
    await user.click(screen.getByRole('button', { name: 'Aumentar Repeticiones serie 1' }));
    await waitFor(async () => expect((await db.sets.get(saved.id))!.reps).toBe(9));
    // La corrección se hace en una hoja aparte: se cierra antes de seguir.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Finalizar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Llevas 1 de 3 series en .*Las series sin hacer no se guardan/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Guardar entrenamiento' }));

    // Llega al historial con el detalle de la sesión guardada.
    expect(await screen.findByText('Objetivo: 3 × 8–12 con RIR 1–2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar serie 1' })).toHaveTextContent('5 kg × 9');
    expect((await db.sessions.toArray())[0].status).toBe('done');
    expect(await repo.getDoneSets()).toHaveLength(1);
  });

  it('entrenamiento libre: sin series solo se puede seguir o anular; con series, anular pide confirmar y no deja nada', async () => {
    const user = userEvent.setup();
    render(<App />);
    go('/entrenar');
    await user.click(await screen.findByRole('button', { name: /Entrenamiento libre/ }));
    expect(await screen.findByText('Añade tu primer ejercicio')).toBeInTheDocument();
    expect(document.querySelector('[data-session-head]')).toHaveTextContent('Entrenamiento libre');

    // Sin nada anotado no se ofrece guardar, y «Seguir entrenando» deja la sesión como estaba.
    await user.click(screen.getByRole('button', { name: 'Finalizar' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/No anotaste ninguna serie/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Guardar entrenamiento' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Seguir entrenando' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await repo.getActiveSession())?.name).toBe('Entrenamiento libre');

    // Con una serie hecha, anular pide un segundo toque, y «Volver» regresa a las tres salidas.
    const s = (await repo.getActiveSession())!;
    await repo.addExerciseToSession(s.id, 'chest_press_machine');
    const [first] = await repo.getSessionSets(s.id);
    await repo.updateSet(first.id, { weight: 40, reps: 10 }); await repo.completeSet(first.id);
    expect(await screen.findByText('1/3 series')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finalizar' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Anular entrenamiento' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Se borran las series que anotaste/)).toBeInTheDocument();
    expect((await repo.getActiveSession())?.id).toBe(s.id);
    await user.click(within(dialog).getByRole('button', { name: 'Volver' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Anular entrenamiento' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, anular' }));

    await waitFor(async () => expect(await repo.getActiveSession()).toBeUndefined());
    expect(await repo.getDoneSets()).toHaveLength(0);
    expect(await screen.findByText('Entrenamiento anulado')).toBeInTheDocument();
  });

  it('datos inválidos muestran un error y no se guardan', async () => {
    const user = userEvent.setup();
    render(<App />);
    go('/rutinas');
    await user.click(await screen.findByRole('button', { name: 'Crear rutina' }));
    await user.click(await screen.findByRole('button', { name: 'Crear y añadir ejercicios' }));
    expect(await screen.findByText('La rutina necesita un nombre')).toBeInTheDocument();
    expect(await db.routines.count()).toBe(0);
  });

  it('el asistente responde con el historial y declara en qué se basa', async () => {
    const user = userEvent.setup();
    const r = await repo.createRoutine('Push');
    await repo.addItem(r.id, 'chest_press_machine');
    const s = await repo.startSession(r.id);
    for (const x of await repo.getSessionSets(s.id)) { await repo.updateSet(x.id, { weight: 50, reps: 12, rir: 2 }); await repo.completeSet(x.id); }
    await repo.finishSession(s.id);
    render(<App />);
    go('/asistente');
    await user.click(await screen.findByRole('button', { name: '¿Cuándo debería aumentar la carga?' }));
    expect(await screen.findByText(/Press de pecho en máquina: sube a 55 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Basado en: 1 sesiones · 3 series registradas/)).toBeInTheDocument();
  });
});
