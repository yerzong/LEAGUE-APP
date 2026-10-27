/** URL-safe slug: "Águilas del Norte" → "aguilas-del-norte"; `fallback` when nothing is left. */
export function toSlug(text: string, fallback: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? fallback : slug;
}

/** `base`, or `base-2`, `base-3`… until `exists` says it is free. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base;
  for (let n = 2; await exists(slug); n += 1) slug = `${base}-${String(n)}`;
  return slug;
}
