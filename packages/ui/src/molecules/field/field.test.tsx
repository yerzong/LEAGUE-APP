import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Textarea } from '../../atoms/textarea/textarea.js';
import { Field } from './field.js';

afterEach(cleanup);

describe('Field', () => {
  it('labels any control and describes it with hint and error', () => {
    render(
      <Field label="Biografía" hint="Máximo 280" error="Muy larga">
        {(control) => <Textarea {...control} />}
      </Field>,
    );
    const textarea = screen.getByLabelText('Biografía');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    const described = textarea.getAttribute('aria-describedby') ?? '';
    expect(described.split(' ').map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Máximo 280',
      'Muy larga',
    ]);
  });

  it('omits aria attributes when there is nothing to describe', () => {
    render(<Field label="Bio">{(control) => <Textarea {...control} />}</Field>);
    const textarea = screen.getByLabelText('Bio');
    expect(textarea.hasAttribute('aria-invalid')).toBe(false);
    expect(textarea.hasAttribute('aria-describedby')).toBe(false);
  });
});
