import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from './button.js';

afterEach(cleanup);

describe('Button', () => {
  it('renders a non-submitting button by default', () => {
    render(<Button>Inscribir</Button>);
    expect(screen.getByRole('button', { name: 'Inscribir' }).getAttribute('type')).toBe('button');
  });

  it('calls onClick when pressed', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Inscribir</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies variant classes and keeps custom ones', () => {
    render(
      <Button variant="secondary" className="w-full">
        Ver
      </Button>,
    );
    const { className } = screen.getByRole('button');
    expect(className).toContain('bg-surface');
    expect(className).toContain('w-full');
  });
});
