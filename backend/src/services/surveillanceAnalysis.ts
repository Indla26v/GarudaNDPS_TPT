/**
 * GARUDA — Technical Surveillance Correlation Engine (Page 5)
 *
 *  🔴 Cross-case correlation — mobiles / IMEIs appearing across 2+ cases/offenders
 *  🟠 Tower dump overlap   — mobiles present in ALL of a set of selected cases
 *  🟡 SIM swap detection   — same IMEI with a new mobile (or vice-versa)
 */
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

export interface DuplicateMobile {
  mobile_number: string;
  case_count: number;
  case_ids: string[];
}
export interface DuplicateImei {
  imei_number: string;
  offender_count: number;
  offender_ids: string[];
}

/**
 * Cross-case correlations:
 *  - mobiles that hit tower dumps of 2+ distinct cases
 *  - IMEIs registered to 2+ distinct offenders
 */
export async function findCrossCaseCorrelations(): Promise<{
  duplicateMobiles: DuplicateMobile[];
  duplicateImeis: DuplicateImei[];
}> {
  const mobileRows = await prisma.$queryRaw<
    Array<{ mobile_number: string; case_count: bigint; case_ids: string[] }>
  >(Prisma.sql`
    SELECT mobile_number,
           COUNT(DISTINCT case_id)::bigint AS case_count,
           ARRAY_AGG(DISTINCT case_id::text) AS case_ids
    FROM tower_match_logs
    WHERE mobile_number IS NOT NULL AND mobile_number <> ''
    GROUP BY mobile_number
    HAVING COUNT(DISTINCT case_id) > 1
    ORDER BY COUNT(DISTINCT case_id) DESC
  `);

  const imeiRows = await prisma.$queryRaw<
    Array<{ imei_number: string; offender_count: bigint; offender_ids: string[] }>
  >(Prisma.sql`
    SELECT imei_number,
           COUNT(DISTINCT offender_id)::bigint AS offender_count,
           ARRAY_AGG(DISTINCT offender_id::text) AS offender_ids
    FROM imei_records
    WHERE imei_number IS NOT NULL AND imei_number <> ''
    GROUP BY imei_number
    HAVING COUNT(DISTINCT offender_id) > 1
    ORDER BY COUNT(DISTINCT offender_id) DESC
  `);

  return {
    duplicateMobiles: mobileRows.map((r) => ({
      mobile_number: r.mobile_number,
      case_count: Number(r.case_count),
      case_ids: r.case_ids || [],
    })),
    duplicateImeis: imeiRows.map((r) => ({
      imei_number: r.imei_number,
      offender_count: Number(r.offender_count),
      offender_ids: r.offender_ids || [],
    })),
  };
}

export interface TowerIntersection {
  mobile_number: string;
  matched_cases: number;
  total_hits: number;
  sample_lat: number | null;
  sample_lng: number | null;
}

/**
 * Tower dump overlap: mobiles present in ALL of the selected cases.
 * (Time-window refinement, e.g. ±30 min of offence time, is a future enhancement.)
 */
export async function findTowerIntersections(caseIds: bigint[]): Promise<TowerIntersection[]> {
  if (!caseIds || caseIds.length < 2) return [];

  const rows = await prisma.$queryRaw<
    Array<{
      mobile_number: string;
      matched_cases: bigint;
      total_hits: bigint;
      sample_lat: unknown;
      sample_lng: unknown;
    }>
  >(Prisma.sql`
    SELECT mobile_number,
           COUNT(DISTINCT case_id)::bigint AS matched_cases,
           COUNT(*)::bigint AS total_hits,
           MAX(latitude) AS sample_lat,
           MAX(longitude) AS sample_lng
    FROM tower_match_logs
    WHERE case_id = ANY(${caseIds}::bigint[])
    GROUP BY mobile_number
    HAVING COUNT(DISTINCT case_id) = ${caseIds.length}
    ORDER BY COUNT(*) DESC
  `);

  return rows.map((r) => ({
    mobile_number: r.mobile_number,
    matched_cases: Number(r.matched_cases),
    total_hits: Number(r.total_hits),
    sample_lat: r.sample_lat !== null && r.sample_lat !== undefined ? Number(r.sample_lat) : null,
    sample_lng: r.sample_lng !== null && r.sample_lng !== undefined ? Number(r.sample_lng) : null,
  }));
}

export interface SimSwapConflict {
  type: 'IMEI_NEW_SIM' | 'SIM_NEW_IMEI';
  imei_number: string | null;
  mobile_number: string | null;
  existingOffenderId: string;
  existingImeiId: string;
  detail: string;
}

/**
 * SIM swap detection: given an incoming IMEI record, find existing records where
 * the same IMEI is tied to a different mobile, or the same mobile to a different IMEI.
 */
export async function detectSimSwapConflicts(
  imeiNumber: string | null,
  mobileNumber: string | null,
  excludeId?: bigint
): Promise<SimSwapConflict[]> {
  const conflicts: SimSwapConflict[] = [];
  const notSelf = excludeId !== undefined ? { id: { not: excludeId } } : {};

  if (imeiNumber && mobileNumber) {
    const sameImeiDiffMobile = await prisma.imei_records.findMany({
      where: { imei_number: imeiNumber, mobile_number: { not: mobileNumber }, ...notSelf },
      select: { id: true, offender_id: true, mobile_number: true },
      take: 5,
    });
    for (const rec of sameImeiDiffMobile) {
      conflicts.push({
        type: 'IMEI_NEW_SIM',
        imei_number: imeiNumber,
        mobile_number: mobileNumber,
        existingOffenderId: rec.offender_id.toString(),
        existingImeiId: rec.id.toString(),
        detail: `IMEI ${imeiNumber} previously used mobile ${rec.mobile_number || 'unknown'}, now ${mobileNumber}`,
      });
    }

    const sameMobileDiffImei = await prisma.imei_records.findMany({
      where: { mobile_number: mobileNumber, imei_number: { not: imeiNumber }, ...notSelf },
      select: { id: true, offender_id: true, imei_number: true },
      take: 5,
    });
    for (const rec of sameMobileDiffImei) {
      conflicts.push({
        type: 'SIM_NEW_IMEI',
        imei_number: imeiNumber,
        mobile_number: mobileNumber,
        existingOffenderId: rec.offender_id.toString(),
        existingImeiId: rec.id.toString(),
        detail: `Mobile ${mobileNumber} previously used IMEI ${rec.imei_number}, now ${imeiNumber}`,
      });
    }
  }

  return conflicts;
}
