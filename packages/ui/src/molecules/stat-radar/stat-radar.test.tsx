import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { radarPoints, StatRadar } from './stat-radar.js';

afterEach(cleanup);

const axes = [
  { key: 'aggression', label: 'Agresividad', value: 100 },
  { key: 'vision', label: 'Visión', value: 50 },
  { key: 'farming', label: 'Farm', value: 0 },
  { key: 'teamfight', label: 'Teamfight', value: 75 },
  { key: 'survival', label: 'Supervivencia', value: 120 },
];

describe('StatRadar', () => {
  it('draws the first axis straight up and clamps the values to 0–100', () => {
    expect(radarPoints([100, 0, 0, 0])).toBe('120.0,40.0 120.0,120.0 120.0,120.0 120.0,120.0');
    expect(radarPoints([150, 0, 0, 0])).toBe(radarPoints([100, 0, 0, 0]));
  });

  it('is an image with an accessible label and shows each axis with its value', () => {
    render(<StatRadar axes={axes} label="Radar de Ana" />);
    expect(screen.getByRole('img', { name: 'Radar de Ana' })).toBeTruthy();
    expect(screen.getByText('Agresividad').textContent).toBe('Agresividad100');
    expect(screen.getByText('Supervivencia').textContent).toBe('Supervivencia100');
  });

  it('draws the comparison series behind the main one', () => {
    const { container } = render(
      <StatRadar
        axes={axes}
        label="Ana vs Beto"
        compare={{ label: 'Beto', values: [10, 20, 30, 40, 50] }}
      />,
    );
    const series = [...container.querySelectorAll('[data-series]')].map((p) =>
      p.getAttribute('data-series'),
    );
    expect(series).toEqual(['compare', 'main']);
  });
});
