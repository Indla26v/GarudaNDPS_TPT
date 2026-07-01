/**
 * GARUDA — Finance Cross-Analysis Intelligence Engine (Page 6)
 *
 * Runs after every statement upload (and on-demand via rerun) to flag:
 *  🔴 OFFENDER_LINK        — counterparty matches another known offender
 *  🟠 HIGH_VALUE           — single txn / 24h cluster above threshold, or > 50% income
 *  🟡 LAYERING             — many small transfers to same party in a short window
 *  🔵 COMMON_COUNTERPARTY  — same counterparty across 3+ offenders
 *  🟣 FREQ_SPIKE           — monthly volume anomaly (informational)
 *
 * Flags are recorded on `transaction_records.is_flagged` / `flag_reason`,
 * with a `[TAG]` prefix per category so the alerts API can group by priority.
 */
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

export const HIGH_VALUE_THRESHOLD = 50000;

export const FLAG = {
  OFFENDER_LINK: 'OFFENDER_LINK',
  HIGH_VALUE: 'HIGH_VALUE',
  LAYERING: 'LAYERING',
  COMMON_COUNTERPARTY: 'COMMON_COUNTERPARTY',
  FREQ_SPIKE: 'FREQ_SPIKE',
} as const;

export const FLAG_PRIORITY: Record<string, string> = {
  OFFENDER_LINK: 'HIGH',
  HIGH_VALUE: 'HIGH',
  LAYERING: 'MEDIUM',
  COMMON_COUNTERPARTY: 'MEDIUM',
  FREQ_SPIKE: 'LOW',
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Add/merge a flag tag onto a transaction (idempotent per tag). */
async function addFlag(txnId: bigint, tag: string, reason: string, matchedOffenderId?: bigint): Promise<void> {
  const txn = await prisma.transaction_records.findUnique({
    where: { id: txnId },
    select: { flag_reason: true },
  });
  const existing = txn?.flag_reason || '';
  if (existing.includes(`[${tag}]`)) {
    if (matchedOffenderId) {
      await prisma.transaction_records.update({
        where: { id: txnId },
        data: { matched_offender_id: matchedOffenderId },
      });
    }
    return;
  }
  const merged = existing ? `${existing} | [${tag}] ${reason}` : `[${tag}] ${reason}`;
  await prisma.transaction_records.update({
    where: { id: txnId },
    data: {
      is_flagged: true,
      flag_reason: merged.slice(0, 500),
      ...(matchedOffenderId ? { matched_offender_id: matchedOffenderId } : {}),
    },
  });
}

// ── 🔴 Offender ↔ Offender transaction detection ───────────────────────
export async function matchOffenderTransactions(batchId: bigint): Promise<number> {
  const txns = await prisma.transaction_records.findMany({
    where: { batch_id: batchId },
    select: { id: true, offender_id: true, counterparty_account: true, counterparty_name: true },
  });

  let matches = 0;
  for (const t of txns) {
    if (!t.counterparty_account && !t.counterparty_name) continue;
    const candidates: bigint[] = [];

    if (t.counterparty_account) {
      const fin = await prisma.offender_financials.findMany({
        where: { value: { equals: t.counterparty_account, mode: 'insensitive' }, offender_id: { not: t.offender_id } },
        select: { offender_id: true },
        take: 1,
      });
      fin.forEach((f) => candidates.push(f.offender_id));

      if (candidates.length === 0) {
        const contact = await prisma.offender_contacts.findMany({
          where: { value: { equals: t.counterparty_account, mode: 'insensitive' }, offender_id: { not: t.offender_id } },
          select: { offender_id: true },
          take: 1,
        });
        contact.forEach((c) => candidates.push(c.offender_id));
      }
    }

    if (candidates.length === 0 && t.counterparty_name) {
      const byName = await prisma.offenders.findMany({
        where: { full_name: { equals: t.counterparty_name, mode: 'insensitive' }, id: { not: t.offender_id } },
        select: { id: true },
        take: 1,
      });
      byName.forEach((o) => candidates.push(o.id));
    }

    const matchedId = candidates[0];
    if (matchedId !== undefined) {
      const other = await prisma.offenders.findUnique({ where: { id: matchedId }, select: { full_name: true } });
      await addFlag(
        t.id,
        FLAG.OFFENDER_LINK,
        `Counterparty matches known offender ${other?.full_name || '#' + matchedId} (offender #${matchedId})`,
        matchedId
      );
      matches++;
    }
  }
  return matches;
}

// ── 🟠 High-value suspicious transaction detection ─────────────────────
export async function flagHighValueTransactions(offenderId: bigint, threshold = HIGH_VALUE_THRESHOLD): Promise<number> {
  const offender = await prisma.offenders.findUnique({
    where: { id: offenderId },
    select: { monthly_income: true },
  });
  const income = offender?.monthly_income ? Number(offender.monthly_income) : null;

  const txns = await prisma.transaction_records.findMany({
    where: { offender_id: offenderId },
    select: { id: true, amount: true, txn_date: true },
    orderBy: { txn_date: 'asc' },
  });

  let flagged = 0;
  for (const t of txns) {
    const amt = Number(t.amount);
    if (amt > threshold) {
      await addFlag(t.id, FLAG.HIGH_VALUE, `High-value transaction of ${inr(amt)} (> ${inr(threshold)})`);
      flagged++;
    } else if (income && amt > income * 0.5) {
      await addFlag(
        t.id,
        FLAG.HIGH_VALUE,
        `Transaction ${inr(amt)} exceeds 50% of declared monthly income (${inr(income)})`
      );
      flagged++;
    }
  }

  // 24h cluster detection (txn_date is date-granularity → groups same-day activity)
  for (let i = 0; i < txns.length; i++) {
    const base = txns[i];
    if (!base) continue;
    const start = new Date(base.txn_date).getTime();
    let sum = 0;
    const group: bigint[] = [];
    for (let j = i; j < txns.length; j++) {
      const tj = txns[j];
      if (!tj) continue;
      const dt = new Date(tj.txn_date).getTime();
      if (dt - start <= 24 * 3600 * 1000) {
        sum += Number(tj.amount);
        group.push(tj.id);
      } else break;
    }
    if (group.length > 1 && sum > threshold) {
      for (const id of group) {
        await addFlag(id, FLAG.HIGH_VALUE, `Part of a 24h cluster totalling ${inr(sum)} (> ${inr(threshold)})`);
      }
    }
  }

  return flagged;
}

// ── 🟡 Layering / structuring pattern detection ────────────────────────
export async function detectLayeringPatterns(offenderId: bigint): Promise<number> {
  const txns = await prisma.transaction_records.findMany({
    where: { offender_id: offenderId, amount: { gte: 500, lte: 5000 } },
    select: { id: true, txn_date: true, counterparty_account: true, counterparty_name: true },
    orderBy: { txn_date: 'asc' },
  });

  const byCp = new Map<string, { ids: bigint[]; times: number[] }>();
  for (const t of txns) {
    const key = (t.counterparty_account || t.counterparty_name || '').toLowerCase();
    if (!key) continue;
    if (!byCp.has(key)) byCp.set(key, { ids: [], times: [] });
    const g = byCp.get(key)!;
    g.ids.push(t.id);
    g.times.push(new Date(t.txn_date).getTime());
  }

  let flagged = 0;
  for (const g of byCp.values()) {
    if (g.ids.length < 5) continue;
    const times = [...g.times].sort((a, b) => a - b);
    const first = times[0]!;
    const last = times[times.length - 1]!;
    const spanDays = (last - first) / (86400 * 1000);
    if (spanDays <= 3) {
      for (const id of g.ids) {
        await addFlag(
          id,
          FLAG.LAYERING,
          `Potential layering: ${g.ids.length} small transfers to same counterparty within ${Math.round(spanDays) + 1} day(s)`
        );
      }
      flagged += g.ids.length;
    }
  }
  return flagged;
}

// ── 🔵 Common counterparty detection (global) ──────────────────────────
export interface CommonCounterparty {
  counterparty_account: string;
  offender_count: number;
  txn_count: number;
  total_amount: number;
}

export async function findCommonCounterparties(offenderIds?: bigint[]): Promise<CommonCounterparty[]> {
  const scopeClause =
    offenderIds && offenderIds.length > 0
      ? Prisma.sql`AND offender_id = ANY(${offenderIds}::bigint[])`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ counterparty_account: string; offender_count: bigint; txn_count: bigint; total_amount: unknown }>
  >(Prisma.sql`
    SELECT counterparty_account,
           COUNT(DISTINCT offender_id)::bigint AS offender_count,
           COUNT(*)::bigint AS txn_count,
           COALESCE(SUM(amount), 0) AS total_amount
    FROM transaction_records
    WHERE counterparty_account IS NOT NULL AND counterparty_account <> ''
    ${scopeClause}
    GROUP BY counterparty_account
    HAVING COUNT(DISTINCT offender_id) > 1
    ORDER BY COUNT(DISTINCT offender_id) DESC, COUNT(*) DESC
  `);

  return rows.map((r) => ({
    counterparty_account: r.counterparty_account,
    offender_count: Number(r.offender_count),
    txn_count: Number(r.txn_count),
    total_amount: Number(r.total_amount),
  }));
}

/** Flag batch transactions whose counterparty is shared across 3+ offenders. */
export async function flagCommonCounterpartyTxns(batchId: bigint): Promise<number> {
  const txns = await prisma.transaction_records.findMany({
    where: { batch_id: batchId, counterparty_account: { not: null } },
    select: { id: true, counterparty_account: true },
  });

  let flagged = 0;
  for (const t of txns) {
    if (!t.counterparty_account) continue;
    const distinctOffenders = await prisma.transaction_records.findMany({
      where: { counterparty_account: t.counterparty_account },
      select: { offender_id: true },
      distinct: ['offender_id'],
    });
    if (distinctOffenders.length >= 3) {
      await addFlag(
        t.id,
        FLAG.COMMON_COUNTERPARTY,
        `Counterparty appears across ${distinctOffenders.length} different offenders (possible unregistered handler/financier)`
      );
      flagged++;
    }
  }
  return flagged;
}

// ── 🟣 Temporal / frequency anomaly analysis (informational) ───────────
export interface MonthlyPoint {
  month: string;
  count: number;
  total: number;
}
export interface AnomalyResult {
  spike: boolean;
  avgPriorCount: number;
  currentCount: number;
  months: MonthlyPoint[];
}

export async function detectAnomalies(offenderId: bigint): Promise<AnomalyResult> {
  const rows = await prisma.$queryRaw<Array<{ month: string; cnt: bigint; total: unknown }>>(Prisma.sql`
    SELECT TO_CHAR(txn_date, 'YYYY-MM') AS month, COUNT(*)::bigint AS cnt, COALESCE(SUM(amount), 0) AS total
    FROM transaction_records
    WHERE offender_id = ${offenderId}
    GROUP BY 1
    ORDER BY 1
  `);

  const months: MonthlyPoint[] = rows.map((r) => ({
    month: r.month,
    count: Number(r.cnt),
    total: Number(r.total),
  }));

  if (months.length < 2) {
    return { spike: false, avgPriorCount: 0, currentCount: months[0]?.count ?? 0, months };
  }
  const last = months[months.length - 1]!;
  const prior = months.slice(0, -1);
  const avg = prior.reduce((s, m) => s + m.count, 0) / prior.length;
  const spike = avg > 0 && last.count >= 3 * avg;
  return { spike, avgPriorCount: Math.round(avg), currentCount: last.count, months };
}

// ── Orchestrator: run the full engine for one batch ────────────────────
export interface AnalysisSummary {
  matched: number;
  highValue: number;
  layering: number;
  common: number;
}

export async function runBatchAnalysis(batchId: bigint): Promise<AnalysisSummary> {
  const batch = await prisma.finance_upload_batches.findUnique({
    where: { id: batchId },
    select: { offender_id: true },
  });
  if (!batch) return { matched: 0, highValue: 0, layering: 0, common: 0 };

  const matched = await matchOffenderTransactions(batchId);
  const highValue = await flagHighValueTransactions(batch.offender_id);
  const layering = await detectLayeringPatterns(batch.offender_id);
  const common = await flagCommonCounterpartyTxns(batchId);

  return { matched, highValue, layering, common };
}
