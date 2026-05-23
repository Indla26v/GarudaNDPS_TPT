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
