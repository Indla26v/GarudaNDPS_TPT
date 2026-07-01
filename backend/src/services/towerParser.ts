/**
 * GARUDA — Cell Tower Dump Parser (Technical Surveillance, Page 5)
 *
 * Parses uploaded tower dump / CDR files (CSV / XLSX) into normalized tower
 * match log rows. Dynamically detects columns for mobile number, cell/tower id,
 * timestamp (or separate date + time), latitude, longitude, and provider.
 * Missing geo-coordinates default to 0 (schema requires non-null lat/lng).
 */
import * as XLSX from 'xlsx';

export interface ParsedTowerLog {
  mobile_number: string;
  cell_tower_id: string;
  hit_time: Date;
  latitude: number;
  longitude: number;
  provider: string | null;
}

export interface TowerParseResult {
  logs: ParsedTowerLog[];
  detectedColumns: string[];
  errors: string[];
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/** Parse a timestamp cell, or combine separate date + time cells. */
function parseHitTime(tsVal: unknown, dateVal: unknown, timeVal: unknown): Date | null {
  // Full timestamp column
  if (tsVal instanceof Date) return isNaN(tsVal.getTime()) ? null : tsVal;
  if (typeof tsVal === 'number') {
    const d = new Date(Math.round((tsVal - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const ts = toStr(tsVal);
  if (ts) {
    const d = parseDateTimeString(ts);
    if (d) return d;
  }
  // Separate date + time columns
  const datePart = dateVal instanceof Date ? dateVal.toISOString().slice(0, 10) : toStr(dateVal);
  const timePart = toStr(timeVal);
  if (datePart) {
    const combined = timePart ? `${datePart} ${timePart}` : datePart;
    const d = parseDateTimeString(combined);
    if (d) return d;
  }
  return null;
}

function parseDateTimeString(s: string): Date | null {
  const str = s.trim();
  // ISO or native-parseable
  const native = new Date(str);
  if (!isNaN(native.getTime())) return native;
  // DD/MM/YYYY[ HH:mm[:ss]] (day-first)
  const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const d = new Date(
      Date.UTC(y, Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0))
    );
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

interface TowerColMap {
  mobile?: number;
  cell?: number;
  timestamp?: number;
  date?: number;
  time?: number;
  lat?: number;
  lng?: number;
  provider?: number;
}

function detectColumns(headers: string[]): TowerColMap {
  const map: TowerColMap = {};
  headers.forEach((h, i) => {
    const key = String(h || '').toLowerCase().trim();
    if (!key) return;
    if (map.mobile === undefined && /(mobile|msisdn|phone|calling|a[-\s]?number|b[-\s]?number)/.test(key)) map.mobile = i;
    else if (map.cell === undefined && /(cell|tower|lac|site|bts)/.test(key)) map.cell = i;
    else if (map.timestamp === undefined && /(timestamp|datetime|hit[-\s]?time|date[-\s]?time|date time)/.test(key)) map.timestamp = i;
    else if (map.date === undefined && /date/.test(key)) map.date = i;
    else if (map.time === undefined && /time/.test(key)) map.time = i;
    else if (map.lat === undefined && /(lat)/.test(key)) map.lat = i;
    else if (map.lng === undefined && /(long|lng|lon)/.test(key)) map.lng = i;
    else if (map.provider === undefined && /(provider|operator|carrier|telecom)/.test(key)) map.provider = i;
  });
  return map;
}

export async function parseTowerDump(buffer: Buffer, fileType: string): Promise<TowerParseResult> {
  const errors: string[] = [];
  void fileType; // dispatch is by extension upstream; xlsx auto-detects CSV vs XLSX from the buffer

  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { logs: [], detectedColumns: [], errors: ['No sheets found in the file.'] };
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { logs: [], detectedColumns: [], errors: ['First sheet is empty.'] };

  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false });

  // Locate header row (contains a mobile-ish and a tower/cell-ish column)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] || []).map((c) => String(c || '').toLowerCase());
    const hasMobile = cells.some((c) => /(mobile|msisdn|phone|number)/.test(c));
    const hasCell = cells.some((c) => /(cell|tower|lac|bts)/.test(c));
    if (hasMobile && hasCell) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 0;

  const headers = (rows[headerIdx] || []).map((c) => String(c || '').trim());
  const colMap = detectColumns(headers);
  const detectedColumns = headers.filter(Boolean);

  const logs: ParsedTowerLog[] = [];
  if (colMap.mobile === undefined) {
    errors.push('Could not detect a Mobile Number / MSISDN column from the file headers.');
    return { logs, detectedColumns, errors };
  }

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    try {
      const mobile = colMap.mobile !== undefined ? toStr(row[colMap.mobile]) : '';
      if (!mobile) continue;

      const hitTime = parseHitTime(
        colMap.timestamp !== undefined ? row[colMap.timestamp] : null,
        colMap.date !== undefined ? row[colMap.date] : null,
        colMap.time !== undefined ? row[colMap.time] : null
      );
      if (!hitTime) continue; // rows without a usable timestamp are skipped

      const cell = colMap.cell !== undefined ? toStr(row[colMap.cell]) : '';
      const lat = colMap.lat !== undefined ? toNum(row[colMap.lat]) : null;
      const lng = colMap.lng !== undefined ? toNum(row[colMap.lng]) : null;
      const provider = colMap.provider !== undefined ? toStr(row[colMap.provider]) || null : null;

      logs.push({
        mobile_number: mobile.slice(0, 20),
        cell_tower_id: (cell || 'UNKNOWN').slice(0, 100),
        hit_time: hitTime,
        latitude: lat ?? 0,
        longitude: lng ?? 0,
        provider: provider ? provider.slice(0, 50) : null,
      });
    } catch (e: any) {
      errors.push(`Row ${r + 1}: ${e.message}`);
    }
  }

  if (logs.length === 0 && errors.length === 0) {
    errors.push('No valid tower log rows found (need at least a mobile number and a timestamp per row).');
  }
  return { logs, detectedColumns, errors };
}
