import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TrendBars } from './trend-bars.js';

afterEach(cleanup);

describe('TrendBars', () => {
  it('draws one bar per point, the largest at full height', () => {
    const { container } = render(
      <TrendBars
        label="KDA por semana"
        points={[
          { key: '1', label: '5 oct', value: 2, display: '2.0' },
          { key: '2', label: '12 oct', value: 4, display: '4.0' },
        ]}
      />,
    );
    expect(
      screen.getByRole('list', { name: 'KDA por semana' }).querySelectorAll('li'),
    ).toHaveLength(2);
    const heights = [...container.querySelectorAll('[data-bar]')].map((b) =>
      b.getAttribute('height'),
    );
    expect(heights).toEqual(['48', '96']);
    expect(screen.getByText('12 oct')).toBeTruthy();
  });
});
