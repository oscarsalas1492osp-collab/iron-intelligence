// Panel: la pestaña de planes muestra el ajuste del servidor y guarda solo valores válidos.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiProvider } from '../ui/components';

const cfg = {
  enabled: false, trial_days: 7, card_trial_days: 21, free_routines: 2, free_history_days: 30, free_custom_exercises: 3,
  pro_only: ['supersets', 'techniques', 'suggestions', 'templates', 'warmup', 'recovery', 'assistant'],
  prices: { CLP: { monthly: 4990, yearly: 39990 }, USD: { monthly: 4.99, yearly: 39.99 } },
};
const setPlans = vi.fn(async (c: Record<string, unknown>) => ({ ...cfg, ...c }));
vi.mock('../panel/api', () => ({ plans: vi.fn(async () => cfg), setPlans: (c: Record<string, unknown>) => setPlans(c) }));

import { Planes } from '../panel/Panel';

beforeEach(() => setPlans.mockClear());

describe('panel: planes', () => {
  it('carga los valores, y guarda el límite de rutinas y las funciones que cambian', async () => {
    const user = userEvent.setup();
    render(<UiProvider><Planes /></UiProvider>);
    expect(await screen.findByText('El cobro está apagado.')).toBeInTheDocument();
    expect(screen.getByLabelText('Rutinas propias')).toHaveValue('2');
    expect(screen.getByRole('button', { name: 'Guardar planes' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Aumentar Rutinas propias' }));
    await user.click(screen.getByLabelText('Calentamiento calculado: solo Pro'));
    expect(screen.getByText('6 funciones solo Pro')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar planes' }));

    await waitFor(() => expect(setPlans).toHaveBeenCalledTimes(1));
    const sent = setPlans.mock.calls[0][0];
    expect(sent.free_routines).toBe(3);
    expect(sent.pro_only).toEqual(['supersets', 'techniques', 'suggestions', 'templates', 'recovery', 'assistant']);
    expect(sent.prices).toEqual({ CLP: { monthly: 4990, yearly: 39990 }, USD: { monthly: 4.99, yearly: 39.99 } });
    expect('enabled' in sent).toBe(false);
  });
});
