/**
 * Motion tokens for JS animations. Mirror of --duration-* / --ease-* in
 * styles/tokens.css (tokens.test.ts fails if they drift apart).
 */
export const motionTokens = {
  duration: { fast: 0.12, base: 0.2, slow: 0.4 },
  ease: {
    out: [0.16, 1, 0.3, 1],
    inOut: [0.65, 0, 0.35, 1],
  },
  /** Distance for slide entrances, in px. Small on purpose: subtle, not decorative. */
  offset: 8,
  stagger: 0.05,
} as const satisfies {
  duration: Record<string, number>;
  ease: Record<string, readonly [number, number, number, number]>;
  offset: number;
  stagger: number;
};
