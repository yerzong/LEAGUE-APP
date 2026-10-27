import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '../../atoms/button/button.js';
import { Wizard } from './wizard.js';

const steps = [
  { id: 'basics', label: 'Básico' },
  { id: 'participants', label: 'Participantes' },
  { id: 'format', label: 'Formato', state: 'invalid' as const },
  { id: 'prizes', label: 'Premios', state: 'locked' as const },
  { id: 'review', label: 'Revisión' },
];

function Demo() {
  const [current, setCurrent] = useState('participants');
  const index = steps.findIndex((s) => s.id === current);
  return (
    <Wizard
      steps={steps}
      current={current}
      onStepChange={setCurrent}
      label="Pasos del asistente"
      progress={`Paso ${String(index + 1)} de ${String(steps.length)}`}
      footer={
        <>
          <Button variant="ghost">Anterior</Button>
          <div className="flex gap-2">
            <Button variant="outline">Guardar borrador</Button>
            <Button>Siguiente</Button>
          </div>
        </>
      }
    >
      <p className="text-text-muted">Contenido del paso «{steps[index]?.label}».</p>
    </Wizard>
  );
}

const meta = {
  title: 'Organisms/Wizard',
  component: Wizard,
  render: () => <Demo />,
  args: {
    steps,
    current: 'basics',
    onStepChange: () => undefined,
    label: 'Pasos',
    progress: 'Paso 1 de 5',
    children: null,
  },
} satisfies Meta<typeof Wizard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
