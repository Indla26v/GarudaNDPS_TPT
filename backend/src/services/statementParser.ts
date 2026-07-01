/**
 * GARUDA — Bank/UPI Statement Parser (Finance Intelligence, Page 6)
 *
 * Parses uploaded statement files (CSV / XLSX / PDF) into normalized
 * transaction rows. CSV and XLSX are handled by the `xlsx` library (already a
 * project dependency); PDF uses `pdf-parse` with best-effort line heuristics.
 *
 * Normalization rules (per spec):
 *  - dates normalized to JS Date (day-first, Indian bank conventions)
 *  - Debit/Credit split into `amount` + `direction`
 *  - counterparty extracted from narration (UPI handle etc.)
 *  - amounts stripped of commas / currency symbols
 */
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';

export type ParsedDirection = 'INCOMING' | 'OUTGOING';
export type ParsedMode = 'BANK' | 'UPI' | 'CASH' | 'WALLET' | 'NEFT' | 'RTGS' | 'IMPS';

export interface ParsedTransaction {
  amount: number;
  txn_date: Date;
  direction: ParsedDirection;
  txn_mode: ParsedMode;
  counterparty_name: string | null;
  counterparty_account: string | null;
  narration: string | null;
  transaction_ref: string | null;
  balance_after: number | null;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  detectedColumns: string[];
  sampleRows: Record<string, unknown>[];
  errors: string[];
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function normalizeAmount(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/** Build a UTC-midnight Date so Postgres @db.Date columns don't shift by a day. */
function mkUTC(y: number, mon0: number, day: number): Date | null {
  if (isNaN(y) || isNaN(mon0) || isNaN(day)) return null;
  const d = new Date(Date.UTC(y, mon0, day));
  return isNaN(d.getTime()) ? null : d;
}

function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  // Real Date (e.g. from xlsx cellDates) -> normalize to UTC midnight of its calendar date
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return mkUTC(v.getFullYear(), v.getMonth(), v.getDate());
  }
  // Excel serial number (days since 1899-12-30)
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : mkUTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const s = String(v).trim();

  // ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return mkUTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  // DD-MMM-YYYY (e.g. 05-Jun-2026)
  m = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/](\d{2,4})/);
  if (m) {
    const mon = MONTHS[(m[2] || '').toLowerCase()];
    if (mon !== undefined) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      return mkUTC(y, mon, Number(m[1]));
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY (day-first — Indian bank convention)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return mkUTC(y, Number(m[2]) - 1, Number(m[1]));
  }

  const dd = new Date(s);
  return isNaN(dd.getTime()) ? null : mkUTC(dd.getFullYear(), dd.getMonth(), dd.getDate());
}

/** Minimal CSV line splitter with basic double-quote handling. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function extractCounterparty(narration: string): { name: string | null; account: string | null } {
  if (!narration) return { name: null, account: null };
  const n = narration.trim();
  // UPI handle: something@bank
  const upi = n.match(/([a-zA-Z0-9.\-_]+@[a-zA-Z]{2,})/);
  if (upi && upi[1]) {
    const handle = upi[1];
    const namePart = (handle.split('@')[0] || '').replace(/[._\-]+/g, ' ').trim();
    return { name: namePart || null, account: handle };
  }
  // NEFT/IMPS style: NEFT-HDFC0001234-JOHN DOE-...
  const parts = n.split(/[\/|\-]/).map((p) => p.trim()).filter(Boolean);
  const nameTok = parts.find(
    (p) => /^[A-Za-z][A-Za-z .]{2,}$/.test(p) && !/^(NEFT|RTGS|IMPS|UPI|CR|DR|BANK|TRANSFER|PAYMENT|TO|FROM)$/i.test(p)
  );
  return { name: nameTok || null, account: null };
}

function detectMode(narration: string): ParsedMode {
  const n = (narration || '').toUpperCase();
  if (/\bUPI\b/.test(n)) return 'UPI';
  if (/\bNEFT\b/.test(n)) return 'NEFT';
  if (/\bRTGS\b/.test(n)) return 'RTGS';
  if (/\bIMPS\b/.test(n)) return 'IMPS';
  if (/\b(WALLET|PAYTM|PHONEPE|GPAY|GOOGLE\s?PAY)\b/.test(n)) return 'WALLET';
  if (/\b(CASH|ATM|CDM)\b/.test(n)) return 'CASH';
  return 'BANK';
}

interface ColMap {
  date?: number;
  debit?: number;
  credit?: number;
  amount?: number;
  type?: number;
  narration?: number;
  balance?: number;
  ref?: number;
}

function detectColumns(headers: string[]): ColMap {
  const map: ColMap = {};
  headers.forEach((h, i) => {
    const key = String(h || '').toLowerCase().trim();
    if (!key) return;
    if (map.date === undefined && /date/.test(key)) map.date = i;
    else if (map.debit === undefined && /(debit|withdrawal|dr\b|paid out|outgoing)/.test(key)) map.debit = i;
    else if (map.credit === undefined && /(credit|deposit|cr\b|paid in|incoming)/.test(key)) map.credit = i;
    else if (map.amount === undefined && /(amount|amt)/.test(key)) map.amount = i;
    else if (map.type === undefined && /(type|dr\/cr|dr cr|drcr|indicator)/.test(key)) map.type = i;
    else if (map.narration === undefined && /(narration|description|particular|remarks|details|naration)/.test(key)) map.narration = i;
    else if (map.balance === undefined && /(balance|bal\b)/.test(key)) map.balance = i;
    else if (map.ref === undefined && /(ref|cheque|chq|utr|reference|txn id|transaction id)/.test(key)) map.ref = i;
  });
  return map;
}

function rowsToObjects(rows: any[][], headerIdx: number, headers: string[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let r = headerIdx + 1; r < rows.length && out.length < 5; r++) {
    const row = rows[r] || [];
    if (row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] ?? null;
    });
    out.push(obj);
  }
  return out;
}

function parseSheetRows(rows: any[][]): ParseResult {
  const errors: string[] = [];

  // Locate the header row: one containing both a date-ish and amount-ish column.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] || []).map((c) => String(c || '').toLowerCase());
    const hasDate = cells.some((c) => /date/.test(c));
    const hasAmt = cells.some((c) => /(debit|credit|amount|amt|withdrawal|deposit)/.test(c));
    if (hasDate && hasAmt) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 0; // fallback: assume first row is the header

  const headers = (rows[headerIdx] || []).map((c) => String(c || '').trim());
  const colMap = detectColumns(headers);
  const detectedColumns = headers.filter(Boolean);
  const sampleRows = rowsToObjects(rows, headerIdx, headers);

  const transactions: ParsedTransaction[] = [];
  if (
    colMap.date === undefined ||
    (colMap.debit === undefined && colMap.credit === undefined && colMap.amount === undefined)
  ) {
    errors.push('Could not detect required Date and Amount/Debit/Credit columns from the file headers.');
    return { transactions, detectedColumns, sampleRows, errors };
  }

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    try {
      const date = parseDate(row[colMap.date]);
      if (!date) continue; // skip non-transaction rows (totals, sub-headers)

      const narration = colMap.narration !== undefined ? String(row[colMap.narration] || '').trim() : '';

      let amount: number | null = null;
      let direction: ParsedDirection = 'OUTGOING';

      const debit = colMap.debit !== undefined ? normalizeAmount(row[colMap.debit]) : null;
      const credit = colMap.credit !== undefined ? normalizeAmount(row[colMap.credit]) : null;

      if (debit && debit !== 0) {
        amount = Math.abs(debit);
        direction = 'OUTGOING';
      } else if (credit && credit !== 0) {
        amount = Math.abs(credit);
        direction = 'INCOMING';
      } else if (colMap.amount !== undefined) {
        const a = normalizeAmount(row[colMap.amount]);
        if (a !== null) {
          amount = Math.abs(a);
          const typeVal = colMap.type !== undefined ? String(row[colMap.type] || '').toUpperCase() : '';
          if (/CR|CREDIT/.test(typeVal)) direction = 'INCOMING';
          else if (/DR|DEBIT/.test(typeVal)) direction = 'OUTGOING';
          else direction = a < 0 ? 'OUTGOING' : 'INCOMING';
        }
      }

      if (amount === null || amount === 0) continue;

      const cp = extractCounterparty(narration);
      transactions.push({
        amount,
        txn_date: date,
        direction,
        txn_mode: detectMode(narration),
        counterparty_name: cp.name,
        counterparty_account: cp.account,
        narration: narration || null,
        transaction_ref: colMap.ref !== undefined ? String(row[colMap.ref] || '').trim() || null : null,
        balance_after: colMap.balance !== undefined ? normalizeAmount(row[colMap.balance]) : null,
      });
    } catch (e: any) {
      errors.push(`Row ${r + 1}: ${e.message}`);
    }
  }

  return { transactions, detectedColumns, sampleRows, errors };
}

/** Parse a CSV or XLSX buffer (xlsx handles both). */
export function parseTabular(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) {
    return { transactions: [], detectedColumns: [], sampleRows: [], errors: ['No sheets found in the file.'] };
  }
  const sheet = wb.Sheets[firstSheet];
  if (!sheet) {
    return { transactions: [], detectedColumns: [], sampleRows: [], errors: ['First sheet is empty.'] };
  }
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false });
  return parseSheetRows(rows);
}

/** Parse a PDF buffer using best-effort text-line heuristics. */
export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const errors: string[] = [];
  const data = await pdfParse(buffer);
  const text = data.text || '';
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const dateRe = /(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})/;
  const amtRe = /([0-9][0-9,]*\.\d{2})/g;

  const transactions: ParsedTransaction[] = [];
  for (const line of lines) {
    const dm = line.match(dateRe);
    if (!dm || !dm[1]) continue;
    const date = parseDate(dm[1]);
    if (!date) continue;
    const amts = line.match(amtRe);
    if (!amts || amts.length === 0) continue;

    const amount = normalizeAmount(amts[0]);
    if (amount === null || amount === 0) continue;
    const balance = amts.length > 1 ? normalizeAmount(amts[amts.length - 1]) : null;

    const narration = line.replace(dateRe, '').replace(amtRe, '').replace(/\s{2,}/g, ' ').trim();
    const cp = extractCounterparty(narration);
    const direction: ParsedDirection = /\bCR\b|credit/i.test(line) ? 'INCOMING' : 'OUTGOING';

    transactions.push({
      amount,
      txn_date: date,
      direction,
      txn_mode: detectMode(narration),
      counterparty_name: cp.name,
      counterparty_account: cp.account,
      narration: narration || null,
      transaction_ref: null,
      balance_after: balance,
    });
  }

  if (transactions.length === 0) {
    errors.push(
      'PDF heuristic extraction found no recognizable transaction rows. Upload CSV/XLSX for reliable parsing.'
    );
  }
  return { transactions, detectedColumns: ['(PDF heuristic — columns not detected)'], sampleRows: [], errors };
}

/** Parse a CSV buffer as plain text (avoids xlsx's ambiguous US-date coercion). */
export function parseCsv(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map(splitCsvLine);
  return parseSheetRows(rows);
}

/** Entry point — dispatch by declared file type. */
export async function parseStatement(buffer: Buffer, fileType: string): Promise<ParseResult> {
  const ft = (fileType || '').toUpperCase();
  if (ft === 'PDF') return parsePdf(buffer);
  if (ft === 'CSV') return parseCsv(buffer);
  return parseTabular(buffer); // XLSX / XLS (true date cells)
}
