import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../data/db';
import { mine } from '../data/repo';
import { answer, makeCtx, QUICK_QUESTIONS, type Answer } from '../domain/assistant';
import { useAllItems, useDoneSets, useExercises, useProfile, useRoutines, useUserId } from '../hooks';
import { Btn, Chip, Title } from '../ui/components';

interface Msg { from: 'user' | 'bot'; text?: string; answer?: Answer }

export default function Assistant() {
  const uid = useUserId();
  const sets = useDoneSets(); const exercises = useExercises(); const routines = useRoutines(); const items = useAllItems(); const profile = useProfile();
  const recovery = useLiveQuery(async () => mine(await db.recovery.toArray()), [uid]);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs.length]);
  const ready = sets && routines && items && recovery;

  const ask = (q: string) => {
    if (!q.trim() || !ready) return;
    const a = answer(q, makeCtx({ sets, exercises, routines, items, recovery, indirectCoef: profile.indirectCoef, now: Date.now() }));
    setMsgs((m) => [...m, { from: 'user', text: q }, { from: 'bot', answer: a }]);
    setText('');
  };

  return (
    <div className="flex min-h-[70vh] flex-col">
      <Title sub="Responde solo con tu historial registrado">Asistente</Title>
      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">{QUICK_QUESTIONS.map((q) => <Chip key={q} onClick={() => ask(q)}>{q}</Chip>)}</div>
      <div className="flex-1 space-y-3">
        {!msgs.length && (
          <div className="rounded-panel bg-card/60 p-5 text-sm text-mute">
            <p className="mb-2 font-semibold text-chalk">Cómo funciona</p>
            <p>Este asistente es un motor de análisis: reconoce tu pregunta y calcula la respuesta con tus sesiones, series y RIR. No genera texto libre ni inventa datos; si falta información, te lo dice. Cada respuesta indica en qué datos se basa.</p>
          </div>
        )}
        {msgs.map((m, i) => m.from === 'user' ? (
          <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-fire px-4 py-2.5 text-sm font-medium text-ink">{m.text}</div>
        ) : (
          <div key={i} className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-card p-4 animate-rise">
            <div className="mb-1.5 font-bold">{m.answer!.title}</div>
            <ul className="space-y-1.5 text-sm text-chalk/90">{m.answer!.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
            <div className="mt-2.5 border-t border-line pt-2 text-[11px] text-mute">Basado en: {m.answer!.basis}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="sticky bottom-20 mt-4 flex gap-2 md:bottom-4" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: ¿Estoy progresando en espalda?" aria-label="Pregunta al asistente" />
        <Btn variant="primary" type="submit" disabled={!text.trim() || !ready}>Preguntar</Btn>
      </form>
    </div>
  );
}
