import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../../atoms/button/button.js';
import { ConfirmDialog } from './confirm-dialog.js';

afterEach(cleanup);

const base = {
  trigger: <Button>Anular resultado</Button>,
  title: '¿Anular el resultado?',
  description: 'Queda en auditoría.',
  confirmLabel: 'Anular',
  cancelLabel: 'Cancelar',
};

describe('ConfirmDialog', () => {
  it('requires a reason before confirming a sensitive action', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog {...base} reason={{ label: 'Motivo', minLength: 5 }} onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole('button', { name: 'Anular resultado' }));
    const confirm = screen.getByRole('button', { name: 'Anular' });
    expect(confirm).toHaveProperty('disabled', true);

    await user.type(screen.getByLabelText('Motivo'), '  Error de captura  ');
    expect(confirm).toHaveProperty('disabled', false);
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith('Error de captura');
  });

  it('confirms without a reason when none is configured', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Anular resultado' }));
    await user.click(screen.getByRole('button', { name: 'Anular' }));

    expect(onConfirm).toHaveBeenCalledWith(null);
  });
});
