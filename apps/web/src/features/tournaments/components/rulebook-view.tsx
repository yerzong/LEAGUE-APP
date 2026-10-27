/**
 * Renders a rulebook written with `#` headings, `-` lists and blank lines
 * between paragraphs. Plain React text: no HTML from the content is trusted.
 */
export function RulebookView({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className="flex max-w-prose flex-col gap-3 text-text">
      {blocks.map((block, index) => {
        const key = String(index);
        const lines = block.split('\n').filter((line) => line.trim() !== '');
        const first = lines[0] ?? '';
        if (lines.length === 1 && first.startsWith('## '))
          return (
            <h4 key={key} className="font-display text-lg font-bold">
              {first.slice(3)}
            </h4>
          );
        if (lines.length === 1 && first.startsWith('# '))
          return (
            <h3 key={key} className="font-display text-xl font-bold caps">
              {first.slice(2)}
            </h3>
          );
        if (lines.every((line) => line.startsWith('- ')))
          return (
            <ul key={key} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((line, i) => (
                <li key={String(i)}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        return (
          <p key={key} className="whitespace-pre-line">
            {lines.join('\n')}
          </p>
        );
      })}
    </div>
  );
}
