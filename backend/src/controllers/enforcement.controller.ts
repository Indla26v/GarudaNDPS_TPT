/**
 * GARUDA — Enforcement Controller
 * 
 * Field Enforcement Workflow:
 *   1. Field officer creates enforcement check (demographics + identity lookup)
 *   2. Officer submits drug test result (POSITIVE/NEGATIVE)
 *   3. Negative → auto-close with audit trail
 *   4. Positive → escalate to SHO for consumer DB entry
 *   5. SHO reviews → approve (creates offender) or reject
 *
 * DATA SCOPING:
 *   Station-level (SDPO, SHO, Constable) → only their PS data
 *   District-level (SP, ASP) → all PS data
 */
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, ScopeUser } from '../utils/scope';
import { logAudit } from '../utils/auditLogger';

const STATE_CODES: Record<string, string> = {
  'andhra pradesh': 'AP',
  'ap': 'AP',
  'kerala': 'KL',
  'kl': 'KL',
  'karnataka': 'KA',
  'ka': 'KA',
  'telangana': 'TS',
  'ts': 'TS',
};

const DISTRICT_NUMBERS: Record<string, string> = {
  'tirupati': '39',
  'chittoor': '03',
};

// ── Helper: build enforcement scoping where clause ─────────────────────
function getEnforcementWhere(user: ScopeUser): Record<string, any> {
  if (!user?.role) return { id: BigInt(-1) };

  // SP and ASP roles: scoped to district
  if (user.role === 'SP' || user.role === 'ASP') {
    if (user.district) {
      return { police_station: { district: user.district } };
    }
    return {};
  }

  // SDPO role: scoped to subdivision
  if (user.role === 'SDPO') {
    if (user.divisionId) {
      return { police_station: { sdpo: user.divisionId } };
    }
    return {};
  }

  // Station-level: scope to their police station
  if (user.policeStationId) {
    return { ps_id: BigInt(user.policeStationId) };
  }

  return {};
}

// ── 1. Create field enforcement check ─────────────────────────────────
export const createEnforcementCheck = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      // Identity / Match Payload
      matchedOffenderId,
      // Common Payload
      subjectName,
      subjectAge,
      subjectGender,
      subjectAadhaar,
      placeOfEnforcement,
      photoUrl,
      // Extended Consumer Schema Payload (when Test = POSITIVE and no matched ID)
      subjectPhone,
      subjectPan,
      subjectVoterId,
      subjectAddress,
      subjectFatherName,
      subjectLandmark,
      subjectDistrict,
      subjectOccupation,
      // Drug Profile fields
      addictionType,
      consumptionFrequency,
      sourceOfProcurement,
      modeOfPurchase,
      usualConsumptionSpot,
      // Enforcement Result
      testResult, // 'POSITIVE' | 'NEGATIVE'
      noSuspiciousActivity, // boolean
      geo_lat,
      geo_lng,
    } = req.body;

    if (!subjectName || !placeOfEnforcement) {
      return res.status(400).json({ message: 'Subject name and place of enforcement are required' });
    }

    // Determine PS — use the officer's assigned PS
    const psId = user.policeStationId;
    if (!psId) {
      return res.status(400).json({ message: 'Officer must be assigned to a police station' });
    }

    // ── Run identity lookups (if matchedOffenderId is NOT provided) ─────
    let ndpsMatch = false;
    let finalMatchedId: bigint | null = matchedOffenderId ? BigInt(matchedOffenderId) : null;
    let criminalRecordFound = false;
    const lookupResults: string[] = [];

    if (!finalMatchedId) {
      // 1. Aadhaar lookup
      if (subjectAadhaar && subjectAadhaar.length === 12) {
        const aadhaarHit = await prisma.offender_identity_docs.findFirst({
          where: { aadhaar_no: subjectAadhaar },
          include: { offenders: { select: { id: true, full_name: true, category: true, status: true } } },
        });
        if (aadhaarHit) {
          ndpsMatch = true;
          finalMatchedId = aadhaarHit.offenders.id;
          lookupResults.push(`Aadhaar match: ${aadhaarHit.offenders.full_name} (${aadhaarHit.offenders.category || 'Unknown category'}, Status: ${aadhaarHit.offenders.status})`);
        }
      }

      // 2. Name-based fuzzy match (case-insensitive partial match)
      if (!finalMatchedId) {
        const nameHits = await prisma.offenders.findMany({
          where: {
            full_name: { contains: subjectName, mode: 'insensitive' },
          },
          take: 5,
          select: { id: true, full_name: true, category: true, status: true, ps_id: true },
        });
        if (nameHits.length > 0) {
          ndpsMatch = true;
          finalMatchedId = nameHits[0]?.id || null;
          nameHits.forEach(h => {
            lookupResults.push(`Name match: ${h.full_name} (${h.category || 'N/A'}, Status: ${h.status})`);
          });
        }
      }
    } else {
      ndpsMatch = true;
      lookupResults.push(`Explicitly matched to offender ID: ${finalMatchedId}`);
    }

    // 3. Criminal record check via case_accused
    if (finalMatchedId) {
      const accusedRecords = await prisma.case_accused.findMany({
        where: { offender_id: finalMatchedId },
        include: { cases: { select: { fir_no: true, stage: true } } },
        take: 5,
      });
      if (accusedRecords.length > 0) {
        criminalRecordFound = true;
        accusedRecords.forEach(r => {
          lookupResults.push(`Criminal record: FIR ${r.cases.fir_no} (Stage: ${r.cases.stage})`);
        });
      }
    }

    const lookupSummary = lookupResults.length > 0
      ? lookupResults.join(' | ')
      : 'No prior records found';

    // ── Create enforcement check record ──────────────────────────────────
    // If POSITIVE, we set status to PENDING so SHO can review and create the offender
    // If NEGATIVE or not tested, we set it to APPROVED immediately
    const isPositive = testResult === 'POSITIVE';
    const finalStatus = isPositive ? 'PENDING_SHO_REVIEW' : (testResult === 'NEGATIVE' ? 'NEGATIVE_CLOSED' : 'FIELD_CREATED');

    let findingsData = lookupSummary;
    let consumptionTypeJson: string | null = null;
    if (isPositive && !finalMatchedId) {
      consumptionTypeJson = JSON.stringify({
        addiction_type: addictionType || 'GANJA_ONLY',
        consumption_frequency: consumptionFrequency || null,
        source_of_procurement: sourceOfProcurement || null,
        mode_of_purchase: modeOfPurchase || null,
        usual_consumption_spot: usualConsumptionSpot || null,
      });
      findingsData += '\n\n' + 
             `=== CONSUMER DETAILS FOR DB CREATION ===\n` +
             `Phone: ${subjectPhone || 'N/A'}\n` +
             `Aadhaar: ${subjectAadhaar || 'N/A'}\n` +
             `PAN: ${subjectPan || 'N/A'}\n` +
             `Voter ID: ${subjectVoterId || 'N/A'}\n` +
             `Address: ${subjectAddress || 'N/A'}\n` +
             `Landmark: ${subjectLandmark || 'N/A'}\n` +
             `District: ${subjectDistrict || 'N/A'}\n` +
             `Father's Name: ${subjectFatherName || 'N/A'}\n` +
             `Occupation: ${subjectOccupation || 'N/A'}\n` +
             `Addiction Type: ${addictionType || 'GANJA_ONLY'}\n` +
             `Frequency: ${consumptionFrequency || 'N/A'}\n` +
             `Procurement Source: ${sourceOfProcurement || 'N/A'}\n` +
             `Purchase Mode: ${modeOfPurchase || 'N/A'}\n` +
             `Consumption Spot: ${usualConsumptionSpot || 'N/A'}`;
    }

    const check = await (prisma as any).enforcement_checks.create({
      data: {
        ps_id: BigInt(psId),
        created_by: BigInt(user.userId),
        subject_name: subjectName,
        subject_age: subjectAge ? parseInt(subjectAge) : null,
        subject_gender: subjectGender || null,
        subject_aadhaar: subjectAadhaar || null,
        photo_url: photoUrl || null,
        place_of_enforcement: placeOfEnforcement,
        geo_lat: geo_lat ? parseFloat(String(geo_lat)) : null,
        geo_lng: geo_lng ? parseFloat(String(geo_lng)) : null,
        subject_phone: subjectPhone || null,
        subject_pan: subjectPan || null,
        subject_address: subjectAddress || null,
        subject_father_name: subjectFatherName || null,
        subject_landmark: subjectLandmark || null,
        subject_occupation: subjectOccupation || null,
        district: subjectDistrict || undefined,
        ndps_match: ndpsMatch,
        criminal_record_found: criminalRecordFound,
        matched_offender_id: finalMatchedId,
        test_result: testResult || null,
        consumption_type: consumptionTypeJson,
        status: finalStatus,
        lookup_summary: findingsData,
      },
      include: {
        police_station: { select: { name: true, ps_code: true } },
        officer: { select: { full_name: true, role: true } },
      },
    });

    await logAudit('CREATE', 'ENFORCEMENT_CHECK', check.id, req, `Field check for ${subjectName}`);

    res.status(201).json(successResponse({
      ...check,
      id: check.id.toString(),
      lookupResults,
    }, 'Enforcement check created'));
  } catch (error) {
    console.error('createEnforcementCheck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 2. Submit drug test result ─────────────────────────────────────────
export const submitTestResult = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid check ID' });
    }
    const { testResult, consumptionType } = req.body;

    if (!testResult || !['POSITIVE', 'NEGATIVE'].includes(testResult)) {
      return res.status(400).json({ message: 'testResult must be POSITIVE or NEGATIVE' });
    }

    const check = await prisma.enforcement_checks.findUnique({ where: { id: BigInt(id) } });
    if (!check) return res.status(404).json({ message: 'Enforcement check not found' });
    if (check.status !== 'FIELD_CREATED') {
      return res.status(400).json({ message: 'Test result can only be submitted for FIELD_CREATED checks' });
    }

    const updateData: any = {
      test_result: testResult,
      updated_at: new Date(),
    };

    if (testResult === 'NEGATIVE') {
      updateData.status = 'NEGATIVE_CLOSED';
    } else {
      updateData.status = 'PENDING_SHO_REVIEW';
      updateData.consumption_type = consumptionType || null;
    }

    const updated = await prisma.enforcement_checks.update({
      where: { id: BigInt(id) },
      data: updateData,
      include: {
        police_station: { select: { name: true } },
        officer: { select: { full_name: true } },
      },
    });

    const action = testResult === 'NEGATIVE' ? 'NEGATIVE_CLOSED' : 'ESCALATED_TO_SHO';
    await logAudit('UPDATE', 'ENFORCEMENT_CHECK', updated.id, req,
      `Test result: ${testResult}. ${action}. Subject: ${updated.subject_name}`);

    res.json(successResponse(updated, `Test result submitted — ${testResult === 'NEGATIVE' ? 'Session closed' : 'Escalated to SHO'}`));
  } catch (error) {
    console.error('submitTestResult error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 3. List enforcement checks (role-scoped) ──────────────────────────
export const listEnforcementChecks = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const where = getEnforcementWhere(user);
    const { status, testResult, page = '1', limit = '20' } = req.query;

    const filterWhere: any = { ...where };
    if (status) filterWhere.status = status;
    if (testResult) filterWhere.test_result = testResult;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

    const [checks, total] = await Promise.all([
      prisma.enforcement_checks.findMany({
        where: filterWhere,
        orderBy: { created_at: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          police_station: { select: { name: true, ps_code: true } },
          officer: { select: { full_name: true, role: true } },
          reviewer: { select: { full_name: true } },
          matched_offender: { select: { id: true, full_name: true, category: true } },
        },
      }),
      prisma.enforcement_checks.count({ where: filterWhere }),
    ]);

    res.json(successResponse({ checks, total, page: pageNum, limit: limitNum }));
  } catch (error) {
    console.error('listEnforcementChecks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 4. Get enforcement dashboard summary (role-scoped) ────────────────
export const getEnforcementSummary = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const baseWhere = getEnforcementWhere(user);

    // Dynamic Station/Precinct Filter
    const { psId } = req.query;
    const where: any = { ...baseWhere };
    if (psId && psId !== 'ALL') {
      const DISTRICT_ROLES = ['SP', 'ASP'];
      if (DISTRICT_ROLES.includes(user.role)) {
        where.ps_id = BigInt(psId as string);
      } else if (user.policeStationId && String(user.policeStationId) === String(psId)) {
        where.ps_id = BigInt(user.policeStationId);
      }
    }

    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthWhere: any = { ...where, created_at: { gte: monthStart } };
    const villageMonthWhere: any = { ...where, visit_date: { gte: monthStart } };
    const lodgeMonthWhere: any = { ...where, check_date: { gte: monthStart } };

    // Overall counts (this month)
    const [
      totalThisMonth,
      positiveThisMonth,
      negativeThisMonth,
      pendingReview,
      villageVisitsCount,
      lodgeChecksCount,
      drunkDriveChecksCount,
      courierChecksCount,
      railwayChecksCount,
      busStandChecksCount,
      rowdySheeterChecksCount,
      boundOverChecksCount,
      vehicleChecksCount,
      mvActChecksCount,
      pettyCasesChecksCount,
      palleNidraChecksCount,
      droneSurveillanceChecksCount,
    ] = await Promise.all([
      prisma.enforcement_checks.count({ where: monthWhere }),
      prisma.enforcement_checks.count({ where: { ...monthWhere, test_result: 'POSITIVE' } }),
      prisma.enforcement_checks.count({ where: { ...monthWhere, test_result: 'NEGATIVE' } }),
      prisma.enforcement_checks.count({ where: { ...where, status: 'PENDING_SHO_REVIEW' } }),
      prisma.village_visits.count({ where: villageMonthWhere }),
      prisma.lodge_checks.count({ where: lodgeMonthWhere }),
      (prisma as any).drunk_drive_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      (prisma as any).courier_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      (prisma as any).railway_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      (prisma as any).bus_stand_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      prisma.rowdy_sheeter_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      prisma.bound_over_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      prisma.vehicle_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      prisma.mv_act_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      prisma.petty_cases_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      prisma.palle_nidra_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
      prisma.drone_surveillance_checks.count({ where: { ...where, created_at: { gte: monthStart } } }),
    ]);

    // Fetch counts for last month to determine trends dynamically
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthWhere: any = { ...where, created_at: { gte: lastMonthStart, lt: lastMonthEnd } };
    const lastVillageMonthWhere: any = { ...where, visit_date: { gte: lastMonthStart, lt: lastMonthEnd } };
    const lastLodgeMonthWhere: any = { ...where, check_date: { gte: lastMonthStart, lt: lastMonthEnd } };

    const [
      totalLastMonth,
      villageVisitsLastMonth,
      lodgeChecksLastMonth,
      drunkDriveLastMonth,
      courierLastMonth,
      railwayLastMonth,
      busStandLastMonth,
      rowdySheeterLastMonth,
      boundOverLastMonth,
      vehicleChecksLastMonth,
      mvActLastMonth,
      pettyCasesLastMonth,
      palleNidraLastMonth,
      droneSurveillanceLastMonth,
    ] = await Promise.all([
      prisma.enforcement_checks.count({ where: lastMonthWhere }),
      prisma.village_visits.count({ where: lastVillageMonthWhere }),
      prisma.lodge_checks.count({ where: lastLodgeMonthWhere }),
      (prisma as any).drunk_drive_checks.count({ where: lastMonthWhere }),
      (prisma as any).courier_checks.count({ where: lastMonthWhere }),
      (prisma as any).railway_checks.count({ where: lastMonthWhere }),
      (prisma as any).bus_stand_checks.count({ where: lastMonthWhere }),
      prisma.rowdy_sheeter_checks.count({ where: lastMonthWhere }),
      prisma.bound_over_checks.count({ where: lastMonthWhere }),
      prisma.vehicle_checks.count({ where: lastMonthWhere }),
      prisma.mv_act_checks.count({ where: lastMonthWhere }),
      prisma.petty_cases_checks.count({ where: lastMonthWhere }),
      prisma.palle_nidra_checks.count({ where: lastMonthWhere }),
      prisma.drone_surveillance_checks.count({ where: lastMonthWhere }),
    ]);

    const calculateTrend = (curr: number, prev: number) => {
      if (prev === 0) {
        return curr > 0 ? `+${curr}%` : '0%';
      }
      const pct = ((curr - prev) / prev) * 100;
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
    };

    // Resolve the stations for this user's scope to build psCondition
    let stationsToQuery;
    if (where.ps_id) {
      stationsToQuery = await prisma.police_stations.findMany({
        where: { id: where.ps_id as bigint },
      });
    } else if (where.police_station) {
      stationsToQuery = await prisma.police_stations.findMany({
        where: where.police_station,
      });
    } else {
      stationsToQuery = await prisma.police_stations.findMany();
    }

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // ── SECURITY FIX #2: Replace $queryRawUnsafe (SQL injection) with
    // parameterized Prisma.sql tagged template. Station IDs are passed as
    // a PostgreSQL array parameter instead of being string-interpolated.
    const stationIds = stationsToQuery && stationsToQuery.length > 0
      ? stationsToQuery.map(s => s.id)
      : [];

    const monthlyTrend = stationIds.length > 0
      ? await prisma.$queryRaw<{ month: string; positive: bigint; negative: bigint; total: bigint }[]>(
          Prisma.sql`SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
                  COUNT(*) FILTER (WHERE test_result = 'POSITIVE')::bigint AS positive,
                  COUNT(*) FILTER (WHERE test_result = 'NEGATIVE')::bigint AS negative,
                  COUNT(*)::bigint AS total
           FROM enforcement_checks
           WHERE created_at >= ${sixMonthsAgo}
             AND ps_id = ANY(${stationIds}::bigint[])
           GROUP BY 1 ORDER BY 1`
        )
      : [];

    // Place-of-enforcement frequency
    const placeFrequency = await prisma.enforcement_checks.groupBy({
      by: ['place_of_enforcement'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Recent activities (Enforcement Checks, Village Visits, Lodge Checks, Drunk & Drive Checks, Courier Checks, Railway Station Checks, and Bus Stand Checks)
    // Recent activities (Enforcement Checks, Village Visits, Lodge Checks, Drunk & Drive Checks, Courier Checks, Railway Station Checks, Bus Stand Checks, and the 7 new modules)
    const [
      recentChecks,
      recentVisits,
      recentLodges,
      recentDrunkDrive,
      recentCourier,
      recentRailway,
      recentBusStand,
      recentRowdy,
      recentBoundOver,
      recentVehicleCheck,
      recentMvAct,
      recentPetty,
      recentPalleNidra,
      recentDrone
    ] = await Promise.all([
      prisma.enforcement_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true, ps_code: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.village_visits.findMany({
        where,
        take: 5,
        orderBy: { visit_date: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.lodge_checks.findMany({
        where,
        take: 5,
        orderBy: { check_date: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      (prisma as any).drunk_drive_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      (prisma as any).courier_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      (prisma as any).railway_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      (prisma as any).bus_stand_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.rowdy_sheeter_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.bound_over_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.vehicle_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.mv_act_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.petty_cases_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.palle_nidra_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
      prisma.drone_surveillance_checks.findMany({
        where,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          police_station: { select: { name: true } },
          officer: { select: { full_name: true } },
        },
      }),
    ]);

    const combinedRecent = [
      ...recentChecks.map(c => ({
        type: 'NDPS Verification',
        officer: c.officer.full_name,
        result: `Subject: ${c.subject_name} (${c.test_result || 'PENDING'})`,
        time: c.created_at,
        psName: c.police_station.name,
        bg: c.test_result === 'POSITIVE' ? 'rgba(234,88,12,0.15)' : 'rgba(16,185,129,0.15)',
        color: c.test_result === 'POSITIVE' ? '#ea580c' : '#10b981',
      })),
      ...recentVisits.map(v => ({
        type: 'Village Visit',
        officer: v.officer.full_name,
        result: `Village: ${v.village_name} (${v.no_suspicious_activity ? 'No susp. activity' : 'Activity logged'})`,
        time: v.visit_date,
        psName: v.police_station.name,
        bg: 'rgba(59,130,246,0.15)',
        color: '#3b82f6',
      })),
      ...recentLodges.map(l => ({
        type: 'Lodge Check',
        officer: l.officer.full_name,
        result: `Lodge: ${l.lodge_name} (${l.no_suspicious_activity ? 'No susp. activity' : 'Strangers/guests checked'})`,
        time: l.check_date,
        psName: l.police_station.name,
        bg: 'rgba(139,92,246,0.15)',
        color: '#8b5cf6',
      })),
      ...recentDrunkDrive.map((d: any) => ({
        type: 'Drunk & Drive',
        officer: d.officer.full_name,
        result: `Vehicle: ${d.vehicle_no} (BAC: ${d.bac_level} mg/100ml)`,
        time: d.created_at,
        psName: d.police_station.name,
        bg: 'rgba(239,68,68,0.15)',
        color: '#ef4444',
      })),
      ...recentCourier.map((c: any) => ({
        type: 'Courier Office',
        officer: c.officer.full_name,
        result: `Office: ${c.courier_office_name} (${c.no_suspicious_activity ? 'No susp. activity' : 'Inspected ' + (c.scanned_parcels_count || 0) + ' parcels'})`,
        time: c.created_at,
        psName: c.police_station.name,
        bg: 'rgba(244,63,94,0.15)',
        color: '#f43f5e',
      })),
      ...recentRailway.map((r: any) => ({
        type: 'Railway Station',
        officer: r.officer.full_name,
        result: `Station: ${r.station_name} (${r.no_suspicious_activity ? 'No susp. activity' : 'Inspected ' + (r.luggage_inspected_count || 0) + ' bags'})`,
        time: r.created_at,
        psName: r.police_station.name,
        bg: 'rgba(6,182,212,0.15)', // cyan-500
        color: '#06b6d4',
      })),
      ...recentBusStand.map((b: any) => ({
        type: 'Bus Stand',
        officer: b.officer.full_name,
        result: `Stand: ${b.bus_stand_name} (${b.no_suspicious_activity ? 'No susp. activity' : 'Checked ' + (b.passengers_checked || 0) + ' passengers'})`,
        time: b.created_at,
        psName: b.police_station.name,
        bg: 'rgba(20,184,166,0.15)', // teal-500
        color: '#20b8a6',
      })),
      ...recentRowdy.map(r => ({
        type: 'Rowdy Sheeter',
        officer: r.officer.full_name,
        result: `Rowdy: ${r.rowdy_sheeter_name} (${r.activity_status || 'Checked'})`,
        time: r.created_at,
        psName: r.police_station.name,
        bg: 'rgba(99,102,241,0.15)',
        color: '#6366f1',
      })),
      ...recentBoundOver.map(b => ({
        type: 'Bound Over',
        officer: b.officer.full_name,
        result: `Bound Over: ${b.subject_name} (${b.compliance_status || 'Checked'})`,
        time: b.created_at,
        psName: b.police_station.name,
        bg: 'rgba(16,185,129,0.15)',
        color: '#10b981',
      })),
      ...recentVehicleCheck.map(v => ({
        type: 'Vehicle Check',
        officer: v.officer.full_name,
        result: `Vehicle Check: ${v.vehicle_no} (${v.watchlist_match ? 'Watchlist Match' : 'Clear'})`,
        time: v.created_at,
        psName: v.police_station.name,
        bg: 'rgba(14,165,233,0.15)',
        color: '#0ea5e9',
      })),
      ...recentMvAct.map(m => ({
        type: 'MV Act',
        officer: m.officer.full_name,
        result: `MV Act Violation: ${m.vehicle_no} (${m.violation_type})`,
        time: m.created_at,
        psName: m.police_station.name,
        bg: 'rgba(107,114,128,0.15)',
        color: '#6b7280',
      })),
      ...recentPetty.map(p => ({
        type: 'Petty Case',
        officer: p.officer.full_name,
        result: `Petty Case: ${p.accused_name} (${p.act_section})`,
        time: p.created_at,
        psName: p.police_station.name,
        bg: 'rgba(249,115,22,0.15)',
        color: '#f97316',
      })),
      ...recentPalleNidra.map(pn => ({
        type: 'Palle Nidra',
        officer: pn.officer.full_name,
        result: `Palle Nidra: ${pn.village_name}`,
        time: pn.created_at,
        psName: pn.police_station.name,
        bg: 'rgba(167,139,250,0.15)',
        color: '#a78bfa',
      })),
      ...recentDrone.map(d => ({
        type: 'Drone Surveillance',
        officer: d.officer.full_name,
        result: `Drone Scan: ${d.area_name} (${d.ganja_detected ? 'Ganja detected' : 'No findings'})`,
        time: d.created_at,
        psName: d.police_station.name,
        bg: 'rgba(217,70,239,0.15)',
        color: '#d946ef',
      })),
    ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 10);

    // Total all-time counts
    const [totalAllTime, positiveAllTime, negativeAllTime] = await Promise.all([
      prisma.enforcement_checks.count({ where }),
      prisma.enforcement_checks.count({ where: { ...where, test_result: 'POSITIVE' } }),
      prisma.enforcement_checks.count({ where: { ...where, test_result: 'NEGATIVE' } }),
    ]);

    // Station-wise breakdown (for SDPO/SP) leaderboard counting all activity types
    let stationBreakdown: any[] = [];
    if (['SP', 'ASP', 'SDPO'].includes(user.role)) {
      const breakdownStations = where.police_station
        ? await prisma.police_stations.findMany({
            where: where.police_station,
            select: { id: true, name: true }
          })
        : await prisma.police_stations.findMany({
            select: { id: true, name: true }
          });

      const stationIds = breakdownStations.map(s => s.id);
      const [vvCounts, lcCounts, ecCounts, ddCounts, ccCounts, rcCounts, bcCounts, rsCounts, boCounts, vcCounts, mvCounts, pcCounts, pnCounts, dsCounts] = await Promise.all([
        prisma.village_visits.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, visit_date: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.lodge_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, check_date: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.enforcement_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        (prisma as any).drunk_drive_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        (prisma as any).courier_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        (prisma as any).railway_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        (prisma as any).bus_stand_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.rowdy_sheeter_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.bound_over_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.vehicle_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.mv_act_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.petty_cases_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.palle_nidra_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
        prisma.drone_surveillance_checks.groupBy({
          by: ['ps_id'],
          where: { ps_id: { in: stationIds }, created_at: { gte: monthStart } },
          _count: { id: true },
        }),
      ]);

      const breakdownMap = new Map<string, { ps_id: string; ps_name: string; visits: number; lodges: number; ndps: number; drunkDrive: number; courier: number; railway: number; bus: number; total: number }>();
      
      breakdownStations.forEach(s => {
        breakdownMap.set(s.id.toString(), {
          ps_id: s.id.toString(),
          ps_name: s.name,
          visits: 0,
          lodges: 0,
          ndps: 0,
          drunkDrive: 0,
          courier: 0,
          railway: 0,
          bus: 0,
          total: 0,
        });
      });

      vvCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) {
          item.visits = c._count.id;
          item.total += c._count.id;
        }
      });

      lcCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) {
          item.lodges = c._count.id;
          item.total += c._count.id;
        }
      });

      ecCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) {
          item.ndps = c._count.id;
          item.total += c._count.id;
        }
      });

      ddCounts.forEach((c: any) => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) {
          item.drunkDrive = c._count.id;
          item.total += c._count.id;
        }
      });

      ccCounts.forEach((c: any) => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) {
          item.courier = c._count.id;
          item.total += c._count.id;
        }
      });

      rcCounts.forEach((c: any) => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) {
          item.railway = c._count.id;
          item.total += c._count.id;
        }
      });

      bcCounts.forEach((c: any) => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) {
          item.bus = c._count.id;
          item.total += c._count.id;
        }
      });

      rsCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) item.total += c._count.id;
      });

      boCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) item.total += c._count.id;
      });

      vcCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) item.total += c._count.id;
      });

      mvCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) item.total += c._count.id;
      });

      pcCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) item.total += c._count.id;
      });

      pnCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) item.total += c._count.id;
      });

      dsCounts.forEach(c => {
        const item = breakdownMap.get(c.ps_id.toString());
        if (item) item.total += c._count.id;
      });

      stationBreakdown = Array.from(breakdownMap.values())
        .sort((a, b) => b.total - a.total);
    }

    res.json(successResponse({
      thisMonth: { 
        total: totalThisMonth, 
        positive: positiveThisMonth, 
        negative: negativeThisMonth,
        villageVisits: villageVisitsCount,
        lodgeChecks: lodgeChecksCount,
        drunkDrive: drunkDriveChecksCount,
        courier: courierChecksCount,
        railway: railwayChecksCount,
        bus: busStandChecksCount,
        rowdySheeter: rowdySheeterChecksCount,
        boundOver: boundOverChecksCount,
        vehicleCheck: vehicleChecksCount,
        mvAct: mvActChecksCount,
        pettyCases: pettyCasesChecksCount,
        palleNidra: palleNidraChecksCount,
        droneSurveillance: droneSurveillanceChecksCount,
      },
      trends: {
        villageVisits: calculateTrend(villageVisitsCount, villageVisitsLastMonth),
        lodgeChecks: calculateTrend(lodgeChecksCount, lodgeChecksLastMonth),
        ndps: calculateTrend(totalThisMonth, totalLastMonth),
        drunkDrive: calculateTrend(drunkDriveChecksCount, drunkDriveLastMonth),
        courier: calculateTrend(courierChecksCount, courierLastMonth),
        railway: calculateTrend(railwayChecksCount, railwayLastMonth),
        bus: calculateTrend(busStandChecksCount, busStandLastMonth),
        rowdySheeter: calculateTrend(rowdySheeterChecksCount, rowdySheeterLastMonth),
        boundOver: calculateTrend(boundOverChecksCount, boundOverLastMonth),
        vehicleCheck: calculateTrend(vehicleChecksCount, vehicleChecksLastMonth),
        mvAct: calculateTrend(mvActChecksCount, mvActLastMonth),
        pettyCases: calculateTrend(pettyCasesChecksCount, pettyCasesLastMonth),
        palleNidra: calculateTrend(palleNidraChecksCount, palleNidraLastMonth),
        droneSurveillance: calculateTrend(droneSurveillanceChecksCount, droneSurveillanceLastMonth),
      },
      allTime: { total: totalAllTime, positive: positiveAllTime, negative: negativeAllTime },
      pendingReview,
      monthlyTrend,
      placeFrequency: placeFrequency.map(p => ({
        place: p.place_of_enforcement,
        count: p._count.id,
      })),
      recentActivities: combinedRecent,
      stationBreakdown,
    }));
  } catch (error) {
    console.error('getEnforcementSummary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 5. List pending SHO review ────────────────────────────────────────
export const getPendingReview = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const where = getEnforcementWhere(user);

    const checks = await prisma.enforcement_checks.findMany({
      where: { ...where, status: 'PENDING_SHO_REVIEW' },
      orderBy: { created_at: 'desc' },
      include: {
        police_station: { select: { name: true, ps_code: true } },
        officer: { select: { full_name: true, role: true } },
        matched_offender: { select: { id: true, full_name: true, category: true } },
      },
    });

    res.json(successResponse({ checks, total: checks.length }));
  } catch (error) {
    console.error('getPendingReview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 6. SHO review (approve/reject) ───────────────────────────────────
export const reviewEnforcementCheck = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid check ID' });
    }
    const {
      action,
      reviewNotes,
      subjectName,
      subjectAge,
      subjectGender,
      subjectAadhaar,
      subjectPhone,
      subjectPan,
      subjectAddress,
      subjectFatherName,
      subjectLandmark,
      subjectOccupation
    } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be "approve" or "reject"' });
    }

    const check = await prisma.enforcement_checks.findUnique({ where: { id: BigInt(id) } });
    if (!check) return res.status(404).json({ message: 'Enforcement check not found' });
    if (check.status !== 'PENDING_SHO_REVIEW') {
      return res.status(400).json({ message: 'Only PENDING_SHO_REVIEW checks can be reviewed' });
    }

    if (action === 'reject') {
      const updated = await prisma.enforcement_checks.update({
        where: { id: BigInt(id) },
        data: {
          status: 'SHO_REJECTED',
          reviewed_by: BigInt(user.userId),
          reviewed_at: new Date(),
          review_notes: reviewNotes || null,
          updated_at: new Date(),
        },
      });
      await logAudit('UPDATE', 'ENFORCEMENT_CHECK', updated.id, req, `SHO rejected. Notes: ${reviewNotes || 'None'}`);
      return res.json(successResponse(updated, 'Enforcement check rejected'));
    }

    // Update the check with any edited/filled details before creating the consumer
    const checkUpdate: any = {};
    if (subjectName !== undefined) checkUpdate.subject_name = subjectName;
    if (subjectAge !== undefined) checkUpdate.subject_age = subjectAge ? parseInt(String(subjectAge)) : null;
    if (subjectGender !== undefined) checkUpdate.subject_gender = subjectGender || null;
    if (subjectAadhaar !== undefined) checkUpdate.subject_aadhaar = subjectAadhaar || null;
    if (subjectPhone !== undefined) checkUpdate.subject_phone = subjectPhone || null;
    if (subjectPan !== undefined) checkUpdate.subject_pan = subjectPan || null;
    if (subjectAddress !== undefined) checkUpdate.subject_address = subjectAddress || null;
    if (subjectFatherName !== undefined) checkUpdate.subject_father_name = subjectFatherName || null;
    if (subjectLandmark !== undefined) checkUpdate.subject_landmark = subjectLandmark || null;
    if (subjectOccupation !== undefined) checkUpdate.subject_occupation = subjectOccupation || null;

    let updatedCheck = check;
    if (Object.keys(checkUpdate).length > 0) {
      updatedCheck = await prisma.enforcement_checks.update({
        where: { id: BigInt(id) },
        data: checkUpdate,
      });
    }

    // ── SECURITY FIX #9: Race Condition in SL No Generation
    let offenderDistrict = updatedCheck.district || '';
    let offenderState = 'Andhra Pradesh';

    const ps = await prisma.police_stations.findUnique({
      where: { id: updatedCheck.ps_id }
    });
    if (ps) {
      if (!offenderDistrict) offenderDistrict = ps.district;
      if (ps.state) offenderState = ps.state;
    }

    let prefix = 'SL-';
    const stateCode = STATE_CODES[offenderState.toLowerCase().trim()];
    const districtNum = DISTRICT_NUMBERS[offenderDistrict.toLowerCase().trim()];
    if (stateCode && districtNum) {
      prefix = `${stateCode}${districtNum}-`;
    }

    // Approve: create consumer entry in offenders table (omit sl_no first)
    const newOffender = await prisma.offenders.create({
      data: {
        // sl_no: slNo, omitted for now
        full_name: updatedCheck.subject_name,
        age: updatedCheck.subject_age,
        gender: updatedCheck.subject_gender,
        category: 'CONSUMER',
        test_result: 'POSITIVE',
        status: 'ACTIVE',
        ps_id: updatedCheck.ps_id,
        district: updatedCheck.district,
        created_by: BigInt(user.userId),
        photo_url: updatedCheck.photo_url,
        father_husband_name: updatedCheck.subject_father_name,
        full_address: updatedCheck.subject_address,
        landmark_area: updatedCheck.subject_landmark,
        occupation: updatedCheck.subject_occupation,
      },
    });

    // ── SECURITY FIX #9: Update SL No atomically
    let finalSlNo = `SL-${100 + Number(newOffender.id)}`;
    if (stateCode && districtNum) {
      finalSlNo = `${stateCode}${districtNum}-${String(newOffender.id).padStart(4, '0')}`;
    }

    await prisma.offenders.update({
      where: { id: newOffender.id },
      data: { sl_no: finalSlNo }
    });

    // If Aadhaar, PAN, or Voter ID was captured, store it
    let voterId: string | null = null;
    if (updatedCheck.lookup_summary) {
      const match = updatedCheck.lookup_summary.match(/Voter ID:\s*([^\n\r]+)/);
      if (match && match[1] && match[1].trim() !== 'N/A') {
        voterId = match[1].trim();
      }
    }

    if (updatedCheck.subject_aadhaar || updatedCheck.subject_pan || voterId) {
      await prisma.offender_identity_docs.create({
        data: {
          offender_id: newOffender.id,
          aadhaar_no: updatedCheck.subject_aadhaar,
          pan_card: updatedCheck.subject_pan,
          voter_id: voterId,
        },
      });
    }

    // If phone number was captured, store it in offender_contacts
    if (updatedCheck.subject_phone) {
      await prisma.offender_contacts.create({
        data: {
          offender_id: newOffender.id,
          contact_type: 'MOBILE_PRIMARY',
          value: updatedCheck.subject_phone,
        },
      });
    }

    // If consumption type was captured, create drug profile
    if (updatedCheck.consumption_type) {
      try {
        const drugData = JSON.parse(updatedCheck.consumption_type);
        await prisma.offender_drug_profile.create({
          data: {
            offender_id: newOffender.id,
            addiction_type: drugData.addiction_type || 'GANJA_ONLY',
            consumption_frequency: drugData.consumption_frequency || null,
            source_of_procurement: drugData.source_of_procurement || null,
            mode_of_purchase: drugData.mode_of_purchase || null,
            usual_consumption_spot: drugData.usual_consumption_spot || null,
          },
        });
      } catch (e) {
        // Fallback for backward compatibility if not JSON
        await prisma.offender_drug_profile.create({
          data: {
            offender_id: newOffender.id,
            addiction_type: (updatedCheck.consumption_type as any) || 'GANJA_ONLY',
          },
        });
      }
    }

    // Update enforcement check
    const updated = await prisma.enforcement_checks.update({
      where: { id: BigInt(id) },
      data: {
        status: 'SHO_APPROVED',
        reviewed_by: BigInt(user.userId),
        reviewed_at: new Date(),
        review_notes: reviewNotes || null,
        committed_offender_id: newOffender.id,
        updated_at: new Date(),
      },
    });

    await logAudit('CREATE', 'OFFENDER', newOffender.id, req,
      `Consumer created from enforcement check #${id}. Name: ${updatedCheck.subject_name}`);
    await logAudit('UPDATE', 'ENFORCEMENT_CHECK', updated.id, req,
      `SHO approved. Consumer offender #${newOffender.id} created.`);

    res.json(successResponse({
      ...updated,
      committedOffenderId: newOffender.id.toString(),
    }, 'Approved — consumer entry created in offender database'));
  } catch (error) {
    console.error('reviewEnforcementCheck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 7. Submit Village Visit ──────────────────────────────────────────
export const submitVillageVisit = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const visit = await prisma.village_visits.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        village_name: data.village_name,
        verified_bad_chars: data.verified_bad_chars || false,
        verified_rowdies: data.verified_rowdies || false,
        verified_bound_overs: data.verified_bound_overs || false,
        verified_habitual: data.verified_habitual || false,
        interacted_elders: data.interacted_elders || false,
        intel_collected: data.intel_collected || false,
        drug_peddler_check: data.drug_peddler_check || false,
        drone_surveillance: data.drone_surveillance || false,
        vehicle_checking: data.vehicle_checking || false,
        palle_nidra: data.palle_nidra || false,
        no_suspicious_activity: data.no_suspicious_activity || false,
        intel_notes: data.intel_notes || null,
        geo_lat: data.geo_lat || null,
        geo_lng: data.geo_lng || null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'VILLAGE_VISIT', visit.id, req, `Village visit logged for ${data.village_name}`);
    res.status(201).json(successResponse({ ...visit, id: visit.id.toString() }, 'Village visit logged successfully'));
  } catch (error) {
    console.error('submitVillageVisit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 8. Submit Lodge Check ──────────────────────────────────────────
export const submitLodgeCheck = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a police station' });

    const data = req.body;

    const check = await prisma.lodge_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        lodge_name: data.lodge_name,
        owner_name: data.owner_name || null,
        manager_name: data.manager_name || null,
        location: data.location || null,
        checked_guest_register: data.checked_guest_register || false,
        verified_foreigners: data.verified_foreigners || false,
        verified_strangers: data.verified_strangers || false,
        verified_suspicious: data.verified_suspicious || false,
        no_suspicious_activity: data.no_suspicious_activity || false,
        findings_notes: data.findings_notes || null,
        geo_lat: data.geo_lat || null,
        geo_lng: data.geo_lng || null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'LODGE_CHECK', check.id, req, `Lodge check logged for ${data.lodge_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Lodge check logged successfully'));
  } catch (error) {
    console.error('submitLodgeCheck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Search Offenders for Frontend Verification ───────────────────────
export const searchOffenders = async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || query.length < 3) {
      return res.status(400).json({ message: 'Search query must be at least 3 characters long' });
    }

    const q = String(query).trim();

    // Find by Name
    const nameMatches = await prisma.offenders.findMany({
      where: { full_name: { contains: q, mode: 'insensitive' } },
      select: { id: true, full_name: true, category: true, status: true, photo_url: true, ps_id: true }
    });

    // Find by Aadhaar, PAN, Voter ID in identity docs
    const identityMatches = await prisma.offender_identity_docs.findMany({
      where: {
        OR: [
          { aadhaar_no: { contains: q } },
          { pan_card: { contains: q, mode: 'insensitive' } },
          { voter_id: { contains: q, mode: 'insensitive' } }
        ]
      },
      include: {
        offenders: {
          select: { id: true, full_name: true, category: true, status: true, photo_url: true, ps_id: true }
        }
      }
    });

    // Find by Phone Number
    const phoneMatches = await prisma.offender_contacts.findMany({
      where: {
        contact_type: { in: ['MOBILE_PRIMARY', 'MOBILE_SECONDARY', 'MOBILE_SIBLING', 'WHATSAPP'] },
        value: { contains: q }
      },
      include: {
        offenders: {
          select: { id: true, full_name: true, category: true, status: true, photo_url: true, ps_id: true }
        }
      }
    });

    // Merge and deduplicate results
    const map = new Map<bigint, any>();
    
    nameMatches.forEach(o => map.set(o.id, { ...o, matchReason: 'Name Match' }));
    identityMatches.forEach(i => {
      if (!map.has(i.offenders.id)) {
        map.set(i.offenders.id, { ...i.offenders, matchReason: 'ID Document Match' });
      }
    });
    phoneMatches.forEach(p => {
      if (!map.has(p.offenders.id)) {
        map.set(p.offenders.id, { ...p.offenders, matchReason: 'Phone Match' });
      }
    });

    const results = Array.from(map.values()).map(r => ({
      ...r,
      id: r.id.toString(), // Convert BigInt to string for JSON serialization
      ps_id: r.ps_id.toString()
    }));

    res.json(successResponse(results, 'Search completed'));
  } catch (error) {
    console.error('Error searching offenders:', error);
    res.status(500).json({ message: 'Failed to search offenders' });
  }
};

export const getUserLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const scopeFilter = getEnforcementWhere(user as ScopeUser);

    const includeBlock = {
      officer: { select: { full_name: true, role: true } },
      police_station: { select: { name: true } }
    };

    const typeQuery = req.query.type as string | undefined;

    const fetchVV = () => prisma.village_visits.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchLC = () => prisma.lodge_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchDD = () => prisma.drunk_drive_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchCC = () => prisma.courier_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchRC = () => prisma.railway_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchBC = () => prisma.bus_stand_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchRS = () => prisma.rowdy_sheeter_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchBO = () => prisma.bound_over_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchVC = () => prisma.vehicle_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchMV = () => prisma.mv_act_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchPC = () => prisma.petty_cases_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchPN = () => prisma.palle_nidra_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchDS = () => prisma.drone_surveillance_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });
    const fetchEN = () => prisma.enforcement_checks.findMany({ where: scopeFilter, include: includeBlock, take: 30, orderBy: { created_at: 'desc' } });

    let vv: any[] = [];
    let lc: any[] = [];
    let dd: any[] = [];
    let cc: any[] = [];
    let rc: any[] = [];
    let bc: any[] = [];
    let rs: any[] = [];
    let bo: any[] = [];
    let vc: any[] = [];
    let mv: any[] = [];
    let pc: any[] = [];
    let pn: any[] = [];
    let ds: any[] = [];
    let en: any[] = [];

    if (typeQuery && typeQuery !== 'ALL') {
      if (typeQuery === 'Village Visit') vv = await fetchVV();
      else if (typeQuery === 'Lodge Check') lc = await fetchLC();
      else if (typeQuery === 'Drunk Drive') dd = await fetchDD();
      else if (typeQuery === 'Courier Check') cc = await fetchCC();
      else if (typeQuery === 'Railway Check') rc = await fetchRC();
      else if (typeQuery === 'Bus Stand Check') bc = await fetchBC();
      else if (typeQuery === 'Rowdy Sheeter') rs = await fetchRS();
      else if (typeQuery === 'Bound Over') bo = await fetchBO();
      else if (typeQuery === 'Vehicle Check') vc = await fetchVC();
      else if (typeQuery === 'MV Act Case') mv = await fetchMV();
      else if (typeQuery === 'Petty Case') pc = await fetchPC();
      else if (typeQuery === 'Palle Nidra') pn = await fetchPN();
      else if (typeQuery === 'Drone Flight') ds = await fetchDS();
      else if (typeQuery === 'NDPS Verification') en = await fetchEN();
    } else {
      const results = await Promise.all([
        prisma.village_visits.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.lodge_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.drunk_drive_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.courier_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.railway_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.bus_stand_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.rowdy_sheeter_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.bound_over_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.vehicle_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.mv_act_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.petty_cases_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.palle_nidra_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.drone_surveillance_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } }),
        prisma.enforcement_checks.findMany({ where: scopeFilter, include: includeBlock, take: 10, orderBy: { created_at: 'desc' } })
      ]);
      vv = results[0];
      lc = results[1];
      dd = results[2];
      cc = results[3];
      rc = results[4];
      bc = results[5];
      rs = results[6];
      bo = results[7];
      vc = results[8];
      mv = results[9];
      pc = results[10];
      pn = results[11];
      ds = results[12];
      en = results[13];
    }

    const allLogs = [
      ...vv.map(i => ({
        type: 'Village Visit',
        title: i.village_name,
        location: `${i.village_name} (${(i.police_station as any)?.name || 'N/A'})`,
        notes: i.intel_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.visit_date,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Checklist: bad characters: ${i.verified_bad_chars ? 'Yes' : 'No'}, rowdies: ${i.verified_rowdies ? 'Yes' : 'No'}, bound overs: ${i.verified_bound_overs ? 'Yes' : 'No'}, habitual: ${i.verified_habitual ? 'Yes' : 'No'}`
      })),
      ...lc.map(i => ({
        type: 'Lodge Check',
        title: i.lodge_name,
        location: `${i.location ? i.location + ', ' : ''}${(i.police_station as any)?.name || 'N/A'}`,
        notes: i.findings_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.check_date,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Lodge: ${i.lodge_name}${i.owner_name ? `, Owner: ${i.owner_name}` : ''}${i.manager_name ? `, Manager: ${i.manager_name}` : ''}`
      })),
      ...dd.map(i => ({
        type: 'Drunk Drive',
        title: i.vehicle_no,
        location: (i.police_station as any)?.name || 'N/A',
        notes: i.remarks || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Driver: ${i.driver_name} (${i.driver_age ? i.driver_age + ' yrs' : 'N/A'}, ${i.driver_gender || 'N/A'}), BAC: ${i.bac_level} mg/100ml, Fine: ${i.fine_amount ? i.fine_amount + ' INR' : 'None'}, Impounded: ${i.vehicle_impounded ? 'Yes' : 'No'}`
      })),
      ...cc.map(i => ({
        type: 'Courier Check',
        title: i.courier_office_name,
        location: `${i.location ? i.location + ', ' : ''}${(i.police_station as any)?.name || 'N/A'}`,
        notes: i.findings_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Courier Office: ${i.courier_office_name}, Manager: ${i.manager_name || 'N/A'}, Parcels: ${i.scanned_parcels_count || 0}`
      })),
      ...rc.map(i => ({
        type: 'Railway Check',
        title: i.station_name,
        location: `${i.station_name} station (${(i.police_station as any)?.name || 'N/A'})`,
        notes: i.findings_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Trains Checked: ${i.trains_checked || 'N/A'}, Profiled: ${i.passengers_profiled || 0}, Luggage Inspected: ${i.luggage_inspected_count || 0}`
      })),
      ...bc.map(i => ({
        type: 'Bus Stand Check',
        title: i.bus_stand_name,
        location: `${i.bus_stand_name} (${(i.police_station as any)?.name || 'N/A'})`,
        notes: i.findings_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Buses Checked: ${i.buses_checked || 'N/A'}, Passengers: ${i.passengers_checked || 0}, Parcels Verified: ${i.parcels_verified ? 'Yes' : 'No'}`
      })),
      ...rs.map(i => ({
        type: 'Rowdy Sheeter',
        title: i.rowdy_sheeter_name,
        location: (i.police_station as any)?.name || 'N/A',
        notes: i.verification_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Rowdy Sheet No: ${i.rowdy_sheet_no || 'N/A'}, Status: ${i.activity_status || 'N/A'}, Employment: ${i.current_employment || 'N/A'}`
      })),
      ...bo.map(i => ({
        type: 'Bound Over',
        title: i.subject_name,
        location: (i.police_station as any)?.name || 'N/A',
        notes: i.findings_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Bound Over Date: ${i.bound_over_date ? new Date(i.bound_over_date).toLocaleDateString() : 'N/A'}, Expiry Date: ${i.expiry_date ? new Date(i.expiry_date).toLocaleDateString() : 'N/A'}, Court Order: ${i.court_order_no || 'N/A'}, Compliance: ${i.compliance_status || 'N/A'}`
      })),
      ...vc.map(i => ({
        type: 'Vehicle Check',
        title: i.vehicle_no,
        location: (i.police_station as any)?.name || 'N/A',
        notes: i.findings_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Driver: ${i.driver_name || 'N/A'} (Phone: ${i.driver_phone || 'N/A'}), Owner: ${i.owner_name || 'N/A'}, Checked Boot: ${i.checked_boot ? 'Yes' : 'No'}, Watchlist: ${i.watchlist_match ? 'Match' : 'Clear'}`
      })),
      ...mv.map(i => ({
        type: 'MV Act Case',
        title: i.vehicle_no,
        location: (i.police_station as any)?.name || 'N/A',
        notes: i.remarks || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Driver: ${i.driver_name}, Violation: ${i.violation_type}, Fine: ${i.fine_amount} INR, Challan No: ${i.challan_no || 'N/A'}`
      })),
      ...pc.map(i => ({
        type: 'Petty Case',
        title: i.accused_name,
        location: `${i.location ? i.location + ', ' : ''}${(i.police_station as any)?.name || 'N/A'}`,
        notes: i.remarks || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Section: ${i.act_section}, Fine: ${i.fine_amount ? i.fine_amount + ' INR' : 'None'}, Case No: ${i.petty_case_no || 'N/A'}`
      })),
      ...pn.map(i => ({
        type: 'Palle Nidra',
        title: i.village_name,
        location: `${i.village_name} village (${(i.police_station as any)?.name || 'N/A'})`,
        notes: i.intel_notes || i.interaction_details || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Grievances: ${i.grievances_collected || 'None'}`
      })),
      ...ds.map(i => ({
        type: 'Drone Flight',
        title: i.area_name,
        location: `${i.area_name} (${(i.police_station as any)?.name || 'N/A'})`,
        notes: i.findings_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Operator: ${i.drone_operator || 'N/A'}, Area: ${i.area_scanned_sqm ? i.area_scanned_sqm + ' sqm' : 'N/A'}, Ganja Detected: ${i.ganja_detected ? 'Yes' : 'No'}`
      })),
      ...en.map(i => ({
        type: 'NDPS Verification',
        title: i.subject_name,
        location: `${i.place_of_enforcement} (${(i.police_station as any)?.name || 'N/A'})`,
        notes: i.lookup_summary || i.review_notes || null,
        submittedBy: i.officer ? `${i.officer.full_name} (${i.officer.role})` : 'N/A',
        date: i.created_at,
        lat: i.geo_lat,
        lng: i.geo_lng,
        details: `Age/Gender: ${i.subject_age || 'N/A'}/${i.subject_gender || 'N/A'}, Test: ${i.test_result}, Consumption: ${i.consumption_type || 'N/A'}`
      }))
    ];

    allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(successResponse({ logs: allLogs.slice(0, 30) }, 'User logs fetched'));
  } catch (error) {
    console.error('Error fetching user logs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user logs.' });
  }
};

// ── 9. Submit Drunk & Drive Check ────────────────────────────────────
export const submitDrunkDrive = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    
    const check = await (prisma as any).drunk_drive_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        vehicle_no: data.vehicle_no,
        driver_name: data.driver_name,
        driver_age: data.driver_age ? parseInt(String(data.driver_age)) : null,
        driver_gender: data.driver_gender || null,
        bac_level: data.bac_level ? parseFloat(String(data.bac_level)) : 0,
        fine_amount: data.fine_amount ? parseFloat(String(data.fine_amount)) : null,
        vehicle_impounded: data.vehicle_impounded || false,
        no_suspicious_activity: data.no_suspicious_activity || false,
        remarks: data.remarks || null,
        geo_lat: data.geo_lat || null,
        geo_lng: data.geo_lng || null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'DRUNK_DRIVE_CHECK', check.id, req, `Drunk & Drive check logged for vehicle ${data.vehicle_no}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Drunk & Drive check logged successfully'));
  } catch (error) {
    console.error('submitDrunkDrive error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 10. Submit Courier Check ──────────────────────────────────────────
export const submitCourierCheck = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await (prisma as any).courier_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        courier_office_name: data.courier_office_name,
        location: data.location || null,
        manager_name: data.manager_name || null,
        checked_register: data.checked_register || false,
        checked_suspicious_parcels: data.checked_suspicious_parcels || false,
        scanned_parcels_count: data.scanned_parcels_count ? parseInt(String(data.scanned_parcels_count)) : null,
        no_suspicious_activity: data.no_suspicious_activity || false,
        findings_notes: data.findings_notes || null,
        geo_lat: data.geo_lat || null,
        geo_lng: data.geo_lng || null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'COURIER_CHECK', check.id, req, `Courier office check logged for ${data.courier_office_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Courier check logged successfully'));
  } catch (error) {
    console.error('submitCourierCheck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 11. Submit Railway Check ─────────────────────────────────────────
export const submitRailwayCheck = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await (prisma as any).railway_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        station_name: data.station_name,
        trains_checked: data.trains_checked || null,
        passengers_profiled: data.passengers_profiled ? parseInt(String(data.passengers_profiled)) : null,
        luggage_inspected_count: data.luggage_inspected_count ? parseInt(String(data.luggage_inspected_count)) : null,
        suspicious_luggage_found: data.suspicious_luggage_found || false,
        no_suspicious_activity: data.no_suspicious_activity || false,
        findings_notes: data.findings_notes || null,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'RAILWAY_CHECK', check.id, req, `Railway station check logged for ${data.station_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Railway check logged successfully'));
  } catch (error) {
    console.error('submitRailwayCheck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 12. Submit Bus Stand Check ────────────────────────────────────────
export const submitBusStandCheck = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await (prisma as any).bus_stand_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        bus_stand_name: data.bus_stand_name,
        buses_checked: data.buses_checked || null,
        passengers_checked: data.passengers_checked ? parseInt(String(data.passengers_checked)) : null,
        parcels_verified: data.parcels_verified || false,
        no_suspicious_activity: data.no_suspicious_activity || false,
        findings_notes: data.findings_notes || null,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'BUS_STAND_CHECK', check.id, req, `Bus stand check logged for ${data.bus_stand_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Bus stand check logged successfully'));
  } catch (error) {
    console.error('submitBusStandCheck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 13. Submit Rowdy Sheeter Check ────────────────────────────────────
export const submitRowdySheeter = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await prisma.rowdy_sheeter_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        rowdy_sheeter_name: data.rowdy_sheeter_name,
        rowdy_sheet_no: data.rowdy_sheet_no || null,
        activity_status: data.activity_status || null,
        verification_notes: data.verification_notes || null,
        associates_noted: data.associates_noted || null,
        current_employment: data.current_employment || null,
        no_suspicious_activity: data.no_suspicious_activity || false,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'ROWDY_SHEETER_CHECK', check.id, req, `Rowdy sheeter check logged for ${data.rowdy_sheeter_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Rowdy sheeter check logged successfully'));
  } catch (error) {
    console.error('submitRowdySheeter error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 14. Submit Bound Over Check ───────────────────────────────────────
export const submitBoundOver = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await prisma.bound_over_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        subject_name: data.subject_name,
        bound_over_date: data.bound_over_date ? new Date(data.bound_over_date) : null,
        expiry_date: data.expiry_date ? new Date(data.expiry_date) : null,
        court_order_no: data.court_order_no || null,
        compliance_status: data.compliance_status || null,
        violation_details: data.violation_details || null,
        no_suspicious_activity: data.no_suspicious_activity || false,
        findings_notes: data.findings_notes || null,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'BOUND_OVER_CHECK', check.id, req, `Bound over check logged for ${data.subject_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Bound over check logged successfully'));
  } catch (error) {
    console.error('submitBoundOver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 15. Submit Vehicle Check ──────────────────────────────────────────
export const submitVehicleCheck = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await prisma.vehicle_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        vehicle_no: data.vehicle_no,
        owner_name: data.owner_name || null,
        driver_name: data.driver_name || null,
        driver_phone: data.driver_phone || null,
        checked_boot: data.checked_boot || false,
        suspicious_items_found: data.suspicious_items_found || false,
        watchlist_match: data.watchlist_match || false,
        no_suspicious_activity: data.no_suspicious_activity || false,
        findings_notes: data.findings_notes || null,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'VEHICLE_CHECK', check.id, req, `Vehicle check logged for ${data.vehicle_no}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Vehicle check logged successfully'));
  } catch (error) {
    console.error('submitVehicleCheck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 16. Submit MV Act Check ───────────────────────────────────────────
export const submitMvAct = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await prisma.mv_act_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        vehicle_no: data.vehicle_no,
        driver_name: data.driver_name,
        violation_type: data.violation_type,
        fine_amount: data.fine_amount ? parseFloat(String(data.fine_amount)) : 0,
        challan_no: data.challan_no || null,
        remarks: data.remarks || null,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'MV_ACT_CHECK', check.id, req, `MV Act check logged for vehicle ${data.vehicle_no}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'MV Act check logged successfully'));
  } catch (error) {
    console.error('submitMvAct error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 17. Submit Petty Cases Check ──────────────────────────────────────
export const submitPettyCases = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await prisma.petty_cases_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        accused_name: data.accused_name,
        petty_case_no: data.petty_case_no || null,
        act_section: data.act_section,
        fine_amount: data.fine_amount ? parseFloat(String(data.fine_amount)) : null,
        location: data.location || null,
        no_suspicious_activity: data.no_suspicious_activity || false,
        remarks: data.remarks || null,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'PETTY_CASES_CHECK', check.id, req, `Petty case logged for ${data.accused_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Petty case check logged successfully'));
  } catch (error) {
    console.error('submitPettyCases error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 18. Submit Palle Nidra Check ──────────────────────────────────────
export const submitPalleNidra = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await prisma.palle_nidra_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        village_name: data.village_name,
        interaction_details: data.interaction_details || null,
        grievances_collected: data.grievances_collected || null,
        intel_notes: data.intel_notes || null,
        no_suspicious_activity: data.no_suspicious_activity || false,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'PALLE_NIDRA_CHECK', check.id, req, `Palle Nidra logged for ${data.village_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Palle Nidra check logged successfully'));
  } catch (error) {
    console.error('submitPalleNidra error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 19. Submit Drone Surveillance Check ───────────────────────────────
export const submitDroneSurveillance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const psId = user.policeStationId;
    if (!psId) return res.status(400).json({ message: 'Officer must be assigned to a PS' });

    const data = req.body;
    const check = await prisma.drone_surveillance_checks.create({
      data: {
        ps_id: BigInt(psId),
        officer_id: BigInt(user.userId),
        area_name: data.area_name,
        drone_operator: data.drone_operator || null,
        area_scanned_sqm: data.area_scanned_sqm ? parseFloat(String(data.area_scanned_sqm)) : null,
        ganja_detected: data.ganja_detected || false,
        findings_notes: data.findings_notes || null,
        no_suspicious_activity: data.no_suspicious_activity || false,
        geo_lat: data.geo_lat ? parseFloat(String(data.geo_lat)) : null,
        geo_lng: data.geo_lng ? parseFloat(String(data.geo_lng)) : null,
        photo_url: data.photo_url || null,
      }
    });

    await logAudit('CREATE', 'DRONE_SURVEILLANCE_CHECK', check.id, req, `Drone surveillance logged for ${data.area_name}`);
    res.status(201).json(successResponse({ ...check, id: check.id.toString() }, 'Drone surveillance check logged successfully'));
  } catch (error) {
    console.error('submitDroneSurveillance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

