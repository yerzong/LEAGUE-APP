/**
 * Replaces `{name}` placeholders with values. Unknown placeholders are kept
 * as-is so a missing value is visible instead of silently rendering "".
 */
export function format(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = values[key];
    return value === undefined ? placeholder : String(value);
  });
}
