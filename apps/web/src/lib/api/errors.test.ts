import { describe, expect, it } from 'vitest';

import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('maps API codes to Spanish messages', () => {
    expect(errorMessage('team_name_taken')).toBe('Ya existe un equipo con ese nombre.');
    expect(errorMessage('riot_account_taken')).toContain('ya está vinculada a otro usuario');
  });

  it('falls back to a generic message', () => {
    expect(errorMessage('something_new')).toBe('Algo salió mal. Inténtalo de nuevo.');
    expect(errorMessage(undefined)).toBe('Algo salió mal. Inténtalo de nuevo.');
  });
});
