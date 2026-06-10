/**
 * GARUDA — Command Dashboard (Page 1)
 * Route: /dashboard
 * 
 * Real-time command overview with:
 *  - KPI cards (cases, arrests, absconders, pending CS, courts, convictions)
 *  - Year-wise case trend (2016–2026) line chart
 *  - Station-wise bar chart
 *  - Drug type donut chart
 *  - Live alert feed
 *  - Absconder ticker
 *  - Quick action links
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import api from '../api/axios';
import { usePermissions } from '../hooks/usePermissions';
import { useSSE } from '../hooks/useSSE';
import {
  IconClipboard, IconLock, IconRunning, IconHourglass, IconScale, IconCheckCircle,
  IconPackage, IconDollar, IconCar, IconBell, IconMegaphone, IconSearch, IconReports,
} from '../components/Icons';

const KPI_CARDS = [
  { key: 'totalCases',           label: 'Total Cases',       Icon: IconClipboard, color: '#3b82f6' },
  { key: 'totalArrests',         label: 'Arrests',           Icon: IconLock,      color: '#22c55e' },
  { key: 'totalAbsconders',      label: 'Absconders',        Icon: IconRunning,   color: '#ef4444' },
  { key: 'pendingChargeSheets',  label: 'Pending CS',        Icon: IconHourglass, color: '#f59e0b' },
  { key: 'pendingCourtCases',    label: 'Pending Courts',    Icon: IconScale,     color: '#8b5cf6' },
  { key: 'convictionsThisYear',  label: 'Convictions (YTD)', Icon: IconCheckCircle, color: '#06b6d4' },
];

const ALERT_ICON_MAP = {
  NEW_CASE: IconClipboard,
  ABSCONDER: IconRunning,
  CHARGE_SHEET: IconHourglass,
  CONVICTION: IconCheckCircle,
};

// Simple in-memory client-side cache for tab switching
let cachedSummary = null;
let lastFetchTime = 0;
let cachedToken = null;
const CACHE_TTL = 30000; // 30 seconds cache

export default function Dashboard() {
  const currentToken = localStorage.getItem('garuda_access_token');
  
  // If cache is valid, initialize with cached data and skip loading screen
  const isCacheValid = cachedSummary && 
                       cachedToken === currentToken && 
                       (Date.now() - lastFetchTime < CACHE_TTL);

  const [summary, setSummary] = useState(isCacheValid ? cachedSummary : null);
  const [loading, setLoading] = useState(!isCacheValid);
  const [error, setError] = useState('');
  const perms = usePermissions();
  const { lastEvent, isConnected } = useSSE();

  useEffect(() => {
    fetchSummary(false);
  }, []);

  // Refresh data on SSE events (bypasses cache)
  useEffect(() => {
    if (lastEvent && ['case_created', 'offender_created', 'data_updated'].includes(lastEvent.type)) {
      fetchSummary(true);
    }
  }, [lastEvent]);

  const fetchSummary = async (force = false) => {
    const now = Date.now();
    const currentToken = localStorage.getItem('garuda_access_token');
    
    if (!force && cachedSummary && cachedToken === currentToken && (now - lastFetchTime < CACHE_TTL)) {
      setSummary(cachedSummary);
      setLoading(false);
      return;
    }

    try {
      if (!cachedSummary || cachedToken !== currentToken) {
        setLoading(true);
      }
      const res = await api.get(`/dashboard/summary${force ? '?force=true' : ''}`);
      cachedSummary = res.data.data;
      cachedToken = currentToken;
      lastFetchTime = Date.now();
      setSummary(res.data.data);
      setError('');
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (val) => {
    if (val === null || val === undefined) return '0';
    return Number(val).toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg" style={{ color: 'var(--color-danger-400)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header + Quick Links ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
              Command Dashboard
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: isConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: isConnected ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)' }}>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: isConnected ? '#22c55e' : '#ef4444' }}
              />
              <span style={{ color: isConnected ? '#22c55e' : '#ef4444' }}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            NDPS Operations{summary?.isStationLevel
              ? ` — ${summary?.psWiseData?.[0]?.psName || 'Your Station'}`
              : ' — Tirupati District'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {perms.canRegisterCase && (
            <Link to="/cases/new" className="btn btn-primary btn-sm">
              + New Case
            </Link>
          )}
          <Link to="/offenders" className="btn btn-secondary btn-sm">
            <IconSearch size={14} /> Search Accused
          </Link>
          <Link to="/reports" className="btn btn-secondary btn-sm">
            <IconReports size={14} /> Reports
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {KPI_CARDS.map((card, i) => (
          <div
            key={card.key}
            className="flex flex-col bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl overflow-hidden hover:translate-y-[-2px] transition-all duration-200"
            style={{
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              animationDelay: `${i * 60}ms`
            }}
          >
            {/* Header Zone */}
            <div 
              className="px-4 py-2.5 flex items-center justify-start"
              style={{ background: '#E27319' }}
            >
              <span className="text-[12px] font-bold text-white tracking-wider uppercase select-none">
                {card.label}
              </span>
            </div>
            
            {/* Body Zone */}
            <div className="p-4 flex items-center justify-between gap-3 bg-white dark:bg-slate-900/60">
              {/* Left Side: Icon in subtle container */}
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-100/80 dark:border-slate-700/40"
              >
                <card.Icon size={20} color={card.color} />
              </div>
              
              {/* Right Side: Large bold stat number */}
              <div className="text-right flex-1 min-w-0">
                <p 
                  className="font-extrabold truncate"
                  style={{ fontSize: '28px', lineHeight: '1.2', color: card.color }}
                >
                  {fmt(summary?.[card.key])}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Seizure Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Contraband Seized', val: `${fmt(summary?.totalContrabandKg)} Kg`, color: '#f59e0b', Icon: IconPackage },
          { label: 'Cash Seized', val: `₹${fmt(summary?.totalCashSeized)}`, color: '#22c55e', Icon: IconDollar },
          { label: 'Vehicles Seized', val: fmt(summary?.totalVehiclesSeized), color: '#ec4899', Icon: IconCar },
        ].map(s => (
          <div key={s.label} className="card rounded-xl p-4 flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ background: s.color + '14' }}
            >
              <s.Icon size={22} color={s.color} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.val}</p>
              <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Year-wise Trend */}
        <div className="lg:col-span-2 card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            Year-wise NDPS Cases (2016–2026)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={summary?.yearWiseTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--color-garuda-100)' }}
                itemStyle={{ color: 'var(--color-garuda-200)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="cases" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name="Cases" />
              <Line type="monotone" dataKey="arrests" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} name="Arrests" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Drug Type Donut */}
        <div className="card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            Drug Type Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={summary?.drugTypeBreakdown || []}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                nameKey="type"
              >
                {(summary?.drugTypeBreakdown || []).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--color-garuda-100)' }}
                itemStyle={{ color: 'var(--color-garuda-200)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {(() => {
              const total = (summary?.drugTypeBreakdown || []).reduce((acc, cur) => acc + cur.value, 0);
              return (summary?.drugTypeBreakdown || []).map(d => {
                const percentage = total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <span key={d.type} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-garuda-300)' }}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: d.color }} />
                    {d.type} ({d.value} cases - {percentage}%)
                  </span>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* ── Station-wise Bar Chart ───────────────────────────────────── */}
      {summary?.psWiseData?.length > 1 && (
        <div className="card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            Station-wise Cases & Arrests
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={summary.psWiseData.filter(ps => ps.totalCases > 0).sort((a, b) => b.totalCases - a.totalCases)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="psName" stroke="#94a3b8" fontSize={10} angle={-30} textAnchor="end" height={60} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--color-garuda-100)' }}
                itemStyle={{ color: 'var(--color-garuda-200)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="totalCases" fill="#3b82f6" name="Cases" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalArrests" fill="#22c55e" name="Arrests" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalAbsconders" fill="#ef4444" name="Absconders" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom Row: Alerts + Absconder Ticker ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Alert Feed */}
        <div className="card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-garuda-200)' }}>
            <IconBell size={16} color="#d97706" /> Live Alert Feed
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {summary?.recentAlerts?.length > 0 ? summary.recentAlerts.map(alert => {
              const AlertIcon = ALERT_ICON_MAP[alert.type] || IconMegaphone;
              return (
                <div key={alert.id + alert.type} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: 'var(--color-garuda-900)' }}>
                  <AlertIcon size={16} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: 'var(--color-garuda-100)' }}>{alert.message}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-garuda-500)' }}>
                      {new Date(alert.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm" style={{ color: 'var(--color-garuda-500)' }}>No recent alerts</p>
            )}
          </div>
        </div>

        {/* Absconder Ticker */}
        <div className="card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-garuda-200)' }}>
            <IconRunning size={16} color="#ef4444" /> Pending Absconders
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {summary?.absconderTicker?.length > 0 ? summary.absconderTicker.map(a => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--color-garuda-900)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>{a.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>FIR: {a.firNo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: a.daysOutstanding > 30 ? '#ef4444' : '#f59e0b' }}>
                    {a.daysOutstanding}d
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-garuda-500)' }}>outstanding</p>
                </div>
              </div>
            )) : (
              <p className="text-sm" style={{ color: 'var(--color-garuda-500)' }}>No absconders on record</p>
            )}
          </div>
        </div>
      </div>

      {/* ── PS-wise Data Table (for SP/Admin) ────────────────────────── */}
      {summary?.psWiseData?.length > 1 && (
        <div className="card rounded-xl overflow-hidden">
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-garuda-200)' }}>
              Police Station-wise Breakdown
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th>PS Name</th>
                  <th className="text-right">Cases</th>
                  <th className="text-right">Offenders</th>
                  <th className="text-right">Arrests</th>
                  <th className="text-right">Absconders</th>
                  <th className="text-right">Contraband (Kg)</th>
                  <th className="text-right">Cash</th>
                </tr>
              </thead>
              <tbody>
                {summary.psWiseData.map((ps, i) => (
                  <tr key={ps.psId} className="table-row">
                    <td className="px-4 py-3" style={{ color: 'var(--color-garuda-100)' }}>{ps.psName}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-info-400)' }}>{fmt(ps.totalCases)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{fmt(ps.totalOffenders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-success-400)' }}>{fmt(ps.totalArrests)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-danger-400)' }}>{fmt(ps.totalAbsconders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-warning-400)' }}>{fmt(ps.totalContrabandKg)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>₹{fmt(ps.totalCashSeized)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
