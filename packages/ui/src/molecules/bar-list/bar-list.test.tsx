import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BarList } from './bar-list.js';

afterEach(cleanup);

describe('BarList', () => {
  it('lists the items in order with bars relative to the largest value', () => {
    const { container } = render(
      <BarList
        label="Mejor KDA"
        items={[
          { key: 'a', label: 'Ana', value: 8, display: '8.0' },
          { key: 'b', label: 'Beto', value: 4, display: '4.0', hint: '6 games' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Mejor KDA' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    const widths = [...container.querySelectorAll('[data-bar]')].map((b) =>
      b.getAttribute('width'),
    );
    expect(widths).toEqual(['100.0%', '50.0%']);
    expect(screen.getByText('6 games')).toBeTruthy();
  });

  it('uses the given maximum and survives empty values', () => {
    const { container } = render(
      <BarList
        label="Winrate"
        max={1}
        items={[{ key: 'a', label: 'Ahri', value: 0.25, display: '25 %' }]}
      />,
    );
    expect(container.querySelector('[data-bar]')?.getAttribute('width')).toBe('25.0%');
    cleanup();
    const empty = render(
      <BarList label="Nada" items={[{ key: 'a', label: 'A', value: 0, display: '0' }]} />,
    );
    expect(empty.container.querySelector('[data-bar]')?.getAttribute('width')).toBe('0.0%');
  });
});
