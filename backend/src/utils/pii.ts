/** PII masking helpers (Phase 1). */

export function maskAadhaar(aadhaar: string | null | undefined): string | null {
  if (!aadhaar) return null;
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

export function canRevealAadhaar(role: string): boolean {
  return ['ADMIN', 'SP', 'ASP', 'DSP', 'CI'].includes(role);
}

export function canExportOffenders(role: string): boolean {
  return ['ADMIN', 'SP', 'ASP', 'DSP', 'CI', 'SI'].includes(role);
}

/**
 * Mask a bank account / financial identifier, keeping only the last 4 chars.
 * e.g. "1234567890" -> "••••7890". Used for finance transaction listings.
 */
export function maskAccount(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (s.length <= 4) return '••••';
  return '••••' + s.slice(-4);
}

/** Mask a mobile number, keeping the last 4 digits. e.g. "9876543210" -> "XXXXXX3210". */
export function maskMobile(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).replace(/\s+/g, '');
  if (s.length <= 4) return 'XXXX';
  return 'X'.repeat(s.length - 4) + s.slice(-4);
}

/** Mask an IMEI string, keeping the last 4 digits. e.g. "356938035643809" -> "IMEI-*****3809". */
export function maskImei(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (s.length <= 4) return 'IMEI-****';
  return 'IMEI-*****' + s.slice(-4);
}
