import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SectionHeading } from '../../molecules/section-heading/section-heading.js';
import { Hero } from './hero.js';

afterEach(cleanup);

describe('Hero and SectionHeading', () => {
  it('give the page one h1 and h2 section titles', () => {
    render(
      <>
        <Hero
          eyebrow="Temporada 1"
          title="Liga"
          description="Compite."
          actions={<a href="/torneos">Explorar torneos</a>}
          media={<img src="/logo.svg" alt="" />}
        />
        <SectionHeading id="teams" title="Equipos destacados" action={<a href="/e">Ver</a>} />
      </>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Liga' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Equipos destacados' }).id).toBe('teams');
    expect(screen.getByRole('link', { name: 'Explorar torneos' })).toBeTruthy();
  });
});
