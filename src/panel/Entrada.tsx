// Acceso al panel interno desde «Más». Solo aparece para la cuenta que administra la app.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserId } from '../hooks';
import { Card, Icon } from '../ui/components';
import { adminKnown, isAdmin } from './api';

export function PanelLink() {
  const uid = useUserId();
  const [admin, setAdmin] = useState(() => adminKnown(uid));
  useEffect(() => { let on = true; void isAdmin(uid).then((v) => { if (on) setAdmin(v); }); return () => { on = false; }; }, [uid]);
  if (!admin) return null;
  return (
    <Link to="/panel" data-notr>
      <Card className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-card2 text-amber"><Icon name="grid" /></span>
        <span className="min-w-0 flex-1"><span className="block font-bold">Panel interno</span><span className="block truncate text-xs text-mute">Inscritos, cuentas y accesos de testers</span></span>
        <Icon name="right" className="text-mute" size={18} />
      </Card>
    </Link>
  );
}
