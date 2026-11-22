import { beforeEach, describe, expect, it } from 'vitest';
import { tr, useDictionary } from '../i18n';
import en from '../i18n/en.json';
import pt from '../i18n/pt.json';

describe('idiomas: motor de traducción', () => {
  beforeEach(() => useDictionary('en', {
    Pecho: 'Chest', Hombros: 'Shoulders', 'Máquina guiada': 'Guided machine', Guardar: 'Save',
    'Sube a {*} kg': 'Go up to {*} kg', '{*} de {*}': '{*} of {*}', 'Aumentar {*}': 'Increase {*}', 'Peso serie {*}': 'Weight, set {*}',
  }));

  it('en español devuelve el texto tal cual', () => {
    useDictionary('es', {});
    expect(tr('Guardar')).toBe('Guardar');
  });
  it('traduce el texto exacto y respeta los espacios de los bordes', () => {
    expect(tr('Guardar')).toBe('Save');
    expect(tr('  Guardar ')).toBe('  Save ');
  });
  it('acepta la otra capitalización, el signo final y los paréntesis', () => {
    expect(tr('máquina guiada')).toBe('guided machine');
    expect(tr('Guardar:')).toBe('Save:');
    expect(tr('(Pecho)')).toBe('(Chest)');
  });
  it('rellena plantillas y pasa los números al formato inglés', () => {
    expect(tr('Sube a 82,5 kg')).toBe('Go up to 82.5 kg');
    expect(tr('3 de 5')).toBe('3 of 5');
  });
  it('una plantilla corta no se aplica a textos que no conoce', () => {
    expect(tr('Curl de bíceps')).toBe('Curl de bíceps');
  });
  it('traduce los valores de una plantilla', () => {
    expect(tr('Aumentar Peso serie 2')).toBe('Increase Weight, set 2');
  });
  it('traduce listas armadas al mostrar', () => {
    expect(tr('Pecho, Hombros')).toBe('Chest, Shoulders');
    expect(tr('Pecho y Hombros')).toBe('Chest and Shoulders');
  });
  it('lo que no conoce vuelve sin cambios', () => {
    expect(tr('Texto desconocido')).toBe('Texto desconocido');
  });
});

describe('idiomas: diccionarios', () => {
  const holes = (s: string) => (s.match(/\{\*\}/g) ?? []).length;
  it('inglés y portugués cubren los mismos textos', () => {
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  });
  it('cada plantilla conserva la cantidad de valores', () => {
    for (const d of [en, pt] as Record<string, string>[]) for (const [k, v] of Object.entries(d)) expect([k, holes(v)]).toEqual([k, holes(k)]);
  });
  it('ninguna traducción queda vacía', () => {
    for (const d of [en, pt] as Record<string, string>[]) for (const [k, v] of Object.entries(d)) expect([k, v.trim().length > 0]).toEqual([k, true]);
  });
});
