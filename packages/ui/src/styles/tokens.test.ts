// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { motionTokens } from '../motion/tokens.js';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`Missing token --${name}`);
  return match[1].trim();
}

type Rgb = [number, number, number];

function hex(name: string): Rgb {
  const value = token(`color-${name}`).slice(1);
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
}

function rgba(name: string): { rgb: Rgb; alpha: number } {
  const match = /rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(token(name));
  if (!match) throw new Error(`--${name} is not rgb()`);
  const [, r, g, b, a] = match.map(Number) as [number, number, number, number, number];
  return { rgb: [r, g, b], alpha: a };
}

const over = (top: { rgb: Rgb; alpha: number }, bottom: Rgb): Rgb =>
  top.rgb.map((channel, i) => channel * top.alpha + (bottom[i] ?? 0) * (1 - top.alpha)) as Rgb;

function luminance(rgb: Rgb): number {
  const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const AA = 4.5;

describe('color tokens meet WCAG AA for normal text', () => {
  const surfaces = ['bg', 'surface', 'surface-2'];
  const texts = ['text', 'text-muted', 'brand', 'brand-dim', 'accent-femenil-text', 'danger'];

  for (const surface of surfaces) {
    for (const text of texts) {
      it(`${text} on ${surface}`, () => {
        expect(contrast(hex(text), hex(surface))).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  it('filled buttons: bg text on brand and on danger', () => {
    expect(contrast(hex('bg'), hex('brand'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(hex('bg'), hex('danger'))).toBeGreaterThanOrEqual(AA);
  });

  it('text and muted text on glass over the page background', () => {
    const glass = over(rgba('glass-background'), hex('bg'));
    expect(contrast(hex('text'), glass)).toBeGreaterThanOrEqual(AA);
    expect(contrast(hex('text-muted'), glass)).toBeGreaterThanOrEqual(AA);
  });

  it('text on glass even over the brightest content (photos, silver logo)', () => {
    const glass = over(rgba('glass-background'), [255, 255, 255]);
    expect(contrast(hex('text'), glass)).toBeGreaterThanOrEqual(AA);
  });
});

describe('motion tokens', () => {
  it('JS durations mirror the CSS tokens', () => {
    for (const [name, seconds] of Object.entries(motionTokens.duration)) {
      expect(token(`duration-${name}`)).toBe(`${String(seconds * 1000)}ms`);
    }
  });

  it('JS easings mirror the CSS tokens', () => {
    expect(token('ease-out')).toBe(`cubic-bezier(${motionTokens.ease.out.join(', ')})`);
    expect(token('ease-in-out')).toBe(`cubic-bezier(${motionTokens.ease.inOut.join(', ')})`);
  });
});
