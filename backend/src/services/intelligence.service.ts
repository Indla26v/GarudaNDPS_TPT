/**
 * GARUDA — Intelligence Analytics Service
 *
 * Native TypeScript port of the former Python/FastAPI microservice
 * (`microservices/intelligence_service/main.py`). All graph analytics
 * (PageRank, degree centrality) are computed with `graphology` instead of
 * Python's `networkx`, and all queries run against the shared PostgreSQL
 * database via the existing Prisma client.
 *
 * Output shapes intentionally mirror the previous FastAPI responses so the
 * frontend (NetworkMap.jsx, FinancialAnalysis.jsx, etc.) keeps working
 * without changes.
 */
import { DirectedGraph } from 'graphology';
import pagerank from 'graphology-metrics/centrality/pagerank';
import { degreeCentrality } from 'graphology-metrics/centrality/degree';
import prisma from '../config/prisma';

// ── Helpers ────────────────────────────────────────────────────────────
const round4 = (x: number) => Math.round(x * 10000) / 10000;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const isDefined = <T>(v: T | undefined): v is T => v !== undefined;

export interface OffenderRef {
  id: string;
  name: string;
  alias: string | null;
}

// ── 1. Network graph (PageRank + degree centrality) ────────────────────
export async function calculateNetworkGraph(psId?: number) {
  // Offenders (nodes)
  const offParams: unknown[] = [];
  let offSql = 'SELECT id, full_name, alias, category, risk_score, ps_id FROM offenders';
  if (psId !== undefined) {
    offSql += ' WHERE ps_id = $1';
    offParams.push(psId);
  }
  const offenders = await prisma.$queryRawUnsafe<
    Array<{
      id: bigint;
      full_name: string;
      alias: string | null;
      category: string | null;
      risk_score: string | null;
      ps_id: bigint;
    }>
  >(offSql, ...offParams);

  // Supply chain links (explicit directed edges)
  const links = await prisma.$queryRawUnsafe<
    Array<{ offender_id: bigint; linked_offender_id: bigint | null; link_type: string; notes: string | null }>
  >(
    `SELECT offender_id, linked_offender_id, link_type, notes
     FROM supply_chain_links
     WHERE linked_offender_id IS NOT NULL`
  );

  // Co-arrest linkages (implicit bidirectional edges)
  const coArrests = await prisma.$queryRawUnsafe<Array<{ off1: bigint; off2: bigint; fir_no: string }>>(
    `SELECT ca1.offender_id AS off1, ca2.offender_id AS off2, c.fir_no
     FROM case_accused ca1
     JOIN case_accused ca2 ON ca1.case_id = ca2.case_id AND ca1.offender_id < ca2.offender_id
     JOIN cases c ON ca1.case_id = c.id`
  );

  const graph = new DirectedGraph();

  for (const off of offenders) {
    const id = String(off.id);
    if (!graph.hasNode(id)) {
      graph.addNode(id, {
        id,
        name: off.full_name,
        label: off.alias || off.full_name,
        category: off.category || 'Unknown',
        risk_score: off.risk_score || 'MEDIUM',
        ps_id: String(off.ps_id),
      });
    }
  }

  for (const link of links) {
    if (link.linked_offender_id === null) continue;
    const source = String(link.offender_id);
    const target = String(link.linked_offender_id);
    if (graph.hasNode(source) && graph.hasNode(target) && !graph.hasDirectedEdge(source, target)) {
      graph.addDirectedEdge(source, target, { type: link.link_type, notes: link.notes || '' });
    }
  }

  for (const co of coArrests) {
    const source = String(co.off1);
    const target = String(co.off2);
    if (
      graph.hasNode(source) &&
      graph.hasNode(target) &&
      !graph.hasDirectedEdge(source, target) &&
      !graph.hasDirectedEdge(target, source)
    ) {
      const notes = `Co-arrested in FIR ${co.fir_no}`;
      graph.addDirectedEdge(source, target, { type: 'CO_ARREST', notes });
      graph.addDirectedEdge(target, source, { type: 'CO_ARREST', notes });
    }
  }

  // Centrality metrics
  let pr: Record<string, number> = {};
  let dc: Record<string, number> = {};
  if (graph.order > 0) {
    try {
      // getEdgeWeight: null → treat edges as unweighted (matches the former networkx behavior)
      pr = pagerank(graph, { alpha: 0.85, getEdgeWeight: null });
    } catch {
      graph.forEachNode((n) => {
        pr[n] = 0.1;
      });
    }
    try {
      dc = degreeCentrality(graph);
    } catch {
      graph.forEachNode((n) => {
        dc[n] = 0;
      });
    }
  }

  const nodes: Array<Record<string, unknown>> = [];
  graph.forEachNode((node, attrs) => {
    nodes.push({
      ...attrs,
      pagerank: round4(pr[node] ?? 0),
      centrality: round4(dc[node] ?? 0),
    });
  });

  const edges: Array<{ source: string; target: string; type: string; notes: string }> = [];
  graph.forEachDirectedEdge((_edge, attrs, source, target) => {
    edges.push({
      source,
      target,
      type: (attrs['type'] as string) || 'ASSOCIATE',
      notes: (attrs['notes'] as string) || '',
    });
  });

  let isolated = 0;
  graph.forEachNode((n) => {
    if (graph.degree(n) === 0) isolated++;
  });

  return {
    nodes,
    edges,
    summary: {
      total_nodes: graph.order,
      total_edges: graph.size,
      isolated_nodes_count: isolated,
    },
  };
}

// ── 2. Duplicate contact / IMEI correlation ────────────────────────────
export async function checkDuplicateContacts(psId?: number) {
  const phoneParams: unknown[] = [];
  let phoneSql = `SELECT oc.value as contact, COUNT(oc.offender_id) as count,
                         ARRAY_AGG(oc.offender_id::text) as offender_ids
                  FROM offender_contacts oc
                  JOIN offenders o ON oc.offender_id = o.id
                  WHERE oc.contact_type IN ('MOBILE_PRIMARY', 'MOBILE_SECONDARY')
                    AND oc.value IS NOT NULL AND oc.value != ''`;
  if (psId !== undefined) {
    phoneSql += ' AND o.ps_id = $1';
    phoneParams.push(psId);
  }
  phoneSql += ' GROUP BY oc.value HAVING COUNT(oc.offender_id) > 1';
  const dupPhones = await prisma.$queryRawUnsafe<
    Array<{ contact: string; count: bigint; offender_ids: string[] }>
  >(phoneSql, ...phoneParams);

  const imeiParams: unknown[] = [];
  let imeiSql = `SELECT ir.imei_number, COUNT(ir.offender_id) as count,
                        ARRAY_AGG(ir.offender_id::text) as offender_ids
                 FROM imei_records ir
                 JOIN offenders o ON ir.offender_id = o.id
                 WHERE ir.imei_number IS NOT NULL AND ir.imei_number != ''`;
  if (psId !== undefined) {
    imeiSql += ' AND o.ps_id = $1';
    imeiParams.push(psId);
  }
  imeiSql += ' GROUP BY ir.imei_number HAVING COUNT(ir.offender_id) > 1';
  const dupImeis = await prisma.$queryRawUnsafe<
    Array<{ imei_number: string; count: bigint; offender_ids: string[] }>
  >(imeiSql, ...imeiParams);

  const offRows = await prisma.$queryRawUnsafe<Array<{ id: bigint; full_name: string; alias: string | null }>>(
    `SELECT id, full_name, alias FROM offenders`
  );
  const offMap = new Map<string, OffenderRef>();
  for (const o of offRows) {
    offMap.set(String(o.id), { id: String(o.id), name: o.full_name, alias: o.alias });
  }

  const duplicate_phones = dupPhones.map((row) => ({
    contact: row.contact,
    match_count: num(row.count),
    offenders: (row.offender_ids || []).map((oid) => offMap.get(oid)).filter(isDefined),
  }));
  const duplicate_imeis = dupImeis.map((row) => ({
    imei: row.imei_number,
    match_count: num(row.count),
    offenders: (row.offender_ids || []).map((oid) => offMap.get(oid)).filter(isDefined),
  }));

  return {
    duplicate_phones,
    duplicate_imeis,
    total_phone_correlations: duplicate_phones.length,
    total_imei_correlations: duplicate_imeis.length,
  };
}

// ── 3. Rule-based risk predictor ───────────────────────────────────────
export interface RiskInput {
  age: number;
  category: string;
  addiction_type?: string;
  previous_cases_count: number;
  contraband_quantity: number;
}

export function predictOffenderRisk(data: RiskInput) {
  const factors: string[] = [];
  let score = 0.0;

  const age = num(data.age);
  const prev = num(data.previous_cases_count);
  const qty = num(data.contraband_quantity);

  // Age impact
  if (age >= 18 && age <= 30) {
    score += 1.5;
    factors.push('Age between 18 and 30 represents high-risk recruitment bracket');
  } else if (age < 18) {
    score += 1.0;
    factors.push('Juvenile offender category requires specialty rehabilitation monitoring');
  }

  // Category impact
  if (data.category === 'KINGPIN') {
    score += 5.0;
    factors.push('Identified as supply network Kingpin/Financier');
  } else if (data.category === 'LOCAL_SUPPLIER' || data.category === 'INTERSTATE_SUPPLIER') {
    score += 3.5;
    factors.push('Active logistics or wholesale procurement role');
  } else if (data.category === 'PEDDLER') {
    score += 2.0;
    factors.push('Retail distribution/peddling activity');
  }

  // Previous cases impact
  if (prev >= 5) {
    score += 3.0;
    factors.push(`Habitual offender status (${prev} cases)`);
  } else if (prev >= 2) {
    score += 1.5;
    factors.push('Repeat NDPS offender record');
  }

  // Contraband quantity impact
  if (qty > 20.0) {
    score += 2.5;
    factors.push('Commercial quantity contraband involvement');
  } else if (qty > 2.0) {
    score += 1.0;
    factors.push('Intermediate quantity contraband involvement');
  }

  let risk_score: string;
  let confidence: number;
  if (score >= 6.5) {
    risk_score = 'HIGH';
    confidence = Math.min(0.7 + score * 0.03, 0.98);
  } else if (score >= 3.0) {
    risk_score = 'MEDIUM';
    confidence = 0.65 + score * 0.03;
  } else {
    risk_score = 'LOW';
    confidence = 0.6 + score * 0.04;
  }

  return { risk_score, confidence: Math.round(confidence * 100) / 100, factors };
}

// ── 4. Interstate drug routes ──────────────────────────────────────────
export async function getInterstateRoutes(psId?: number) {
  const params: unknown[] = [];
  let sql = `SELECT source_location, destination_location, contraband_type,
                    COUNT(*) as case_count,
                    COALESCE(SUM(quantity), 0) as total_quantity,
                    COALESCE(SUM(street_value), 0) as total_street_value
             FROM cases
             WHERE source_location IS NOT NULL AND source_location != ''
               AND destination_location IS NOT NULL AND destination_location != ''`;
  if (psId !== undefined) {
    sql += ' AND ps_id = $1';
    params.push(psId);
  }
  sql += ' GROUP BY source_location, destination_location, contraband_type ORDER BY case_count DESC';

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      source_location: string;
      destination_location: string;
      contraband_type: string | null;
      case_count: bigint;
      total_quantity: unknown;
      total_street_value: unknown;
    }>
  >(sql, ...params);

  const routes = rows.map((r) => ({
    source: r.source_location,
    destination: r.destination_location,
    contraband_type: r.contraband_type || 'Unknown',
    case_count: num(r.case_count),
    total_quantity: num(r.total_quantity),
    total_street_value: num(r.total_street_value),
  }));

  return { routes, total_routes: routes.length };
}

// ── 5. Consignment trails ──────────────────────────────────────────────
export async function getConsignmentTrails(psId?: number) {
  const params: unknown[] = [];
  let sql = `SELECT c.id as case_id, c.fir_no, c.case_date, c.contraband_type, c.quantity,
                    c.street_value, c.source_location, c.destination_location, c.stage,
                    ps.name as ps_name,
                    COALESCE(
                      (SELECT ARRAY_AGG(DISTINCT o.full_name)
                       FROM case_accused ca
                       JOIN offenders o ON ca.offender_id = o.id
                       WHERE ca.case_id = c.id),
                      ARRAY[]::text[]
                    ) as accused_names
             FROM cases c
             JOIN police_stations ps ON c.ps_id = ps.id
             WHERE c.contraband_type IS NOT NULL`;
  if (psId !== undefined) {
    sql += ' AND c.ps_id = $1';
    params.push(psId);
  }
  sql += ' ORDER BY c.case_date DESC NULLS LAST LIMIT 100';

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      case_id: bigint;
      fir_no: string;
      case_date: Date | null;
      contraband_type: string | null;
      quantity: unknown;
      street_value: unknown;
      source_location: string | null;
      destination_location: string | null;
      stage: string | null;
      ps_name: string;
      accused_names: string[] | null;
    }>
  >(sql, ...params);

  const trails = rows.map((row) => ({
    case_id: String(row.case_id),
    fir_no: row.fir_no,
    case_date: row.case_date ? new Date(row.case_date).toISOString().slice(0, 10) : null,
    contraband_type: row.contraband_type || 'Unknown',
    quantity: num(row.quantity),
    street_value: num(row.street_value),
    source: row.source_location || '—',
    destination: row.destination_location || '—',
    stage: row.stage || 'FIR',
    ps_name: row.ps_name,
    accused_names: row.accused_names || [],
  }));

  return { trails, total_trails: trails.length };
}

// ── 6. Case linkage (shared accused) ───────────────────────────────────
export async function getCaseLinkages(psId?: number) {
  const params: unknown[] = [];
  let sql = `SELECT o.id as offender_id, o.full_name, o.alias, o.category,
                    COUNT(DISTINCT ca.case_id) as case_count,
                    ARRAY_AGG(
                      JSON_BUILD_OBJECT(
                        'case_id', ca.case_id::text,
                        'fir_no', c.fir_no,
                        'ps_name', ps.name,
                        'case_date', COALESCE(c.case_date::text, ''),
                        'contraband_type', COALESCE(c.contraband_type::text, 'Unknown'),
                        'stage', COALESCE(c.stage::text, 'FIR')
                      )
                    ) as linked_cases
             FROM case_accused ca
             JOIN offenders o ON ca.offender_id = o.id
             JOIN cases c ON ca.case_id = c.id
             JOIN police_stations ps ON c.ps_id = ps.id`;
  if (psId !== undefined) {
    sql += ' WHERE c.ps_id = $1';
    params.push(psId);
  }
  sql += ` GROUP BY o.id, o.full_name, o.alias, o.category
           HAVING COUNT(DISTINCT ca.case_id) > 1
           ORDER BY COUNT(DISTINCT ca.case_id) DESC`;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      offender_id: bigint;
      full_name: string;
      alias: string | null;
      category: string | null;
      case_count: bigint;
      linked_cases: unknown[] | null;
    }>
  >(sql, ...params);

  const linkages = rows.map((row) => ({
    offender_id: String(row.offender_id),
    offender_name: row.full_name,
    alias: row.alias,
    category: row.category || 'Unknown',
    case_count: num(row.case_count),
    linked_cases: row.linked_cases || [],
  }));

  return { linkages, total_linkages: linkages.length };
}
