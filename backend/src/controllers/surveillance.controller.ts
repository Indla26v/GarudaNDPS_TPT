import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, getCaseWhere, getOffenderWhere, ScopeUser } from '../utils/scope';
import { logAudit } from '../utils/auditLogger';
import { paramId } from '../utils/params';
import { maskMobile, maskImei, canRevealAadhaar } from '../utils/pii';
import { broadcastEvent } from './sse.controller';
import { parseTowerDump } from '../services/towerParser';
import * as correlation from '../services/surveillanceAnalysis';

const MOBILE_CONTACT_TYPES = ['MOBILE_PRIMARY', 'MOBILE_SECONDARY', 'MOBILE_SIBLING'] as const;

// Scope helper for offender-linked tables (contacts, imei, social, messaging)
function linkedOffenderScope(user: ScopeUser): any {
  return { offenders: getOffenderWhere(user) };
}

async function offenderInScope(offenderId: bigint, user: ScopeUser): Promise<boolean> {
  const found = await prisma.offenders.findFirst({
    where: { id: offenderId, ...getOffenderWhere(user) },
    select: { id: true },
  });
  return !!found;
}

// Helper: build scoping where clause for surveillance_records based on linked offender's police station
function getSurveillanceWhere(user: ScopeUser): Record<string, any> {
  const { psFilter } = getDashboardScope(user);
  
  if (psFilter.ps_id) {
    return { offenders: { ps_id: psFilter.ps_id } };
  } else if (psFilter.police_stations) {
    return { offenders: { police_stations: psFilter.police_stations } };
  }
  return {};
}

// GET /api/surveillance
export const listSurveillanceRecords = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const baseWhere = getSurveillanceWhere(user);
    const { status, offenderId } = req.query;

    const whereClause: any = { ...baseWhere };
    if (status) {
      whereClause.verification_status = status;
    }
    if (offenderId) {
      whereClause.offender_id = BigInt(String(offenderId));
    }

    const records = await prisma.surveillance_records.findMany({
      where: whereClause,
      include: {
        offenders: {
          select: { id: true, full_name: true, alias: true, photo_url: true }
        },
        users: {
          select: { id: true, full_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const data = records.map((r) => ({
      id: r.id.toString(),
      offenderId: r.offender_id.toString(),
      offenderName: r.offenders?.full_name || '—',
      offenderAlias: r.offenders?.alias || '',
      offenderPhoto: r.offenders?.photo_url || null,
      scheduledDate: r.scheduled_date,
      verifiedBy: r.verified_by?.toString() || null,
      verifiedByName: r.users?.full_name || '—',
      verificationStatus: r.verification_status,
      currentAddress: r.current_address || '',
      currentOccupation: r.current_occupation || '',
      associatesNoted: r.associates_noted || '',
      geo_lat: r.geo_lat ? Number(r.geo_lat) : null,
      geo_lng: r.geo_lng ? Number(r.geo_lng) : null,
      notes: r.notes || '',
      createdAt: r.created_at
    }));

    res.json(successResponse(data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch surveillance records' });
  }
};

// POST /api/surveillance
export const createSurveillanceRecord = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const { offenderId, scheduledDate, status, currentAddress, currentOccupation, associatesNoted, geo_lat, geo_lng, notes } = req.body;

    if (!offenderId) {
      return res.status(400).json({ message: 'Offender ID is required' });
    }

    const record = await prisma.surveillance_records.create({
      data: {
        offender_id: BigInt(offenderId),
        scheduled_date: scheduledDate ? new Date(scheduledDate) : null,
        verification_status: status || 'PENDING',
        current_address: currentAddress || null,
        current_occupation: currentOccupation || null,
        associates_noted: associatesNoted || null,
        geo_lat: geo_lat ? parseFloat(String(geo_lat)) : null,
        geo_lng: geo_lng ? parseFloat(String(geo_lng)) : null,
        notes: notes || null,
        verified_by: userId
      }
    });

    await logAudit('CREATE', 'SURVEILLANCE_RECORD', record.id, req, `Created surveillance record for offender #${offenderId}`);

    res.status(201).json(successResponse({ id: record.id.toString() }, 'Surveillance record logged successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to log surveillance record' });
  }
};

// PUT /api/surveillance/:id
export const updateSurveillanceRecord = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const recordId = BigInt(req.params.id as string);
    const { status, currentAddress, currentOccupation, associatesNoted, geo_lat, geo_lng, notes } = req.body;

    const existing = await prisma.surveillance_records.findUnique({
      where: { id: recordId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Surveillance record not found' });
    }

    const updateData: any = {
      verification_status: status || undefined,
      current_address: currentAddress !== undefined ? currentAddress : undefined,
      current_occupation: currentOccupation !== undefined ? currentOccupation : undefined,
      associates_noted: associatesNoted !== undefined ? associatesNoted : undefined,
      geo_lat: geo_lat ? parseFloat(String(geo_lat)) : undefined,
      geo_lng: geo_lng ? parseFloat(String(geo_lng)) : undefined,
      notes: notes !== undefined ? notes : undefined,
    };
    if (userId !== null) {
      updateData.verified_by = userId;
    }

    const updated = await prisma.surveillance_records.update({
      where: { id: recordId },
      data: updateData
    });

    await logAudit('UPDATE', 'SURVEILLANCE_RECORD', recordId, req, `Updated surveillance record status to ${status || existing.verification_status}`);

    res.json(successResponse({ id: updated.id.toString() }, 'Surveillance record updated successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update surveillance record' });
  }
};

// GET /api/surveillance/offender/:offenderId
export const getOffenderSurveillanceHistory = async (req: Request, res: Response) => {
  try {
    const offenderId = BigInt(req.params.offenderId as string);

    const records = await prisma.surveillance_records.findMany({
      where: { offender_id: offenderId },
      include: {
        users: {
          select: { id: true, full_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const data = records.map((r) => ({
      id: r.id.toString(),
      offenderId: r.offender_id.toString(),
      scheduledDate: r.scheduled_date,
      verifiedBy: r.verified_by?.toString() || null,
      verifiedByName: r.users?.full_name || '—',
      verificationStatus: r.verification_status,
      currentAddress: r.current_address || '',
      currentOccupation: r.current_occupation || '',
      associatesNoted: r.associates_noted || '',
      geo_lat: r.geo_lat ? Number(r.geo_lat) : null,
      geo_lng: r.geo_lng ? Number(r.geo_lng) : null,
      notes: r.notes || '',
      createdAt: r.created_at
    }));

    res.json(successResponse(data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch offender surveillance history' });
  }
};

// ── Dashboard summary ──────────────────────────────────────────────────
export const getSurveillanceDashboard = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const offScope = linkedOffenderScope(user);
    const towerScope = { cases: getCaseWhere(user) };

    const [trackedMobiles, imeiCount, simSwaps, socialCount, messagingCount, surveillanceCount, towerLogCount] =
      await Promise.all([
        prisma.offender_contacts.count({ where: { ...offScope, contact_type: { in: [...MOBILE_CONTACT_TYPES] } } }),
        prisma.imei_records.count({ where: offScope }),
        prisma.imei_records.count({ where: { ...offScope, status: 'SWAPPED' } }),
        prisma.social_media_intel.count({ where: offScope }),
        prisma.messaging_intel.count({ where: offScope }),
        prisma.surveillance_records.count({ where: offScope }),
        prisma.tower_match_logs.count({ where: towerScope }),
      ]);

    const corr = await correlation.findCrossCaseCorrelations();

    res.json(
      successResponse({
        kpis: {
          trackedMobiles,
          imeiRecords: imeiCount,
          simSwaps,
          socialIntel: socialCount,
          messagingIntel: messagingCount,
          surveillanceRecords: surveillanceCount,
          towerLogs: towerLogCount,
          crossCaseMobiles: corr.duplicateMobiles.length,
          crossCaseImeis: corr.duplicateImeis.length,
        },
        recentCorrelations: {
          mobiles: corr.duplicateMobiles.slice(0, 10).map((m) => ({ ...m, mobile_number: maskMobile(m.mobile_number) })),
          imeis: corr.duplicateImeis.slice(0, 10).map((i) => ({ ...i, imei_number: maskImei(i.imei_number) })),
        },
      })
    );
  } catch (error) {
    console.error('getSurveillanceDashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Mobile tracking (stored as offender_contacts) ──────────────────────
export const addMobile = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { offenderId, value, contactType, notes } = req.body;
    if (!offenderId || !value) return res.status(400).json({ message: 'offenderId and value are required' });
    if (!(await offenderInScope(BigInt(offenderId), user))) {
      return res.status(404).json({ message: 'Offender not found or access denied' });
    }
    const type = MOBILE_CONTACT_TYPES.includes(contactType) ? contactType : 'MOBILE_PRIMARY';
    const contact = await prisma.offender_contacts.create({
      data: { offender_id: BigInt(offenderId), contact_type: type, value: String(value).trim(), notes: notes || null },
    });

    await logAudit('CREATE', 'SURVEILLANCE_MOBILE', contact.id, req, `Tracked mobile linked to offender #${offenderId}`);
    broadcastEvent('surveillance_mobile_added', { offenderId: String(offenderId) });
    res.status(201).json(successResponse({ id: contact.id.toString() }, 'Mobile link added'));
  } catch (error) {
    console.error('addMobile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listMobiles = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { offenderId, reveal, page = '0', size = '30' } = req.query;
    const doReveal = String(reveal) === 'true' && canRevealAadhaar(user.role || '');
    if (doReveal) await logAudit('VIEW', 'SURVEILLANCE_MOBILE', null, req, 'PII_REVEALED: mobile numbers');

    const where: any = { ...linkedOffenderScope(user), contact_type: { in: [...MOBILE_CONTACT_TYPES] } };
    if (offenderId) where.offender_id = BigInt(String(offenderId));

    const skip = Number(page) * Number(size);
    const take = Number(size);
    const [rows, total] = await Promise.all([
      prisma.offender_contacts.findMany({
        where,
        include: { offenders: { select: { id: true, full_name: true, alias: true, photo_url: true, status: true, risk_score: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.offender_contacts.count({ where }),
    ]);

    res.json(
      successResponse({
        content: rows.map((c) => ({
          id: c.id.toString(),
          offenderId: c.offender_id.toString(),
          offenderName: c.offenders?.full_name ?? null,
          offenderAlias: c.offenders?.alias ?? null,
          offenderPhoto: c.offenders?.photo_url ?? null,
          offenderStatus: c.offenders?.status ?? null,
          riskScore: c.offenders?.risk_score ?? null,
          contactType: c.contact_type,
          value: doReveal ? c.value : maskMobile(c.value),
          masked: !doReveal,
          notes: c.notes,
          createdAt: c.created_at,
        })),
        totalElements: total,
        totalPages: Math.ceil(total / take),
      })
    );
  } catch (error) {
    console.error('listMobiles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── IMEI register + SIM swap detection ─────────────────────────────────
export const addImei = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const { offenderId, imeiNumber, deviceMake, deviceModel, simNumber, simProvider, mobileNumber, status, notes } = req.body;
    if (!offenderId || !imeiNumber) return res.status(400).json({ message: 'offenderId and imeiNumber are required' });
    if (!(await offenderInScope(BigInt(offenderId), user))) {
      return res.status(404).json({ message: 'Offender not found or access denied' });
    }

    const conflicts = await correlation.detectSimSwapConflicts(String(imeiNumber), mobileNumber ? String(mobileNumber) : null);

    const rec = await prisma.imei_records.create({
      data: {
        offender_id: BigInt(offenderId),
        imei_number: String(imeiNumber).trim(),
        device_make: deviceMake || null,
        device_model: deviceModel || null,
        sim_number: simNumber || null,
        sim_provider: simProvider || null,
        mobile_number: mobileNumber || null,
        status: conflicts.length > 0 ? 'SWAPPED' : status || 'ACTIVE',
        notes: notes || null,
        created_by: userId,
      },
    });

    await logAudit('CREATE', 'IMEI_RECORD', rec.id, req, `IMEI registered for offender #${offenderId}`);
    if (conflicts.length > 0) {
      await logAudit('UPDATE', 'IMEI_RECORD', rec.id, req, `SIM_SWAP detected: ${conflicts.map((c) => c.detail).join(' | ')}`);
      broadcastEvent('sim_swap_detected', {
        imeiId: rec.id.toString(),
        offenderId: String(offenderId),
        conflicts: conflicts.map((c) => ({ ...c, mobile_number: maskMobile(c.mobile_number), imei_number: maskImei(c.imei_number) })),
      });
    }

    res.status(201).json(successResponse({ id: rec.id.toString(), simSwapDetected: conflicts.length > 0, conflicts }, 'IMEI record added'));
  } catch (error) {
    console.error('addImei error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listImeis = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { offenderId, reveal } = req.query;
    const doReveal = String(reveal) === 'true' && canRevealAadhaar(user.role || '');
    if (doReveal) await logAudit('VIEW', 'IMEI_RECORD', null, req, 'PII_REVEALED: IMEI numbers');

    const where: any = { ...linkedOffenderScope(user) };
    if (offenderId) where.offender_id = BigInt(String(offenderId));

    const rows = await prisma.imei_records.findMany({
      where,
      include: { offenders: { select: { id: true, full_name: true, alias: true } } },
      orderBy: [{ imei_number: 'asc' }, { first_seen: 'asc' }],
      take: 500,
    });

    // Group by imei_number to build SIM-swap history timelines
    const byImei = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.imei_number;
      if (!byImei.has(key)) byImei.set(key, []);
      byImei.get(key)!.push(r);
    }

    const content = rows.map((r) => {
      const siblings = byImei.get(r.imei_number) || [];
      const history = siblings
        .filter((s) => s.mobile_number)
        .map((s) => ({
          mobile: doReveal ? s.mobile_number : maskMobile(s.mobile_number),
          simProvider: s.sim_provider,
          firstSeen: s.first_seen,
          lastSeen: s.last_seen,
        }));
      return {
        id: r.id.toString(),
        offenderId: r.offender_id.toString(),
        offenderName: r.offenders?.full_name ?? null,
        imei: doReveal ? r.imei_number : maskImei(r.imei_number),
        masked: !doReveal,
        deviceMake: r.device_make,
        deviceModel: r.device_model,
        simNumber: doReveal ? r.sim_number : maskMobile(r.sim_number),
        simProvider: r.sim_provider,
        mobile: doReveal ? r.mobile_number : maskMobile(r.mobile_number),
        status: r.status,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        hasSwapHistory: history.length > 1,
        swapHistory: history,
        notes: r.notes,
      };
    });

    res.json(successResponse({ content, total: content.length }));
  } catch (error) {
    console.error('listImeis error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Geo map logs (GeoJSON) ─────────────────────────────────────────────
export const getMapLogs = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};

    const survs = await prisma.surveillance_records.findMany({
      where: { ...linkedOffenderScope(user), geo_lat: { not: null }, geo_lng: { not: null } },
      include: { offenders: { select: { id: true, full_name: true, risk_score: true } } },
      take: 1000,
    });
    const towers = await prisma.tower_match_logs.findMany({
      where: { cases: getCaseWhere(user) },
      include: { cases: { select: { fir_no: true } } },
      orderBy: { hit_time: 'desc' },
      take: 2000,
    });

    const features: any[] = [];
    for (const s of survs) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(s.geo_lng), Number(s.geo_lat)] },
        properties: {
          kind: 'checkin',
          id: s.id.toString(),
          offenderId: s.offender_id.toString(),
          offenderName: s.offenders?.full_name ?? null,
          riskScore: s.offenders?.risk_score ?? null,
          status: s.verification_status,
          date: s.scheduled_date,
        },
      });
    }
    for (const t of towers) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(t.longitude), Number(t.latitude)] },
        properties: {
          kind: 'tower',
          id: t.id.toString(),
          cellTowerId: t.cell_tower_id,
          mobile: maskMobile(t.mobile_number),
          provider: t.provider,
          firNo: t.cases?.fir_no ?? null,
          hitTime: t.hit_time,
        },
      });
    }

    res.json(successResponse({ type: 'FeatureCollection', features }));
  } catch (error) {
    console.error('getMapLogs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Social media intel ─────────────────────────────────────────────────
export const addSocialIntel = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const { offenderId, platform, handleOrUrl, rating, notes } = req.body;
    if (!offenderId || !platform || !handleOrUrl) {
      return res.status(400).json({ message: 'offenderId, platform and handleOrUrl are required' });
    }
    if (!userId) return res.status(401).json({ message: 'Authentication required' });
    if (!(await offenderInScope(BigInt(offenderId), user))) {
      return res.status(404).json({ message: 'Offender not found or access denied' });
    }

    const rec = await prisma.social_media_intel.create({
      data: {
        offender_id: BigInt(offenderId),
        platform: String(platform),
        handle_or_url: String(handleOrUrl),
        rating: rating || 'UNVERIFIED',
        notes: notes || null,
        created_by: userId,
      },
    });

    await logAudit('CREATE', 'SOCIAL_INTEL', rec.id, req, `Social intel (${platform}) for offender #${offenderId}`);
    if (rating === 'CONFIRMED') {
      broadcastEvent('surveillance_intel_logged', { type: 'social', platform, offenderId: String(offenderId) });
    }
    res.status(201).json(successResponse({ id: rec.id.toString() }, 'Social media intel logged'));
  } catch (error) {
    console.error('addSocialIntel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Messaging intel ────────────────────────────────────────────────────
export const addMessagingIntel = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const { offenderId, platform, sourceType, disposition, inputText } = req.body;
    if (!offenderId || !platform || !inputText) {
      return res.status(400).json({ message: 'offenderId, platform and inputText are required' });
    }
    if (!userId) return res.status(401).json({ message: 'Authentication required' });
    if (!(await offenderInScope(BigInt(offenderId), user))) {
      return res.status(404).json({ message: 'Offender not found or access denied' });
    }

    const rec = await prisma.messaging_intel.create({
      data: {
        offender_id: BigInt(offenderId),
        platform: String(platform),
        source_type: sourceType || 'TIP_OFF',
        disposition: disposition || null,
        input_text: String(inputText),
        created_by: userId,
      },
    });

    await logAudit('CREATE', 'MESSAGING_INTEL', rec.id, req, `Messaging intel (${platform}) for offender #${offenderId}`);
    res.status(201).json(successResponse({ id: rec.id.toString() }, 'Messaging intel logged'));
  } catch (error) {
    console.error('addMessagingIntel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Cross-case correlations ────────────────────────────────────────────
export const getCorrelations = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const doReveal = String(req.query.reveal) === 'true' && canRevealAadhaar(user.role || '');
    if (doReveal) await logAudit('VIEW', 'SURVEILLANCE_CORRELATION', null, req, 'PII_REVEALED: correlation numbers');

    const corr = await correlation.findCrossCaseCorrelations();

    const caseIds = [...new Set(corr.duplicateMobiles.flatMap((m) => m.case_ids))].map((s) => BigInt(s));
    const cases = caseIds.length
      ? await prisma.cases.findMany({
          where: { id: { in: caseIds } },
          select: { id: true, fir_no: true, police_stations: { select: { name: true } } },
        })
      : [];
    const caseMap = new Map(cases.map((c) => [c.id.toString(), { firNo: c.fir_no, psName: c.police_stations?.name ?? null }]));

    const offIds = [...new Set(corr.duplicateImeis.flatMap((i) => i.offender_ids))].map((s) => BigInt(s));
    const offs = offIds.length
      ? await prisma.offenders.findMany({ where: { id: { in: offIds } }, select: { id: true, full_name: true } })
      : [];
    const offMap = new Map(offs.map((o) => [o.id.toString(), o.full_name]));

    res.json(
      successResponse({
        duplicateMobiles: corr.duplicateMobiles.map((m) => ({
          mobile: doReveal ? m.mobile_number : maskMobile(m.mobile_number),
          caseCount: m.case_count,
          cases: m.case_ids.map((id) => ({ id, ...(caseMap.get(id) || { firNo: null, psName: null }) })),
        })),
        duplicateImeis: corr.duplicateImeis.map((i) => ({
          imei: doReveal ? i.imei_number : maskImei(i.imei_number),
          offenderCount: i.offender_count,
          offenders: i.offender_ids.map((id) => ({ id, name: offMap.get(id) || null })),
        })),
      })
    );
  } catch (error) {
    console.error('getCorrelations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Tower dump upload + intersection ───────────────────────────────────
export const uploadTowerDump = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const file = (req as any).file;
    const { caseId } = req.body;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });
    if (!caseId) return res.status(400).json({ message: 'caseId is required' });

    const caseRow = await prisma.cases.findFirst({ where: { id: BigInt(caseId), ...getCaseWhere(user) }, select: { id: true } });
    if (!caseRow) return res.status(404).json({ message: 'Case not found or access denied' });

    const rawExt = (file.originalname.split('.').pop() || '').toUpperCase();
    const fileType = rawExt === 'XLS' ? 'XLSX' : rawExt;
    const result = await parseTowerDump(file.buffer, fileType);

    if (result.logs.length > 0) {
      await prisma.tower_match_logs.createMany({
        data: result.logs.map((l) => ({
          case_id: BigInt(caseId),
          mobile_number: l.mobile_number,
          latitude: l.latitude,
          longitude: l.longitude,
          hit_time: l.hit_time,
          cell_tower_id: l.cell_tower_id,
          provider: l.provider,
        })),
      });
    }

    const corr = await correlation.findCrossCaseCorrelations();
    await logAudit('CREATE', 'TOWER_DUMP', BigInt(caseId), req, `Tower dump ingested for case #${caseId} (${result.logs.length} logs)`);
    broadcastEvent('tower_dump_ingested', { caseId: String(caseId), inserted: result.logs.length });

    res.status(201).json(
      successResponse(
        {
          caseId: String(caseId),
          inserted: result.logs.length,
          detectedColumns: result.detectedColumns,
          errors: result.errors,
          crossCaseMobiles: corr.duplicateMobiles.length,
        },
        'Tower dump ingested'
      )
    );
  } catch (error) {
    console.error('uploadTowerDump error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getTowerIntersections = async (req: Request, res: Response) => {
  try {
    const { caseIds } = req.query;
    const ids = String(caseIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => BigInt(s));
    if (ids.length < 2) return res.status(400).json({ message: 'Provide at least 2 caseIds (comma-separated)' });

    const intersections = await correlation.findTowerIntersections(ids);
    res.json(
      successResponse({
        caseIds: ids.map((i) => i.toString()),
        intersections: intersections.map((x) => ({ ...x, mobile_number: maskMobile(x.mobile_number) })),
        total: intersections.length,
      })
    );
  } catch (error) {
    console.error('getTowerIntersections error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listSocialIntel = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { offenderId } = req.query;
    const where: any = { ...linkedOffenderScope(user) };
    if (offenderId) {
      where.offender_id = BigInt(String(offenderId));
    }
    const rows = await prisma.social_media_intel.findMany({
      where,
      include: {
        offenders: { select: { id: true, full_name: true, alias: true } },
        users: { select: { id: true, full_name: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 100
    });
    const data = rows.map((r) => ({
      id: r.id.toString(),
      offenderId: r.offender_id.toString(),
      offenderName: r.offenders?.full_name || '—',
      offenderAlias: r.offenders?.alias || '',
      platform: r.platform,
      handleOrUrl: r.handle_or_url,
      rating: r.rating,
      notes: r.notes || '',
      createdByName: r.users?.full_name || '—',
      createdAt: r.created_at
    }));
    res.json(successResponse(data));
  } catch (error) {
    console.error('listSocialIntel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listMessagingIntel = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { offenderId } = req.query;
    const where: any = { ...linkedOffenderScope(user) };
    if (offenderId) {
      where.offender_id = BigInt(String(offenderId));
    }
    const rows = await prisma.messaging_intel.findMany({
      where,
      include: {
        offenders: { select: { id: true, full_name: true, alias: true } },
        users: { select: { id: true, full_name: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 100
    });
    const data = rows.map((r) => ({
      id: r.id.toString(),
      offenderId: r.offender_id.toString(),
      offenderName: r.offenders?.full_name || '—',
      offenderAlias: r.offenders?.alias || '',
      platform: r.platform,
      sourceType: r.source_type,
      disposition: r.disposition || '',
      inputText: r.input_text,
      createdByName: r.users?.full_name || '—',
      createdAt: r.created_at
    }));
    res.json(successResponse(data));
  } catch (error) {
    console.error('listMessagingIntel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
