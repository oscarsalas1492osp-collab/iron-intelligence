// Eliminación de datos y mensajes del inicio de sesión con Google.
import { beforeEach, describe, expect, it } from 'vitest';
import { db, getUserId, setUserId } from '../data/db';
import * as repo from '../data/repo';
import { deleteAccount, googleEnabled, oauthMessage, wipeLocal } from '../data/sync';
import { resetDb } from './helpers';

beforeEach(resetDb);

describe('borrado de datos', () => {
  it('borra solo lo del usuario indicado y sus marcas de sincronización', async () => {
    await repo.createRoutine('Mía');
    setUserId('otra');
    await repo.createRoutine('De otra persona');
    await db.meta.bulkPut([{ key: 'cursor:otra:routines', value: 'x' }, { key: 'lastBackup:otra', value: 1 }, { key: 'cursor:local:routines', value: 'y' }]);
    await wipeLocal('otra');
    const left = await db.routines.toArray();
    expect(left.map((r) => r.name)).toEqual(['Mía']);
    expect((await db.meta.toCollection().primaryKeys()).sort()).toEqual(['cursor:local:routines']);
  });

  it('sin cuenta, eliminar borra los datos del dispositivo y la app sigue en modo local', async () => {
    setUserId('local');
    const r = await repo.createRoutine('Torso');
    await repo.saveRecovery({ sleepHours: 7, sleepQuality: 4, fatigue: 2, soreness: 2, motivation: 4, stress: 2 });
    await deleteAccount();
    expect(await db.routines.get(r.id)).toBeUndefined();
    expect(await db.recovery.count()).toBe(0);
    expect(getUserId()).toBe('local');
  });

  it('con cuenta pero sin servidor configurado no borra nada', async () => {
    setUserId('u1');
    const r = await repo.createRoutine('Pierna');
    await expect(deleteAccount()).rejects.toThrow(/no está configurada/);
    expect(await db.routines.get(r.id)).toBeDefined();
    expect(getUserId()).toBe('u1');
  });
});

describe('inicio de sesión con Google', () => {
  it('sin servidor configurado el botón no se ofrece', async () => {
    expect(await googleEnabled()).toBe(false);
  });
  it('traduce los errores con que vuelve el proveedor', () => {
    expect(oauthMessage('access_denied', 'The user denied access')).toMatch(/No se completó/);
    expect(oauthMessage('validation_failed', 'Unsupported provider: provider is not enabled')).toMatch(/aún no está activado/);
    expect(oauthMessage('server_error', 'Algo falló')).toBe('No se pudo iniciar sesión con Google: Algo falló');
    // Un enlace de correo vencido no se confunde con un fallo de Google.
    expect(oauthMessage('otp_expired', 'Email link is invalid or has expired')).toMatch(/enlace del correo venció/);
  });
});
