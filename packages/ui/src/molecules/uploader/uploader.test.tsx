import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Uploader, type UploaderProps } from './uploader.js';

afterEach(cleanup);

const labels: UploaderProps['labels'] = {
  choose: 'Elegir imagen',
  tooLarge: 'La imagen pesa más de 2 MB.',
  invalidType: 'Usa PNG, JPG o WebP.',
};

function setup(onSelect = vi.fn(() => Promise.resolve())) {
  render(
    <Uploader
      label="Foto de perfil"
      accept={['image/png', 'image/jpeg']}
      maxBytes={1024}
      previewUrl={null}
      fallback="AN"
      labels={labels}
      onSelect={onSelect}
    />,
  );
  return { onSelect, input: screen.getByLabelText<HTMLInputElement>('Foto de perfil') };
}

describe('Uploader', () => {
  it('hands a valid image to onSelect', async () => {
    const { onSelect, input } = setup();
    const file = new File([new Uint8Array(10)], 'a.png', { type: 'image/png' });
    await userEvent.upload(input, file);
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(file);
    });
  });

  it('rejects files that are too large or of another type before uploading', async () => {
    const { onSelect, input } = setup();
    await userEvent.upload(
      input,
      new File([new Uint8Array(2048)], 'big.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', labels.tooLarge);

    const gif = new File([new Uint8Array(10)], 'a.gif', { type: 'image/gif' });
    // The accept attribute filters the picker; drop-in values are still checked.
    await userEvent.upload(input, gif, { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', labels.invalidType);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('offers a visible button for the hidden input', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Elegir imagen' })).toBeDefined();
  });
});
