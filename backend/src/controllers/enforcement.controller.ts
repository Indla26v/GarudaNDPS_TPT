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
function getEnforcementWhere(user: ScopeUser): Record<string, unknown> {
  const DISTRICT_ROLES = ['SP', 'ASP'];
  if (!user?.role) return { id: BigInt(-1) };
  if (DISTRICT_ROLES.includes(user.role)) return {};
  if (user.policeStationId) return { ps_id: BigInt(user.policeStationId) };
  return {};
}

// ── 1. Create field enforcement check ─────────────────────────────────
export const createEnforcementCheck = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      subjectName,
      subjectAge,
      subjectGender,
      subjectAadhaar,
      placeOfEnforcement,
      photoUrl,
      subjectPhone,
      subjectPan,
      subjectAddress,
      subjectFatherName,
      subjectLandmark,
      subjectOccupation
    } = req.body;

    if (!subjectName || !placeOfEnforcement) {
      return res.status(400).json({ message: 'Subject name and place of enforcement are required' });
    }

    // Determine PS — use the officer's assigned PS
    const psId = user.policeStationId;
    if (!psId) {
      return res.status(400).json({ message: 'Officer must be assigned to a police station' });
    }

    // ── Run identity lookups ────────────────────────────────────────────
    let ndpsMatch = false;
    let matchedOffenderId: bigint | null = null;
    let criminalRecordFound = false;
    const lookupResults: string[] = [];

    // 1. Aadhaar lookup
    if (subjectAadhaar && subjectAadhaar.length === 12) {
      const aadhaarHit = await prisma.offender_identity_docs.findFirst({
        where: { aadhaar_no: subjectAadhaar },
        include: { offenders: { select: { id: true, full_name: true, category: true, status: true } } },
      });
      if (aadhaarHit) {
        ndpsMatch = true;
        matchedOffenderId = aadhaarHit.offenders.id;
        lookupResults.push(`Aadhaar match: ${aadhaarHit.offenders.full_name} (${aadhaarHit.offenders.category || 'Unknown category'}, Status: ${aadhaarHit.offenders.status})`);
      }
    }

    // 2. Name-based fuzzy match (case-insensitive partial match)
    if (!matchedOffenderId) {
      const nameHits = await prisma.offenders.findMany({
        where: {
          full_name: { contains: subjectName, mode: 'insensitive' },
        },
        take: 5,
        select: { id: true, full_name: true, category: true, status: true, ps_id: true },
      });
      if (nameHits.length > 0) {
        ndpsMatch = true;
        matchedOffenderId = nameHits[0]?.id || null;
        nameHits.forEach(h => {
          lookupResults.push(`Name match: ${h.full_name} (${h.category || 'N/A'}, Status: ${h.status})`);
        });
      }
    }

    // 3. Criminal record check via case_accused
    if (matchedOffenderId) {
      const accusedRecords = await prisma.case_accused.findMany({
        where: { offender_id: matchedOffenderId },
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
    const check = await prisma.enforcement_checks.create({
      data: {
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
        ndps_match: ndpsMatch,
        matched_offender_id: matchedOffenderId,
        criminal_record_found: criminalRecordFound,
        lookup_summary: lookupSummary,
        created_by: BigInt(user.userId),
        ps_id: BigInt(psId),
        status: 'FIELD_CREATED',
        test_result: 'PENDING',
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
    const where = getEnforcementWhere(user);

    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthWhere: any = { ...where, created_at: { gte: monthStart } };

    // Overall counts (this month)
    const [totalThisMonth, positiveThisMonth, negativeThisMonth, pendingReview] = await Promise.all([
      prisma.enforcement_checks.count({ where: monthWhere }),
      prisma.enforcement_checks.count({ where: { ...monthWhere, test_result: 'POSITIVE' } }),
      prisma.enforcement_checks.count({ where: { ...monthWhere, test_result: 'NEGATIVE' } }),
      prisma.enforcement_checks.count({ where: { ...where, status: 'PENDING_SHO_REVIEW' } }),
    ]);

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const psCondition = (where as any).ps_id ? `AND ps_id = ${(where as any).ps_id}` : '';

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

    // Recent enforcement checks
    const recentChecks = await prisma.enforcement_checks.findMany({
      where,
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        police_station: { select: { name: true, ps_code: true } },
        officer: { select: { full_name: true } },
      },
    });

    // Total all-time counts
    const [totalAllTime, positiveAllTime, negativeAllTime] = await Promise.all([
      prisma.enforcement_checks.count({ where }),
      prisma.enforcement_checks.count({ where: { ...where, test_result: 'POSITIVE' } }),
      prisma.enforcement_checks.count({ where: { ...where, test_result: 'NEGATIVE' } }),
    ]);

    // Station-wise breakdown (for SDPO/SP)
    let stationBreakdown: any[] = [];
    const DISTRICT_ROLES = ['SP', 'ASP'];
    if (DISTRICT_ROLES.includes(user.role)) {
      const stationData = await prisma.$queryRawUnsafe<{ ps_id: bigint; ps_name: string; positive: bigint; negative: bigint; total: bigint }[]>(
        `SELECT ec.ps_id, ps.name AS ps_name,
                COUNT(*) FILTER (WHERE ec.test_result = 'POSITIVE')::bigint AS positive,
                COUNT(*) FILTER (WHERE ec.test_result = 'NEGATIVE')::bigint AS negative,
                COUNT(*)::bigint AS total
         FROM enforcement_checks ec
         JOIN police_stations ps ON ps.id = ec.ps_id
         WHERE ec.created_at >= $1
         GROUP BY ec.ps_id, ps.name
         ORDER BY total DESC`,
        monthStart
      );
      stationBreakdown = stationData;
    }

    res.json(successResponse({
      thisMonth: { total: totalThisMonth, positive: positiveThisMonth, negative: negativeThisMonth },
      allTime: { total: totalAllTime, positive: positiveAllTime, negative: negativeAllTime },
      pendingReview,
      monthlyTrend,
      placeFrequency: placeFrequency.map(p => ({
        place: p.place_of_enforcement,
        count: p._count.id,
      })),
      recentChecks,
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

    // If Aadhaar or PAN was captured, store it
    if (updatedCheck.subject_aadhaar || updatedCheck.subject_pan) {
      await prisma.offender_identity_docs.create({
        data: {
          offender_id: newOffender.id,
          aadhaar_no: updatedCheck.subject_aadhaar,
          pan_card: updatedCheck.subject_pan,
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
      await prisma.offender_drug_profile.create({
        data: {
          offender_id: newOffender.id,
          addiction_type: 'GANJA_ONLY', // default
        },
      });
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
