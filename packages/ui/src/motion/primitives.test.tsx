// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FadeIn, SlideUp, Stagger, StaggerItem } from './primitives.js';

afterEach(cleanup);

describe('motion primitives', () => {
  it('start hidden and animate in', () => {
    render(<SlideUp>Contenido</SlideUp>);

    expect(screen.getByText('Contenido').style.opacity).toBe('0');
  });

  it('mark every animated element for the reduced-motion override', () => {
    render(
      <>
        <FadeIn>Fade</FadeIn>
        <SlideUp>Slide</SlideUp>
        <Stagger>
          <StaggerItem>Item</StaggerItem>
        </Stagger>
      </>,
    );

    for (const text of ['Fade', 'Slide', 'Item']) {
      expect(screen.getByText(text).hasAttribute('data-motion')).toBe(true);
    }
  });

  it('the stylesheet forces the final state with prefers-reduced-motion', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8').replace(
      /\s+/g,
      ' ',
    );

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{.*\[data-motion\] \{ opacity: 1 !important; transform: none !important; \}/,
    );
  });
});
