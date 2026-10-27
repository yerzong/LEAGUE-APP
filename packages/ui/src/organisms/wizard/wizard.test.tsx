import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Wizard } from './wizard.js';

afterEach(cleanup);

const steps = [
  { id: 'basics', label: 'Básico' },
  { id: 'format', label: 'Formato' },
  { id: 'review', label: 'Revisión', state: 'locked' as const },
];

describe('Wizard', () => {
  it('marks the current step and lets any step be chosen', () => {
    const onStepChange = vi.fn();
    render(
      <Wizard
        steps={steps}
        current="format"
        onStepChange={onStepChange}
        label="Pasos"
        progress="Paso 2 de 3"
        footer={<button type="button">Siguiente</button>}
      >
        <p>Contenido</p>
      </Wizard>,
    );

    expect(screen.getByRole('navigation', { name: 'Pasos' })).toBeTruthy();
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy();
    const current = screen.getByRole('button', { name: /Formato/ });
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: /Básico/ }).dataset.state).toBe('complete');
    expect(screen.getByRole('button', { name: /Revisión/ }).dataset.state).toBe('locked');

    fireEvent.click(screen.getByRole('button', { name: /Básico/ }));
    expect(onStepChange).toHaveBeenCalledWith('basics');
    expect(screen.getByText('Contenido')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeTruthy();
  });
});
