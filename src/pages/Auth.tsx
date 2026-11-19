import { useState } from 'react';
import { signIn, signUp } from '../data/sync';
import { Btn, Field, Seg, useAction, useUi } from '../ui/components';
import { Logo } from '../ui/Layout';

export function AuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const run = useAction(); const { toast } = useUi();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
    setBusy(true);
    const r = await run(() => (mode === 'in' ? signIn(email.trim(), password).then(() => 'ok' as const) : signUp(email.trim(), password)));
    setBusy(false);
    if (r === 'confirm') toast('Revisa tu correo para confirmar la cuenta y luego inicia sesión');
    if (r === 'ok') { toast('Sesión iniciada. Tus datos se sincronizan.'); onDone?.(); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Seg value={mode} onChange={setMode} options={[{ value: 'in', label: 'Iniciar sesión' }, { value: 'up', label: 'Crear cuenta' }]} />
      <Field label="Correo"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Contraseña" hint="Mínimo 8 caracteres"><input type="password" required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Btn variant="primary" size="lg" className="w-full" type="submit" disabled={busy}>{busy ? 'Conectando…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</Btn>
    </form>
  );
}

export default function Auth({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8"><Logo /></div>
      <h1 className="text-3xl font-extrabold tracking-tight">Registra.<br />Analiza.<br /><span className="text-fire">Progresa.</span></h1>
      <p className="mb-6 mt-3 text-sm text-mute">Inicia sesión para respaldar y sincronizar tus entrenamientos entre dispositivos.</p>
      <AuthForm />
      <button type="button" className="mt-5 text-sm text-mute underline" onClick={onSkip}>Continuar sin cuenta (los datos quedan solo en este dispositivo)</button>
    </div>
  );
}
