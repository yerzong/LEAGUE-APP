/**
 * Brand configuration. Temporary source of the name and logo until they come
 * from the organization's data (`organizations` / `brand_themes`).
 * Components read the brand from here, never inline.
 */
export const brand = {
  name: 'PENTA League',
  logo: {
    src: '/brand/PentaLeague_Plata.svg',
    width: 240,
    height: 240,
  },
} as const;

export type Brand = typeof brand;
