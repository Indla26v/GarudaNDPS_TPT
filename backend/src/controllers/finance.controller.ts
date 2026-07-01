/**
 * GARUDA — Finance Intelligence Controller (Page 6)
 *
 * Statement upload + parsing, cross-analysis, and intelligence query APIs.
 * All data is scoped to the caller's jurisdiction via getOffenderWhere, and
 * account numbers are masked unless an authorized user explicitly reveals them.
 */
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';
import { getOffenderWhere, ScopeUser } from '../utils/scope';
import { maskAccount, canRevealAadhaar } from '../utils/pii';
import { paramId } from '../utils/params';
import { parseStatement } from '../services/statementParser';
import * as analysis from '../services/financeAnalysis';
import { broadcastEvent } from './sse.controller';

// ── Helpers ────────────────────────────────────────────────────────────
function txnScope(user: ScopeUser): any {
  return { offenders: getOffenderWhere(user) };
}

async function offenderInScope(offenderId: bigint, user: ScopeUser): Promise<boolean> {
  const found = await prisma.offenders.findFirst({
    where: { id: offenderId, ...getOffenderWhere(user) },
    select: { id: true },
  });
  return !!found;
}

const CATEGORY_TAGS = ['OFFENDER_LINK', 'HIGH_VALUE', 'LAYERING', 'COMMON_COUNTERPARTY', 'FREQ_SPIKE'];

function alertCategory(flagReason: string | null): { category: string; priority: string } {
  const reason = flagReason || '';
  const found = CATEGORY_TAGS.find((tag) => reason.includes(`[${tag}]`)) || 'OTHER';
  return { category: found, priority: analysis.FLAG_PRIORITY[found] || 'LOW' };
}

function toTxnResponse(t: any, reveal: boolean) {
  const cat = alertCategory(t.flag_reason);
  return {
    id: t.id.toString(),
    batchId: t.batch_id.toString(),
    offenderId: t.offender_id.toString(),
    offenderName: t.offenders?.full_name ?? null,
    bankName: t.bank_name,
    accountNo: reveal ? t.account_no : maskAccount(t.account_no),
    accountMasked: !reveal,
    upiId: t.upi_id,
    transactionRef: t.transaction_ref,
    amount: Number(t.amount),
    txnDate: t.txn_date,
    direction: t.direction,
    txnMode: t.txn_mode,
    counterpartyName: t.counterparty_name,
    counterpartyAccount: t.counterparty_account,
    narration: t.narration,
    balanceAfter: t.balance_after !== null && t.balance_after !== undefined ? Number(t.balance_after) : null,
    isFlagged: t.is_flagged,
    flagReason: t.flag_reason,
    alertCategory: t.is_flagged ? cat.category : null,
    alertPriority: t.is_flagged ? cat.priority : null,
    matchedOffenderId: t.matched_offender_id?.toString() || null,
    matchedOffenderName: t.matched_offender?.full_name || null,
    createdAt: t.created_at,
  };
}

function toBatchResponse(b: any) {
  return {
    id: b.id.toString(),
    offenderId: b.offender_id.toString(),
    offenderName: b.offenders?.full_name ?? null,
    fileName: b.file_name,
    fileType: b.file_type,
    statementMonth: b.statement_month,
    bankName: b.bank_name,
    accountNo: maskAccount(b.account_no),
    upiId: b.upi_id,
    totalRecords: b.total_records,
    status: b.status,
    errorLog: b.error_log,
    uploadedByName: b.users?.full_name ?? null,
    createdAt: b.created_at,
  };
}

// ── 1. Upload & parse a statement ──────────────────────────────────────
export const uploadStatement = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const file = (req as any).file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const { offenderId, statementMonth, bankName, accountNo, upiId, preview } = req.body;
    if (!offenderId) return res.status(400).json({ message: 'offenderId is required' });
    if (!statementMonth) return res.status(400).json({ message: 'statementMonth is required' });

    const offId = BigInt(offenderId);
    if (!(await offenderInScope(offId, user))) {
      return res.status(404).json({ message: 'Offender not found or access denied' });
    }

    const rawExt = (file.originalname.split('.').pop() || '').toUpperCase();
    const fileType = rawExt === 'XLS' ? 'XLSX' : rawExt;
    const monthDate = new Date(statementMonth);
    if (isNaN(monthDate.getTime())) return res.status(400).json({ message: 'Invalid statementMonth' });

    // Preview mode — parse only, do not persist (drives the column-mapping UI)
    if (String(preview) === 'true') {
      const pre = await parseStatement(file.buffer, fileType);
      return res.json(
        successResponse(
          {
            preview: true,
            detectedColumns: pre.detectedColumns,
            sampleRows: pre.sampleRows,
            parsedCount: pre.transactions.length,
            errors: pre.errors,
          },
          'Statement parsed (preview)'
        )
      );
    }

    const batch = await prisma.finance_upload_batches.create({
      data: {
        uploaded_by: BigInt(user.userId),
        offender_id: offId,
        file_name: file.originalname,
        file_type: fileType,
        statement_month: monthDate,
        bank_name: bankName || null,
        account_no: accountNo || null,
        upi_id: upiId || null,
        status: 'PROCESSING',
      },
    });

    let result;
    try {
      result = await parseStatement(file.buffer, fileType);
    } catch (parseErr: any) {
      await prisma.finance_upload_batches.update({
        where: { id: batch.id },
        data: { status: 'FAILED', error_log: `Parse error: ${parseErr.message}` },
      });
      return res
        .status(422)
        .json({ message: 'Failed to parse statement: ' + parseErr.message, batchId: batch.id.toString() });
    }

    if (result.transactions.length > 0) {
      await prisma.transaction_records.createMany({
        data: result.transactions.map((t) => ({
          batch_id: batch.id,
          offender_id: offId,
          bank_name: bankName || null,
          account_no: accountNo || null,
          upi_id: upiId || null,
          transaction_ref: t.transaction_ref,
          amount: t.amount,
          txn_date: t.txn_date,
          direction: t.direction,
          txn_mode: t.txn_mode,
          counterparty_name: t.counterparty_name,
          counterparty_account: t.counterparty_account,
          narration: t.narration,
          balance_after: t.balance_after,
        })),
      });
    }

    const summary = await analysis.runBatchAnalysis(batch.id);

    const status =
      result.transactions.length === 0 ? 'FAILED' : result.errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
    await prisma.finance_upload_batches.update({
      where: { id: batch.id },
      data: {
        status,
        total_records: result.transactions.length,
        error_log: result.errors.length ? result.errors.slice(0, 20).join('\n') : null,
      },
    });

    await logAudit(
      'CREATE',
      'FINANCE_BATCH',
      batch.id,
      req,
      `Statement upload for offender #${offId} (${result.transactions.length} txns, status ${status})`
    );
    broadcastEvent('finance_batch_uploaded', {
      batchId: batch.id.toString(),
      offenderId: offId.toString(),
      status,
      analysis: summary,
    });

    res.status(201).json(
      successResponse(
        {
          batchId: batch.id.toString(),
          status,
          totalRecords: result.transactions.length,
          analysis: summary,
          detectedColumns: result.detectedColumns,
          errors: result.errors,
        },
        'Statement uploaded and analyzed'
      )
    );
  } catch (error: any) {
    console.error('uploadStatement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 2. Intelligence dashboard summary ──────────────────────────────────
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const scope = txnScope(user);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [statementsThisMonth, totalStatements, totalTxns, offenderLinks, highValue, layering, commonCp] =
      await Promise.all([
        prisma.finance_upload_batches.count({ where: { ...scope, created_at: { gte: monthStart } } }),
        prisma.finance_upload_batches.count({ where: scope }),
        prisma.transaction_records.count({ where: scope }),
        prisma.transaction_records.count({ where: { ...scope, matched_offender_id: { not: null } } }),
        prisma.transaction_records.count({ where: { ...scope, flag_reason: { contains: '[HIGH_VALUE]' } } }),
        prisma.transaction_records.count({ where: { ...scope, flag_reason: { contains: '[LAYERING]' } } }),
        prisma.transaction_records.count({ where: { ...scope, flag_reason: { contains: '[COMMON_COUNTERPARTY]' } } }),
      ]);

    const recentFlagged = await prisma.transaction_records.findMany({
      where: { ...scope, is_flagged: true },
      orderBy: { created_at: 'desc' },
      take: 10,
      include: {
        offenders: { select: { id: true, full_name: true } },
        matched_offender: { select: { id: true, full_name: true } },
      },
    });
    const recentAlerts = recentFlagged.map((t) => {
      const cat = alertCategory(t.flag_reason);
      return {
        id: t.id.toString(),
        offenderId: t.offender_id.toString(),
        offenderName: t.offenders?.full_name ?? null,
        category: cat.category,
        priority: cat.priority,
        reason: t.flag_reason,
        amount: Number(t.amount),
        txnDate: t.txn_date,
        matchedOffenderName: t.matched_offender?.full_name || null,
      };
    });

    // Monthly trend (last 6 months) — aggregated in JS
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const trendTxns = await prisma.transaction_records.findMany({
      where: { ...scope, txn_date: { gte: sixMonthsAgo } },
      select: { txn_date: true, is_flagged: true },
    });
    const trendMap = new Map<string, { total: number; flagged: number }>();
    for (const t of trendTxns) {
      const key = new Date(t.txn_date).toISOString().slice(0, 7);
      if (!trendMap.has(key)) trendMap.set(key, { total: 0, flagged: 0 });
      const e = trendMap.get(key)!;
      e.total++;
      if (t.is_flagged) e.flagged++;
    }
    const monthlyTrend = Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, total: v.total, flagged: v.flagged }));

    res.json(
      successResponse({
        kpis: {
          statementsThisMonth,
          totalStatements,
          totalTransactions: totalTxns,
          offenderLinks,
          highValue,
          layering,
          commonCounterparties: commonCp,
        },
        recentAlerts,
        monthlyTrend,
      })
    );
  } catch (error: any) {
    console.error('getDashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 3. List upload batches ─────────────────────────────────────────────
export const getUploads = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const { page = '0', size = '20', offenderId, month } = req.query;
    const where: any = txnScope(user);
    if (offenderId) where.offender_id = BigInt(String(offenderId));
    if (month) {
      const d = new Date(String(month));
      if (!isNaN(d.getTime())) {
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        where.statement_month = { gte: start, lt: end };
      }
    }

    const skip = Number(page) * Number(size);
    const take = Number(size);
    const [batches, total] = await Promise.all([
      prisma.finance_upload_batches.findMany({
        where,
        include: {
          offenders: { select: { full_name: true } },
          users: { select: { full_name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.finance_upload_batches.count({ where }),
    ]);

    res.json(
      successResponse({
        content: batches.map(toBatchResponse),
        totalElements: total,
        totalPages: Math.ceil(total / take),
      })
    );
  } catch (error: any) {
    console.error('getUploads error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 4. Transaction explorer ────────────────────────────────────────────
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const {
      page = '0',
      size = '30',
      offenderId,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      direction,
      flaggedOnly,
      matchedOnly,
      reveal,
    } = req.query;

    const where: any = txnScope(user);
    if (offenderId) where.offender_id = BigInt(String(offenderId));
    if (direction) where.direction = String(direction);
    if (String(flaggedOnly) === 'true') where.is_flagged = true;
    if (String(matchedOnly) === 'true') where.matched_offender_id = { not: null };
    if (dateFrom || dateTo) {
      where.txn_date = {};
      if (dateFrom) where.txn_date.gte = new Date(String(dateFrom));
      if (dateTo) where.txn_date.lte = new Date(String(dateTo));
    }
    if (amountMin || amountMax) {
      where.amount = {};
      if (amountMin) where.amount.gte = Number(amountMin);
      if (amountMax) where.amount.lte = Number(amountMax);
    }

    const doReveal = String(reveal) === 'true' && canRevealAadhaar(user.role || '');
    if (doReveal) await logAudit('VIEW', 'FINANCE_TXN', null, req, 'PII_REVEALED: account numbers');

    const skip = Number(page) * Number(size);
    const take = Number(size);
    const [txns, total] = await Promise.all([
      prisma.transaction_records.findMany({
        where,
        include: {
          offenders: { select: { full_name: true } },
          matched_offender: { select: { full_name: true } },
        },
        orderBy: { txn_date: 'desc' },
        skip,
        take,
      }),
      prisma.transaction_records.count({ where }),
    ]);

    res.json(
      successResponse({
        content: txns.map((t) => toTxnResponse(t, doReveal)),
        totalElements: total,
        totalPages: Math.ceil(total / take),
      })
    );
  } catch (error: any) {
    console.error('getTransactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 5. Alerts grouped by category / priority ───────────────────────────
export const getAlerts = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const flagged = await prisma.transaction_records.findMany({
      where: { ...txnScope(user), is_flagged: true },
      include: {
        offenders: { select: { id: true, full_name: true } },
        matched_offender: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    });

    const groups: Record<string, any[]> = {};
    const counts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };

    for (const t of flagged) {
      const cat = alertCategory(t.flag_reason);
      if (!groups[cat.category]) {
        groups[cat.category] = [];
        counts[cat.category] = 0;
      }
      groups[cat.category]!.push({
        id: t.id.toString(),
        offenderId: t.offender_id.toString(),
        offenderName: t.offenders?.full_name ?? null,
        priority: cat.priority,
        reason: t.flag_reason,
        amount: Number(t.amount),
        txnDate: t.txn_date,
        counterpartyName: t.counterparty_name,
        matchedOffenderId: t.matched_offender_id?.toString() || null,
        matchedOffenderName: t.matched_offender?.full_name || null,
      });
      counts[cat.category] = (counts[cat.category] || 0) + 1;
      const pri = cat.priority;
      priorityCounts[pri] = (priorityCounts[pri] ?? 0) + 1;
    }

    res.json(successResponse({ groups, counts, priorityCounts, total: flagged.length }));
  } catch (error: any) {
    console.error('getAlerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 6. Offender ↔ offender links (for graph) ───────────────────────────
export const getOffenderLinks = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const linked = await prisma.transaction_records.findMany({
      where: { ...txnScope(user), matched_offender_id: { not: null } },
      include: {
        offenders: { select: { id: true, full_name: true } },
        matched_offender: { select: { id: true, full_name: true } },
      },
    });

    const pairMap = new Map<string, any>();
    for (const t of linked) {
      const src = t.offender_id.toString();
      const tgt = t.matched_offender_id!.toString();
      const key = `${src}>${tgt}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, {
          source: src,
          sourceName: t.offenders?.full_name ?? null,
          target: tgt,
          targetName: t.matched_offender?.full_name ?? null,
          txnCount: 0,
          totalAmount: 0,
        });
      }
      const e = pairMap.get(key)!;
      e.txnCount++;
      e.totalAmount += Number(t.amount);
    }

    const links = Array.from(pairMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    res.json(successResponse({ links, total: links.length }));
  } catch (error: any) {
    console.error('getOffenderLinks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 7. Money flow graph centered on one offender ───────────────────────
export const getFlowMap = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const offId = paramId(req, 'offenderId');
    if (!(await offenderInScope(offId, user))) {
      return res.status(404).json({ message: 'Offender not found or access denied' });
    }

    const center = await prisma.offenders.findUnique({
      where: { id: offId },
      select: { id: true, full_name: true, risk_score: true, category: true },
    });

    const txns = await prisma.transaction_records.findMany({
      where: { offender_id: offId },
      include: { matched_offender: { select: { id: true, full_name: true, risk_score: true } } },
    });

    const centerKey = `off_${offId}`;
    const nodes = new Map<string, any>();
    nodes.set(centerKey, {
      id: centerKey,
      offenderId: offId.toString(),
      label: center?.full_name ?? `#${offId}`,
      type: 'offender',
      riskScore: center?.risk_score ?? null,
      category: center?.category ?? null,
      isCenter: true,
    });

    const edgeMap = new Map<string, any>();
    for (const t of txns) {
      let cpKey: string;
      if (t.matched_offender_id) {
        cpKey = `off_${t.matched_offender_id}`;
        if (!nodes.has(cpKey)) {
          nodes.set(cpKey, {
            id: cpKey,
            offenderId: t.matched_offender_id.toString(),
            label: t.matched_offender?.full_name ?? `#${t.matched_offender_id}`,
            type: 'offender',
            riskScore: t.matched_offender?.risk_score ?? null,
            isCenter: false,
          });
        }
      } else {
        const raw = (t.counterparty_account || t.counterparty_name || 'Unknown').toString();
        cpKey = `cp_${raw.toLowerCase()}`;
        if (!nodes.has(cpKey)) {
          nodes.set(cpKey, {
            id: cpKey,
            label: t.counterparty_name || t.counterparty_account || 'Unknown',
            type: 'counterparty',
            account: t.counterparty_account,
            isCenter: false,
          });
        }
      }

      const source = t.direction === 'OUTGOING' ? centerKey : cpKey;
      const target = t.direction === 'OUTGOING' ? cpKey : centerKey;
      const ek = `${source}>${target}`;
      if (!edgeMap.has(ek)) {
        edgeMap.set(ek, { source, target, totalAmount: 0, txnCount: 0 });
      }
      const e = edgeMap.get(ek)!;
      e.totalAmount += Number(t.amount);
      e.txnCount++;
    }

    res.json(
      successResponse({
        center: {
          id: centerKey,
          offenderId: offId.toString(),
          name: center?.full_name ?? null,
          riskScore: center?.risk_score ?? null,
        },
        nodes: Array.from(nodes.values()),
        edges: Array.from(edgeMap.values()),
      })
    );
  } catch (error: any) {
    console.error('getFlowMap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 8. Common counterparties across offenders ──────────────────────────
export const getCommonCounterparties = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const scope = getOffenderWhere(user);

    let scopedIds: bigint[] | undefined;
    if (Object.keys(scope).length > 0) {
      const offs = await prisma.offenders.findMany({ where: scope, select: { id: true } });
      scopedIds = offs.map((o) => o.id);
      if (scopedIds.length === 0) {
        return res.json(successResponse({ counterparties: [], total: 0 }));
      }
    }

    const data = await analysis.findCommonCounterparties(scopedIds);
    res.json(successResponse({ counterparties: data, total: data.length }));
  } catch (error: any) {
    console.error('getCommonCounterparties error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 9. Month-over-month analysis for one offender ──────────────────────
export const getMonthlyAnalysis = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const offId = paramId(req, 'offenderId');
    if (!(await offenderInScope(offId, user))) {
      return res.status(404).json({ message: 'Offender not found or access denied' });
    }

    const offender = await prisma.offenders.findUnique({
      where: { id: offId },
      select: { full_name: true, monthly_income: true },
    });

    const anomalies = await analysis.detectAnomalies(offId);

    // Monthly inflow vs outflow
    const txns = await prisma.transaction_records.findMany({
      where: { offender_id: offId },
      select: { txn_date: true, amount: true, direction: true },
    });
    const flow = new Map<string, { inflow: number; outflow: number }>();
    for (const t of txns) {
      const key = new Date(t.txn_date).toISOString().slice(0, 7);
      if (!flow.has(key)) flow.set(key, { inflow: 0, outflow: 0 });
      const e = flow.get(key)!;
      if (t.direction === 'INCOMING') e.inflow += Number(t.amount);
      else e.outflow += Number(t.amount);
    }
    const monthlyFlow = Array.from(flow.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, inflow: v.inflow, outflow: v.outflow }));

    const declaredIncome = offender?.monthly_income ? Number(offender.monthly_income) : null;
    const totalInflow = monthlyFlow.reduce((s, m) => s + m.inflow, 0);

    res.json(
      successResponse({
        offenderId: offId.toString(),
        offenderName: offender?.full_name ?? null,
        declaredMonthlyIncome: declaredIncome,
        anomalies,
        monthlyFlow,
        incomeDiscrepancy:
          declaredIncome && monthlyFlow.length > 0
            ? {
                declaredAnnual: declaredIncome * 12,
                observedInflow: totalInflow,
                ratio: declaredIncome > 0 ? Number((totalInflow / (declaredIncome * 12)).toFixed(2)) : null,
              }
            : null,
      })
    );
  } catch (error: any) {
    console.error('getMonthlyAnalysis error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 10. Re-run cross-analysis on a batch ───────────────────────────────
export const rerunAnalysis = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user;
    const batchId = paramId(req, 'batchId');
    const batch = await prisma.finance_upload_batches.findUnique({
      where: { id: batchId },
      select: { offender_id: true },
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (!(await offenderInScope(batch.offender_id, user))) {
      return res.status(404).json({ message: 'Batch not found or access denied' });
    }

    // Reset this batch's flags before re-evaluating
    await prisma.transaction_records.updateMany({
      where: { batch_id: batchId },
      data: { is_flagged: false, flag_reason: null, matched_offender_id: null },
    });

    const summary = await analysis.runBatchAnalysis(batchId);
    await logAudit('UPDATE', 'FINANCE_BATCH', batchId, req, 'Re-ran cross-analysis');
    broadcastEvent('finance_analysis_rerun', { batchId: batchId.toString(), analysis: summary });

    res.json(successResponse({ batchId: batchId.toString(), analysis: summary }, 'Analysis re-run complete'));
  } catch (error: any) {
    console.error('rerunAnalysis error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
