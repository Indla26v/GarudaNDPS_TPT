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
