import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coachAvailable, coachKnown } from '../data/coach';
import { Card, Icon, Title } from '../ui/components';
import { MORE } from '../ui/Layout';

const DESC: Record<string, string> = {
  '/ejercicios': 'Biblioteca, máquinas y ejercicios propios',
  '/analisis': 'Volumen por músculo y proximidad al fallo',
  '/recuperacion': 'Sueño, fatiga, estrés y peso corporal',
  '/asistente': 'Preguntas sobre tu historial',
  '/perfil': 'Objetivos, ajustes, copias y cuenta',
  '/fundamento': 'Evidencia detrás de cada regla',
};

export default function More() {
  // El modo entrenador aparece cuando el servidor lo tiene activado y hay una cuenta iniciada.
  const [coach, setCoach] = useState(coachKnown);
  useEffect(() => { void coachAvailable().then(setCoach); }, []);
  return (
    <div>
      <Title>Más</Title>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MORE.map((n) => (
          <Link key={n.to} to={n.to}>
            <Card className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-card2 text-amber"><Icon name={n.icon} /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">{n.label}</span><span className="block text-xs text-mute truncate">{DESC[n.to]}</span></span>
              <Icon name="right" className="text-mute" size={18} />
            </Card>
          </Link>
        ))}
        {coach && (
          <Link to="/entrenador">
            <Card className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-card2 text-amber"><Icon name="user" /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">Entrenador</span><span className="block text-xs text-mute truncate">Invita a tu entrenador o sigue a tus deportistas</span></span>
              <Icon name="right" className="text-mute" size={18} />
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
