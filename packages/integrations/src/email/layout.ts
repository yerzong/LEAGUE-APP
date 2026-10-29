// The HTML part of a notification email: the plain text body as paragraphs
// and a link to the platform. No styles or brand assets: the client renders it.

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

export function emailHtml(input: {
  readonly title: string;
  readonly body: string;
  readonly action: { readonly label: string; readonly url: string } | null;
  readonly footer: string;
}): string {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const action = input.action
    ? `<p><a href="${escapeHtml(input.action.url)}">${escapeHtml(input.action.label)}</a></p>`
    : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title></head><body>${paragraphs}${action}<hr><p><small>${escapeHtml(input.footer)}</small></p></body></html>`;
}
