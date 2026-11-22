import { describe, expect, it } from 'vitest';
import { gateOf, type AccessSnapshot } from '../data/access';
import { invitacion, lanzamiento, prueba } from '../../supabase/functions/correo/plantillas';

const snap = (s: Partial<AccessSnapshot>): AccessSnapshot => ({ mode: null, uid: 'local', allowed: null, at: 0, ...s });

describe('entrada con invitación', () => {
  it('sin servidor configurado la app queda abierta', () => {
    expect(gateOf(snap({}), 'local', false, false)).toBe('open');
  });
  it('mientras no responde el servidor y no hay nada guardado, espera', () => {
    expect(gateOf(snap({}), 'local', true, false)).toBe('checking');
  });
  it('si el servidor no respondió y no hay nada guardado, queda cerrada', () => {
    expect(gateOf(snap({}), 'local', true, true)).toBe('guest');
    expect(gateOf(snap({}), 'u1', true, true)).toBe('unknown');
  });
  it('en modo abierto entra cualquiera, con o sin cuenta', () => {
    expect(gateOf(snap({ mode: 'open' }), 'local', true, false)).toBe('open');
    expect(gateOf(snap({ mode: 'open' }), 'u1', true, true)).toBe('open');
  });
  it('en modo invitación, sin cuenta se pide entrar', () => {
    expect(gateOf(snap({ mode: 'invite' }), 'local', true, true)).toBe('guest');
  });
  it('en modo invitación entra la cuenta con acceso y se frena la que no lo tiene', () => {
    expect(gateOf(snap({ mode: 'invite', uid: 'u1', allowed: true }), 'u1', true, true)).toBe('allowed');
    expect(gateOf(snap({ mode: 'invite', uid: 'u1', allowed: false }), 'u1', true, true)).toBe('denied');
  });
  it('lo guardado de una cuenta con acceso sirve sin conexión', () => {
    expect(gateOf(snap({ mode: 'invite', uid: 'u1', allowed: true }), 'u1', true, false)).toBe('allowed');
  });
  it('lo guardado de otra cuenta no vale para la que acaba de entrar', () => {
    expect(gateOf(snap({ mode: 'invite', uid: 'u1', allowed: true }), 'u2', true, false)).toBe('checking');
    expect(gateOf(snap({ mode: 'invite', uid: 'u1', allowed: true }), 'u2', true, true)).toBe('unknown');
  });
});

describe('correos de la app', () => {
  const todos = [invitacion({ email: 'ana@example.com', tipo: 'tester', respuestas: true }), invitacion({ email: 'ana@example.com', tipo: 'guest', respuestas: false }), lanzamiento({ link: 'https://play.google.com/store/apps/details?id=x', respuestas: false }), prueba()];
  it('cada correo trae asunto, texto y HTML completos', () => {
    for (const c of todos) {
      expect(c.subject.length).toBeGreaterThan(10);
      expect(c.text).not.toMatch(/undefined|\[object/);
      expect(c.html).toMatch(/^<!doctype html>/);
      expect(c.html).not.toMatch(/undefined|\[object/);
    }
  });
  it('la invitación dice con qué correo crear la cuenta y lleva a la app', () => {
    const c = invitacion({ email: 'ana@example.com', tipo: 'tester', respuestas: true });
    expect(c.text).toContain('ana@example.com');
    expect(c.text).toContain('https://app.ironintelligence.app');
    expect(c.text).toContain('Puedes responder a este mismo correo.');
    expect(invitacion({ email: 'ana@example.com', tipo: 'tester', respuestas: false }).text).not.toContain('responder a este mismo correo');
  });
  it('el aviso de lanzamiento lleva el link de descarga y no deja pasar HTML en él', () => {
    expect(lanzamiento({ link: 'https://ejemplo.app/descarga', respuestas: false }).text).toContain('https://ejemplo.app/descarga');
    expect(lanzamiento({ link: 'https://x.app/"><script>', respuestas: false }).html).not.toContain('<script>');
  });
  it('ningún correo usa signos de exclamación ni la redacción antigua', () => {
    for (const c of todos) expect(c.text).not.toMatch(/[!¡]|deja tu correo|enlace en el perfil/i);
  });
});
