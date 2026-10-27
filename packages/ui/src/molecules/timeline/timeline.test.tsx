import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Timeline } from './timeline.js';

afterEach(cleanup);

describe('Timeline', () => {
  it('lists the events in order with their details', () => {
    render(
      <Timeline
        label="Auditoría"
        items={[
          { id: '2', title: 'Aprobó una inscripción', meta: 'admin · hoy', description: 'Aurora' },
          { id: '1', title: 'Publicó el torneo', meta: 'admin · ayer' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Auditoría' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('Aprobó una inscripción');
    expect(screen.getByText('Aurora')).toBeTruthy();
  });
});
