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
      noSuspiciousActivity // boolean
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

    const check = await prisma.enforcement_checks.create({
      data: {
        ps_id: BigInt(psId),
        created_by: BigInt(user.userId),
        subject_name: subjectName,
        subject_age: subjectAge ? parseInt(subjectAge) : null,
        subject_gender: subjectGender || null,
        subject_aadhaar: subjectAadhaar || null,
        photo_url: photoUrl || null,
        place_of_enforcement: placeOfEnforcement,
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
    ] = await Promise.all([
      prisma.enforcement_checks.count({ where: monthWhere }),
      prisma.enforcement_checks.count({ where: { ...monthWhere, test_result: 'POSITIVE' } }),
      prisma.enforcement_checks.count({ where: { ...monthWhere, test_result: 'NEGATIVE' } }),
      prisma.enforcement_checks.count({ where: { ...where, status: 'PENDING_SHO_REVIEW' } }),
      prisma.village_visits.count({ where: villageMonthWhere }),
      prisma.lodge_checks.count({ where: lodgeMonthWhere }),
    ]);

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
    const psCondition = where.ps_id
      ? `AND ps_id = ${where.ps_id}`
      : (stationsToQuery && stationsToQuery.length > 0
          ? `AND ps_id IN (${stationsToQuery.map(s => s.id).join(',')})`
          : 'AND 1=0');

    const monthlyTrend = await prisma.$queryRawUnsafe<{ month: string; positive: bigint; negative: bigint; total: bigint }[]>(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
              COUNT(*) FILTER (WHERE test_result = 'POSITIVE')::bigint AS positive,
              COUNT(*) FILTER (WHERE test_result = 'NEGATIVE')::bigint AS negative,
              COUNT(*)::bigint AS total
       FROM enforcement_checks
       WHERE created_at >= $1 ${psCondition}
       GROUP BY 1 ORDER BY 1`,
      sixMonthsAgo
    );

    // Place-of-enforcement frequency
    const placeFrequency = await prisma.enforcement_checks.groupBy({
      by: ['place_of_enforcement'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Recent activities (Enforcement Checks, Village Visits, and Lodge Checks)
    const [recentChecks, recentVisits, recentLodges] = await Promise.all([
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
      const [vvCounts, lcCounts, ecCounts] = await Promise.all([
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
      ]);

      const breakdownMap = new Map<string, { ps_id: string; ps_name: string; visits: number; lodges: number; ndps: number; total: number }>();
      
      breakdownStations.forEach(s => {
        breakdownMap.set(s.id.toString(), {
          ps_id: s.id.toString(),
          ps_name: s.name,
          visits: 0,
          lodges: 0,
          ndps: 0,
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

    // Auto-generate the unique sl_no for consumer DB entry
    let slNo: string | null = null;
    let offenderDistrict = updatedCheck.district || '';
    let offenderState = 'Andhra Pradesh';

    const ps = await prisma.police_stations.findUnique({
      where: { id: updatedCheck.ps_id }
    });
    if (ps) {
      if (!offenderDistrict) offenderDistrict = ps.district;
      if (ps.state) offenderState = ps.state;
    }

    const stateCode = STATE_CODES[offenderState.toLowerCase().trim()];
    const districtNum = DISTRICT_NUMBERS[offenderDistrict.toLowerCase().trim()];

    if (stateCode && districtNum) {
      const prefix = `${stateCode}${districtNum}-`;
      const count = await prisma.offenders.count({
        where: {
          sl_no: {
            startsWith: prefix
          }
        }
      });
      const nextNum = count + 1;
      slNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
    } else {
      const prefix = 'SL-';
      const count = await prisma.offenders.count({
        where: {
          sl_no: {
            startsWith: prefix
          }
        }
      });
      slNo = `${prefix}${(100 + count).toString()}`;
    }

    // Approve: create consumer entry in offenders table
    const newOffender = await prisma.offenders.create({
      data: {
        sl_no: slNo,
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

