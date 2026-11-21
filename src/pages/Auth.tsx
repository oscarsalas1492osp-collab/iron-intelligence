import { useEffect, useState, useSyncExternalStore } from 'react';
import { cancelRecovery, googleEnabled, googleKnown, isRecovering, onRecovering, requestPasswordReset, setNewPassword, signIn, signInWithGoogle, signUp } from '../data/sync';
import { Btn, Field, Seg, useAction, useUi } from '../ui/components';
import { Logo } from '../ui/Layout';

/** El botón de Google aparece solo cuando el servidor tiene activo ese proveedor. */
function useGoogle(): boolean {
  const [on, setOn] = useState(googleKnown);
  useEffect(() => { let live = true; void googleEnabled().then((v) => { if (live) setOn(v); }); return () => { live = false; }; }, []);
  return on;
}

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-mute ${className}`}>
      Al continuar aceptas los <a className="whitespace-nowrap underline" href="./terminos.html">Términos de uso</a> y la <a className="whitespace-nowrap underline" href="./privacidad.html">Política de privacidad</a>.
    </p>
  );
}

export function AuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const run = useAction(); const { toast } = useUi();
  const google = useGoogle(); const [leaving, setLeaving] = useState(false);
  const withGoogle = async () => {
    setLeaving(true);
    await run(signInWithGoogle);
    // Si todo va bien el navegador sale hacia Google; si no, se libera el botón.
    setTimeout(() => setLeaving(false), 4000);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'reset') {
      setBusy(true);
      const sent = await run(() => requestPasswordReset(email.trim()).then(() => 'sent' as const));
      setBusy(false);
      if (sent === 'sent') { toast('Si ese correo tiene una cuenta, llegará un enlace para elegir una contraseña nueva. Revisa también el correo no deseado.'); setMode('in'); }
      return;
    }
    if (password.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
    setBusy(true);
    const r = await run(() => (mode === 'in' ? signIn(email.trim(), password).then(() => 'ok' as const) : signUp(email.trim(), password)));
    setBusy(false);
    if (r === 'confirm') { toast('Cuenta creada. Abre el enlace que enviamos a tu correo y luego inicia sesión aquí.'); setMode('in'); }
    if (r === 'ok') { toast('Sesión iniciada. Tus datos se sincronizan.'); onDone?.(); }
  };
  if (mode === 'reset') {
    return (
      <form onSubmit={submit} className="space-y-3">
        <div>
          <h2 className="wd-x text-lg font-extrabold">Recuperar contraseña</h2>
          <p className="mt-1 text-sm text-mute">Escribe el correo de tu cuenta y te enviamos un enlace para elegir una contraseña nueva.</p>
        </div>
        <Field label="Correo"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Btn variant="primary" size="lg" className="w-full" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</Btn>
        <button type="button" className="block min-h-[44px] w-full text-center text-sm text-mute underline" onClick={() => setMode('in')}>Volver a iniciar sesión</button>
      </form>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {google && (
        <>
          <button type="button" onClick={withGoogle} disabled={leaving} className="flex h-12 w-full items-center justify-center rounded-ctl bg-chalk px-4 shadow-[0_10px_24px_-12px_rgba(255,255,255,.5)] text-[15px] font-bold text-ink transition active:scale-[.98] disabled:opacity-60">
            {leaving ? 'Abriendo Google…' : 'Continuar con Google'}
          </button>
          <div className="flex items-center gap-3 text-xs text-mute" aria-hidden><span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" /></div>
        </>
      )}
      <Seg value={mode} onChange={setMode} options={[{ value: 'in', label: 'Iniciar sesión' }, { value: 'up', label: 'Crear cuenta' }]} />
      <Field label="Correo"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Contraseña" hint="Mínimo 8 caracteres"><input type="password" required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Btn variant="primary" size="lg" className="w-full" type="submit" disabled={busy}>{busy ? 'Conectando…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</Btn>
      {mode === 'in' && <button type="button" className="block min-h-[44px] w-full text-center text-sm text-data underline" onClick={() => setMode('reset')}>¿Olvidaste tu contraseña?</button>}
      <LegalLinks />
    </form>
  );
}

/** Se llegó desde el enlace del correo de recuperación y falta elegir la contraseña nueva. */
export function useRecovering(): boolean {
  return useSyncExternalStore(onRecovering, isRecovering, () => false);
}

export function NewPassword() {
  const [password, setPassword] = useState(''); const [again, setAgain] = useState(''); const [busy, setBusy] = useState(false);
  const run = useAction(); const { toast } = useUi();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
    if (password !== again) { toast('Las dos contraseñas no coinciden', 'error'); return; }
    setBusy(true);
    const ok = await run(() => setNewPassword(password).then(() => 'ok' as const));
    setBusy(false);
    if (ok === 'ok') toast('Contraseña cambiada. Úsala desde ahora para entrar.');
  };
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="ambient" aria-hidden />
      <div className="mb-10"><Logo /></div>
      <h1 className="wd-x text-[2rem] font-black leading-[1.02] tracking-tight">Elige una contraseña nueva.</h1>
      <p className="mb-6 mt-3 text-[15px] text-mute">Llegaste desde el enlace de recuperación. Al guardarla, tu sesión queda iniciada en este dispositivo.</p>
      <form onSubmit={submit} className="space-y-3 rounded-panel bg-card p-4">
        <Field label="Contraseña nueva" hint="Mínimo 8 caracteres"><input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Repite la contraseña"><input type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
        <Btn variant="primary" size="lg" className="w-full" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</Btn>
      </form>
      <button type="button" className="mt-5 min-h-[44px] text-sm text-mute underline" onClick={cancelRecovery}>Ahora no</button>
    </div>
  );
}

export default function Auth({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="ambient" aria-hidden />
      <div className="mb-10"><Logo /></div>
      <h1 className="wd-x text-[2.6rem] font-black leading-[.98] tracking-tight">Registra.<br />Analiza.<br /><span className="text-fire">Progresa.</span></h1>
      <p className="mb-6 mt-4 text-[15px] text-mute">Inicia sesión para respaldar y sincronizar tus entrenamientos entre dispositivos.</p>
      <div className="rounded-panel bg-card p-4"><AuthForm /></div>
      <button type="button" className="mt-5 text-sm text-mute underline" onClick={onSkip}>Continuar sin cuenta (los datos quedan solo en este dispositivo)</button>
    </div>
  );
}
