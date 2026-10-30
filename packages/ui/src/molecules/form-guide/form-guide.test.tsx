import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FormGuide } from './form-guide.js';

afterEach(cleanup);

const labels = { win: { short: 'V', long: 'Victoria' }, loss: { short: 'D', long: 'Derrota' } };

describe('FormGuide', () => {
  it('shows each result with its letter and accessible name', () => {
    render(<FormGuide label="Forma reciente" results={['win', 'loss', 'win']} labels={labels} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(['V', 'D', 'V']);
    expect(items[1]?.getAttribute('aria-label')).toBe('Derrota');
    expect(screen.getByRole('list', { name: 'Forma reciente' })).toBeTruthy();
  });
});
