import { describe, expect, test } from 'bun:test';

import { formatChileanRutInput, validateChileanRut } from './chilean-rut';

describe('Chilean RUT utility', () => {
  test('normalizes and formats a valid RUT with a K check digit', () => {
    expect(validateChileanRut('30.111.222-k')).toEqual({
      valid: true,
      canonical: '30111222-K',
      formatted: '30.111.222-K',
    });
  });

  test('formats partial input as it is typed', () => {
    expect(formatChileanRutInput('30111222')).toBe('30.111.222');
    expect(formatChileanRutInput('30111222k')).toBe('30.111.222-K');
  });

  test('rejects invalid, incomplete, and overlong RUT values', () => {
    expect(validateChileanRut('30.111.222-1')).toEqual({ valid: false });
    expect(validateChileanRut('30.111.222-')).toEqual({ valid: false });
    expect(validateChileanRut('301112223-K')).toEqual({ valid: false });
    expect(formatChileanRutInput('30.111.222-A')).toBeNull();
  });
});
