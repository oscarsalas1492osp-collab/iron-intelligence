// Pantallas de la entrada con invitación: la cuenta que todavía no tiene acceso y la que no se pudo comprobar.
import { useState } from 'react';
import { refreshAccess } from '../data/access';
import { signOut } from '../data/sync';
import { useUserId } from '../hooks';
import { Btn, useAction } from '../ui/components';
import { Logo } from '../ui/Layout';
import { LangSwitch } from '../ui/lang';

/** Página pública donde cualquiera se inscribe para recibir el link el día del lanzamiento. */
export const SIGNUP_URL = 'https://ironintelligence.app/#aviso';

function Shell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="ambient" aria-hidden />
      <div className="mb-10"><Logo /></div>
      <h1 className="wd-x text-[2rem] font-black leading-[1.04] tracking-tight">{title}</h1>
      <p className="mb-6 mt-3 text-[15px] text-mute">{text}</p>
      <div className="grid gap-2">{children}</div>
      <div className="mt-8"><LangSwitch compact /></div>
    </div>
  );
}

function SignOut() {
  const run = useAction(); const [busy, setBusy] = useState(false);
  return <Btn size="lg" className="w-full" disabled={busy} onClick={() => { setBusy(true); void run(signOut).finally(() => setBusy(false)); }}>Cerrar sesión</Btn>;
}

/** La cuenta existe, pero su correo no tiene invitación vigente. */
export function NoAccess() {
  return (
    <Shell title="Tu cuenta todavía no tiene invitación." text="La app sale pronto. Inscríbete en la página y te llega un correo con el link el día del lanzamiento.">
      <a href={SIGNUP_URL} className="btn-fire inline-flex h-14 w-full items-center justify-center rounded-[20px] px-5 text-[15px] font-extrabold tracking-wide text-ink wd-w transition active:scale-[.97]">Inscribirme</a>
      <SignOut />
    </Shell>
  );
}

/** No hubo respuesta del servidor y en este dispositivo no hay nada guardado sobre esta cuenta. */
export function AccessUnknown() {
  const uid = useUserId(); const [busy, setBusy] = useState(false);
  return (
    <Shell title="No se pudo comprobar tu invitación." text="Revisa tu conexión y vuelve a intentarlo.">
      <Btn variant="primary" size="lg" className="w-full" disabled={busy} onClick={() => { setBusy(true); void refreshAccess(uid).finally(() => setBusy(false)); }}>{busy ? 'Comprobando tu acceso…' : 'Reintentar'}</Btn>
      <SignOut />
    </Shell>
  );
}

export function AccessChecking() {
  return <div className="grid h-full min-h-[60vh] place-items-center text-sm text-mute" role="status">Comprobando tu acceso…</div>;
}
