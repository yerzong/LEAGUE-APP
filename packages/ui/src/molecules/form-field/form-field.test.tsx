import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FormField } from './form-field.js';

afterEach(cleanup);

describe('FormField', () => {
  it('associates the label with the input', () => {
    render(<FormField label="Correo" name="email" />);
    expect(screen.getByLabelText('Correo').getAttribute('name')).toBe('email');
  });

  it('marks the input invalid and describes it with the error', () => {
    render(<FormField label="Correo" error="Correo inválido" />);
    const input = screen.getByLabelText('Correo');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Correo inválido').id).toBe(input.getAttribute('aria-describedby'));
  });
});
