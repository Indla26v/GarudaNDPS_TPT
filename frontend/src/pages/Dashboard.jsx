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

const KPI_CARDS = [
  { key: 'totalCases',           label: 'Total Cases',       icon: '📋', color: '#3b82f6' },
  { key: 'totalArrests',         label: 'Arrests',           icon: '🔒', color: '#22c55e' },
  { key: 'totalAbsconders',      label: 'Absconders',        icon: '🏃', color: '#ef4444' },
  { key: 'pendingChargeSheets',  label: 'Pending CS',        icon: '⏳', color: '#f59e0b' },
  { key: 'pendingCourtCases',    label: 'Pending Courts',    icon: '⚖️', color: '#8b5cf6' },
  { key: 'convictionsThisYear',  label: 'Convictions (YTD)', icon: '✅', color: '#06b6d4' },
];

const ALERT_ICONS = {
  NEW_CASE: '📋',
  ABSCONDER: '🏃',
  CHARGE_SHEET: '⏳',
  CONVICTION: '✅',
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const perms = usePermissions();

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setSummary(res.data.data);
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Command Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            NDPS Operations — Tirupati District
          </p>
        </div>
        <div className="flex gap-2">
          {perms.canRegisterCase && (
            <Link to="/cases/new" className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
              style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
              + New Case
            </Link>
          )}
          <Link to="/offenders" className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}>
            🔍 Search Accused
          </Link>
          <Link to="/reports" className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}>
            📄 Reports
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {KPI_CARDS.map((card, i) => (
          <div
            key={card.key}
            className="rounded-xl p-4 transition-all duration-300 hover:scale-105"
            style={{
              background: 'var(--color-garuda-800)',
              border: '1px solid var(--color-garuda-700)',
              boxShadow: 'var(--shadow-card)',
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg">{card.icon}</span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: card.color + '22', color: card.color }}
              >
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {fmt(summary?.[card.key])}
            </p>
          </div>
        ))}
      </div>

      {/* ── Seizure Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Contraband Seized', val: `${fmt(summary?.totalContrabandKg)} Kg`, color: '#f59e0b', icon: '📦' },
          { label: 'Cash Seized', val: `₹${fmt(summary?.totalCashSeized)}`, color: '#22c55e', icon: '💰' },
          { label: 'Vehicles Seized', val: fmt(summary?.totalVehiclesSeized), color: '#ec4899', icon: '🚗' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <span className="text-2xl">{s.icon}</span>
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
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            Year-wise NDPS Cases (2016–2026)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={summary?.yearWiseTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="cases" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name="Cases" />
              <Line type="monotone" dataKey="arrests" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} name="Arrests" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Drug Type Donut */}
        <div className="rounded-xl p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
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
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {(summary?.drugTypeBreakdown || []).map(d => (
              <span key={d.type} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-garuda-300)' }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: d.color }} />
                {d.type} ({d.value}%)
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Station-wise Bar Chart ───────────────────────────────────── */}
      {(perms.canViewDashboardFull || perms.isSP || perms.isDSP) && summary?.psWiseData?.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            Station-wise Cases & Arrests
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={summary.psWiseData.filter(ps => ps.totalCases > 0).sort((a, b) => b.totalCases - a.totalCases)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="psName" stroke="#64748b" fontSize={10} angle={-30} textAnchor="end" height={60} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
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
        <div className="rounded-xl p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            🔔 Live Alert Feed
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {summary?.recentAlerts?.length > 0 ? summary.recentAlerts.map(alert => (
              <div key={alert.id + alert.type} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: 'var(--color-garuda-900)' }}>
                <span className="text-base mt-0.5">{ALERT_ICONS[alert.type] || '📢'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: 'var(--color-garuda-100)' }}>{alert.message}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-garuda-500)' }}>
                    {new Date(alert.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-sm" style={{ color: 'var(--color-garuda-500)' }}>No recent alerts</p>
            )}
          </div>
        </div>

        {/* Absconder Ticker */}
        <div className="rounded-xl p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            🏃 Pending Absconders
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
      {(perms.isAdmin || perms.isSP) && summary?.psWiseData?.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-garuda-200)' }}>
              Police Station-wise Breakdown
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-garuda-700)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>PS Name</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Cases</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Offenders</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Arrests</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Absconders</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Contraband (Kg)</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Cash</th>
                </tr>
              </thead>
              <tbody>
                {summary.psWiseData.map((ps, i) => (
                  <tr key={ps.psId} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
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
