/**
 * GARUDA — Absconder Alert Scheduler
 * 
 * Runs periodically to check for absconders outstanding > 30 days.
 * Broadcasts alerts via SSE so the dashboard auto-refreshes.
 * 
 * Default interval: every 6 hours (configurable via ABSCONDER_CHECK_INTERVAL_MS env var).
 */
import prisma from '../config/prisma';
import { broadcastEvent } from '../controllers/sse.controller';

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getSeverity(daysOutstanding: number): string {
  if (daysOutstanding > 90) return 'CRITICAL';
  if (daysOutstanding > 60) return 'HIGH';
  if (daysOutstanding > 30) return 'MEDIUM';
  return 'LOW';
}

async function checkAbsconderAlerts() {
  try {
    const absconders = await prisma.case_accused.findMany({
      where: { arrest_status: 'ABSCONDING' },
      include: {
        offenders: { select: { full_name: true } },
        cases: {
          select: {
            fir_no: true,
            case_date: true,
            police_stations: { select: { name: true } },
          },
        },
      },
    });

    const now = Date.now();
    const alerts = absconders
      .map(a => {
        const daysOutstanding = a.cases?.case_date
          ? Math.floor((now - new Date(a.cases.case_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          id: a.id.toString(),
          name: a.offenders?.full_name || 'Unknown',
          firNo: a.cases?.fir_no || '?',
          psName: a.cases?.police_stations?.name || '?',
          daysOutstanding,
          severity: getSeverity(daysOutstanding),
        };
      })
      .filter(a => a.daysOutstanding > 30)
      .sort((a, b) => b.daysOutstanding - a.daysOutstanding);

    const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
    const highCount = alerts.filter(a => a.severity === 'HIGH').length;

    if (alerts.length > 0) {
      broadcastEvent('absconder_alerts', {
        count: alerts.length,
        criticalCount,
        highCount,
        // Send top 20 most urgent for the dashboard ticker
        topAlerts: alerts.slice(0, 20),
        checkedAt: new Date().toISOString(),
      });

      console.log(
        `[Scheduler] Absconder alert check: ${alerts.length} absconders >30 days ` +
        `(${criticalCount} critical, ${highCount} high)`
      );
    } else {
      console.log('[Scheduler] Absconder alert check: no absconders exceeding 30 days');
    }
  } catch (error) {
    console.error('[Scheduler] Absconder alert check failed:', error);
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic absconder alert scheduler.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startAbsconderAlertScheduler() {
  if (intervalHandle) return;

  const intervalMs = parseInt(process.env.ABSCONDER_CHECK_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL_MS;

  console.log(`[Scheduler] Starting absconder alert scheduler (interval: ${Math.round(intervalMs / 60000)}m)`);

  // Run the first check after a brief delay to let the server fully start
  setTimeout(() => {
    checkAbsconderAlerts();
  }, 10000);

  // Schedule recurring checks
  intervalHandle = setInterval(checkAbsconderAlerts, intervalMs);
}

/**
 * Stop the scheduler (useful for graceful shutdown / tests).
 */
export function stopAbsconderAlertScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[Scheduler] Absconder alert scheduler stopped');
  }
}
