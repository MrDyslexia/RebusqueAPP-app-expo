const MAX_RUT_BODY_LENGTH = 8;

type RutInputParts = {
  body: string;
  checkDigit: string;
  hasSeparator: boolean;
};

export type RutValidationResult =
  | {
      valid: true;
      canonical: string;
      formatted: string;
    }
  | {
      valid: false;
    };

function parseRutInput(input: string): RutInputParts | null {
  if (!/^[\dKk.-]*$/.test(input)) {
    return null;
  }

  const compactInput = input.replaceAll('.', '');
  const separatorCount = compactInput.split('-').length - 1;

  if (separatorCount > 1) {
    return null;
  }

  if (separatorCount === 1) {
    const [body, checkDigit] = compactInput.split('-');

    if (
      body === undefined ||
      checkDigit === undefined ||
      !/^\d{0,8}$/.test(body) ||
      !/^[\dKk]?$/.test(checkDigit)
    ) {
      return null;
    }

    return { body, checkDigit: checkDigit.toUpperCase(), hasSeparator: true };
  }

  if (!/^\d*[Kk]?$/.test(compactInput)) {
    return null;
  }

  if (/[Kk]$/.test(compactInput)) {
    const body = compactInput.slice(0, -1);

    if (body.length > MAX_RUT_BODY_LENGTH) {
      return null;
    }

    return { body, checkDigit: 'K', hasSeparator: true };
  }

  if (compactInput.length > MAX_RUT_BODY_LENGTH + 1) {
    return null;
  }

  if (compactInput.length === MAX_RUT_BODY_LENGTH + 1) {
    return {
      body: compactInput.slice(0, -1),
      checkDigit: compactInput.slice(-1),
      hasSeparator: true,
    };
  }

  return { body: compactInput, checkDigit: '', hasSeparator: false };
}

function formatRutBody(body: string): string {
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function calculateCheckDigit(body: string): string {
  let factor = 2;
  let sum = 0;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) {
    return '0';
  }

  if (remainder === 10) {
    return 'K';
  }

  return String(remainder);
}

export function formatChileanRutInput(input: string): string | null {
  const parts = parseRutInput(input);

  if (!parts) {
    return null;
  }

  const formattedBody = formatRutBody(parts.body);

  if (!parts.hasSeparator) {
    return formattedBody;
  }

  return `${formattedBody}-${parts.checkDigit}`;
}

export function validateChileanRut(input: string): RutValidationResult {
  const parts = parseRutInput(input);

  if (!parts || parts.body.length === 0 || parts.checkDigit.length !== 1) {
    return { valid: false };
  }

  const expectedCheckDigit = calculateCheckDigit(parts.body);

  if (parts.checkDigit !== expectedCheckDigit) {
    return { valid: false };
  }

  const canonical = `${parts.body}-${parts.checkDigit}`;

  return {
    valid: true,
    canonical,
    formatted: `${formatRutBody(parts.body)}-${parts.checkDigit}`,
  };
}
