import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = { title: 'Foundations/Tokens', parameters: { layout: 'padded' } } satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// Tailwind needs full class names in source, so swatches are listed explicitly.
const colors = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['border', 'bg-border'],
  ['brand', 'bg-brand'],
  ['brand-bright', 'bg-brand-bright'],
  ['brand-dim', 'bg-brand-dim'],
  ['text', 'bg-text'],
  ['text-muted', 'bg-text-muted'],
  ['team-blue', 'bg-team-blue'],
  ['team-red', 'bg-team-red'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['danger', 'bg-danger'],
] as const;

const accents = [
  ['Liga', 'bg-accent-league'],
  ['Ascenso', 'bg-accent-ascenso'],
  ['Relámpago', 'bg-accent-flash'],
  ['Femenil', 'bg-accent-femenil'],
  ['Universitario', 'bg-accent-uni'],
] as const;

const Swatches = ({ items }: { items: readonly (readonly [string, string])[] }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
    {items.map(([name, swatch]) => (
      <div key={name} className="flex flex-col gap-1">
        <div className={`h-12 rounded-sm border ${swatch}`} />
        <span className="text-xs text-text-muted">{name}</span>
      </div>
    ))}
  </div>
);

export const Colors: Story = { render: () => <Swatches items={colors} /> };
export const CircuitAccents: Story = { render: () => <Swatches items={accents} /> };
export const Typography: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="font-display text-5xl font-extrabold text-brand caps">Display 5xl</p>
      <p className="font-display text-3xl font-bold caps">Display 3xl</p>
      <p className="text-xl">Inter xl — cuerpo grande</p>
      <p className="text-base">Inter base — texto de lectura</p>
      <p className="text-sm text-text-muted">Inter sm — secundario</p>
      <p className="text-2xl tabular">12 / 1 / 9 · 1,234,567</p>
    </div>
  ),
};
