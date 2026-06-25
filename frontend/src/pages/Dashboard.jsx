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
import { Link, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
} from 'recharts';
import api from '../api/axios';
import { usePermissions } from '../hooks/usePermissions';
import { useSSE } from '../hooks/useSSE';
import {
  IconClipboard, IconLock, IconRunning, IconHourglass, IconScale, IconCheckCircle,
  IconPackage, IconDollar, IconCar, IconBell, IconMegaphone, IconSearch, IconReports, IconShield,
  IconNetwork, IconOffender, IconConsumer, IconChain
} from '../components/Icons';

const getAvatarColor = (name) => {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'
  ];
  if (!name) return colors[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

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

const IconTruck = ({ size = 20, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M14 18H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8v16z" />
    <path d="M14 6h4l4 4v6h-8V6z" />
    <circle cx="7.5" cy="18.5" r="2.5" />
    <circle cx="16.5" cy="16.5" r="2.5" />
  </svg>
);

const IconCrown = ({ size = 20, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" />
    <path d="M5 20h14" />
  </svg>
);

const HIERARCHY_STAGES = [
  {
    step: 1,
    key: 'interstateLink',
    label: 'Interstate Link',
    borderColor: '#6366f1',
    iconType: 'network',
  },
  {
    step: 2,
    key: 'financier',
    label: 'Financier',
    borderColor: '#16a34a',
    iconType: 'rupee',
  },
  {
    step: 3,
    key: 'supplier',
    label: 'Supplier',
    borderColor: '#2563eb',
    iconType: 'supplier',
  },
  {
    step: 4,
    key: 'transporter',
    label: 'Transporter',
    borderColor: '#ea580c',
    iconType: 'truck',
  },
  {
    step: 5,
    key: 'localKingpin',
    label: 'Local Kingpin',
    borderColor: '#dc2626',
    iconType: 'crown',
  },
  {
    step: 6,
    key: 'localPeddler',
    label: 'Local Peddler',
    borderColor: '#8b5cf6',
    iconType: 'peddler',
  },
  {
    step: 7,
    key: 'consumer',
    label: 'Consumers',
    borderColor: '#0d9488',
    iconType: 'consumers',
  },
];

// Simple in-memory client-side cache for tab switching
let cachedSummary = null;
let lastFetchTime = 0;
let cachedToken = null;
const CACHE_TTL = 30000; // 30 seconds cache

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('all');
  const [sortColumn, setSortColumn] = useState('totalCases');
  const [sortOrder, setSortOrder] = useState('desc');

  // If cache is valid, initialize with cached data and skip loading screen
  const isCacheValid = cachedSummary && 
                       cachedToken === `summary_${timeRange}` &&
                       (Date.now() - lastFetchTime < CACHE_TTL);

  const [summary, setSummary] = useState(isCacheValid ? cachedSummary : null);
  const [loading, setLoading] = useState(!isCacheValid);
  const [error, setError] = useState('');
  const perms = usePermissions();
  const navigate = useNavigate();
  const { lastEvent, isConnected } = useSSE();

  useEffect(() => {
    fetchSummary(false, timeRange);
  }, []);

  // Refresh data on SSE events (bypasses cache)
  useEffect(() => {
    if (lastEvent && ['case_created', 'offender_created', 'data_updated', 'absconder_alerts', 'chargesheet_overdue_alerts'].includes(lastEvent.type)) {
      fetchSummary(true, timeRange);
    }
  }, [lastEvent]);

  const fetchSummary = async (force = false, range = timeRange) => {
    const now = Date.now();
    const cacheKey = `summary_${range}`;
    const cacheIsValid = cachedSummary && 
                         cachedToken === cacheKey &&
                         (now - lastFetchTime < CACHE_TTL);
    
    if (!force && cacheIsValid) {
      setSummary(cachedSummary);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/dashboard/summary?timeRange=${range}${force ? '&force=true' : ''}`);
      cachedSummary = res.data.data;
      cachedToken = cacheKey;
      lastFetchTime = Date.now();
      setSummary(res.data.data);
      setError('');
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
    fetchSummary(true, newRange);
  };

  const fmt = (val) => {
    if (val === null || val === undefined) return '0';
    return Number(val).toLocaleString('en-IN');
  };

  const renderStatValue = (val) => {
    if (loading && !summary) {
      return <span className="w-16 h-8 bg-white/20 rounded animate-pulse inline-block" />;
    }
    return fmt(val);
  };

  const renderSeizureValue = (val, prefix = '', suffix = '') => {
    if (loading && !summary) {
      return <span className="w-24 h-6 bg-black/10 rounded animate-pulse inline-block" />;
    }
    return `${prefix}${fmt(val)}${suffix}`;
  };

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
            className="flex flex-col border-0 rounded-xl overflow-hidden hover:translate-y-[-2px] transition-all duration-200"
            style={{
              background: card.color,
              boxShadow: `0 4px 12px ${card.color}40`,
              animationDelay: `${i * 60}ms`
            }}
          >
            {/* Header Zone */}
            <div 
              className="px-4 py-2.5 flex items-center justify-start bg-black/10"
            >
              <span className="text-[12px] font-bold text-white tracking-wider uppercase select-none">
                {card.label}
              </span>
            </div>
            
            {/* Body Zone */}
            <div className="p-4 flex items-center justify-between gap-3">
              {/* Left Side: Icon in subtle container */}
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/20 border border-white/20"
              >
                <card.Icon size={20} color="#ffffff" />
              </div>
              
              {/* Right Side: Large bold stat number */}
              <div className="text-right flex-1 min-w-0">
                <p 
                  className="font-extrabold truncate text-white"
                  style={{ fontSize: '28px', lineHeight: '1.2' }}
                >
                  {renderStatValue(summary?.[card.key])}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Seizure Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Contraband Seized', val: summary?.totalContrabandKg, suffix: ' Kg', color: '#f59e0b', Icon: IconPackage, link: null },
          { label: 'Cash Seized', val: summary?.totalCashSeized, prefix: '₹', color: '#22c55e', Icon: IconDollar, link: null },
          { label: 'Vehicles Seized', val: summary?.totalSeizedVehicleRecords, color: '#ec4899', Icon: IconCar, link: '/vehicles-seized' },
        ].map(s => {
          const content = (
            <div key={s.label} className={`card rounded-xl p-4 flex items-center gap-4 ${s.link ? 'hover:translate-y-[-2px] transition-all duration-200' : ''}`} style={s.link ? { cursor: 'pointer' } : {}}>
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center"
                style={{ background: s.color + '14' }}
              >
                <s.Icon size={22} color={s.color} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: s.color }}>
                  {renderSeizureValue(s.val, s.prefix || '', s.suffix || '')}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>{s.label}</p>
              </div>
              {s.link && (
                <div className="ml-auto">
                  <svg className="w-4 h-4" fill="none" stroke={s.color} strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          );
          return s.link ? (
            <Link key={s.label} to={s.link} style={{ textDecoration: 'none' }}>
              {content}
            </Link>
          ) : content;
        })}
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Year-wise Trend */}
        <div className="lg:col-span-2 card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            Year-wise NDPS Cases (2016–2026)
          </h3>
          {loading && !summary ? (
            <div className="h-[260px] bg-black/5 rounded-lg flex items-center justify-center animate-pulse text-xs text-[var(--color-garuda-500)]">
              Loading trend data...
            </div>
          ) : (
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
          )}
        </div>

        {/* Drug Type Donut */}
        <div className="card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>
            Drug Type Breakdown
          </h3>
          {loading && !summary ? (
            <div className="h-[200px] bg-black/5 rounded-lg flex items-center justify-center animate-pulse text-xs text-[var(--color-garuda-500)]">
              Loading drug breakdown...
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* ── Hierarchy of Smugglers ────────────────────────────────────── */}
      <div className="card rounded-xl p-5 shadow-card border border-slate-700/20 relative overflow-hidden">
        {/* Decorative corner grid background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none rounded-bl-full" />
        
        <h3 className="text-sm font-bold uppercase tracking-wider mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-200)' }}>
          <IconChain size={16} className="text-indigo-500" /> Hierarchy of Smugglers
        </h3>

        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="flex items-stretch justify-between min-w-[840px] gap-2 px-2">
            {HIERARCHY_STAGES.map((stage, idx) => {
              const count = summary?.smugglerHierarchy?.[stage.key];
              
              // Render Icon based on type
              let IconComponent = null;
              if (stage.iconType === 'network') {
                IconComponent = <IconNetwork size={22} color="#ffffff" />;
              } else if (stage.iconType === 'rupee') {
                IconComponent = <span className="text-xl font-black text-white">₹</span>;
              } else if (stage.iconType === 'supplier' || stage.iconType === 'peddler') {
                IconComponent = <IconOffender size={22} color="#ffffff" />;
              } else if (stage.iconType === 'truck') {
                IconComponent = <IconTruck size={22} color="#ffffff" />;
              } else if (stage.iconType === 'crown') {
                IconComponent = <IconCrown size={22} color="#ffffff" />;
              } else if (stage.iconType === 'consumers') {
                IconComponent = <IconConsumer size={22} color="#ffffff" />;
              }

              return (
                <div key={stage.key} className="flex flex-col items-center flex-1 text-center select-none group relative">
                  {/* Large Icon Badge with dynamic colored glow and connecting dotted lines */}
                  <div className="relative flex items-center justify-center w-full mb-4">
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-md group-hover:scale-110 relative z-10"
                      style={{ 
                        background: `linear-gradient(135deg, ${stage.borderColor}dd, ${stage.borderColor})`,
                        boxShadow: `0 4px 10px ${stage.borderColor}33`,
                      }}
                    >
                      {IconComponent}
                    </div>
                    
                    {/* Connecting dotted line pointing to next step */}
                    {idx < HIERARCHY_STAGES.length - 1 && (
                      <div className="absolute left-[calc(50%+28px)] right-[calc(-50%+28px)] top-1/2 -translate-y-1/2 z-0">
                        <div 
                          className="border-t-2 border-dotted h-0 w-full" 
                          style={{ borderColor: 'var(--color-garuda-400)', opacity: 0.5 }} 
                        />
                      </div>
                    )}
                  </div>

                  {/* Title Label */}
                  <p className="text-[10px] font-extrabold tracking-wider uppercase mb-1 min-h-[30px] flex items-center justify-center leading-tight" style={{ color: 'var(--color-garuda-300)' }}>
                    {stage.label}
                  </p>


                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Station-wise Metrics (Cases, Arrests, Absconders) Vertical Scrollable Charts ───────────────────────────────────── */}
      {(summary?.psWiseData?.length > 1 || (loading && !summary)) && (() => {
        // 1. Prepare Cases Data (Filtered and sorted descending)
        const casesData = (summary?.psWiseData || [])
          .filter(ps => ps.totalCases > 0)
          .map(ps => ({ psName: ps.psName, value: ps.totalCases }))
          .sort((a, b) => b.value - a.value);

        // 2. Prepare Arrests Data (Filtered and sorted descending)
        const arrestsData = (summary?.psWiseData || [])
          .filter(ps => ps.totalArrests > 0)
          .map(ps => ({ psName: ps.psName, value: ps.totalArrests }))
          .sort((a, b) => b.value - a.value);

        // 3. Prepare Absconders Data (Filtered and sorted descending)
        const abscondersData = (summary?.psWiseData || [])
          .filter(ps => ps.totalAbsconders > 0)
          .map(ps => ({ psName: ps.psName, value: ps.totalAbsconders }))
          .sort((a, b) => b.value - a.value);

        const renderVerticalChart = (title, data, color, metricName, yAxisWidth = 130) => {
          if (loading && !summary) {
            return (
              <div className="card rounded-xl p-5 flex flex-col h-[420px]">
                <h3 className="text-sm font-semibold mb-4 text-[var(--color-garuda-200)]">{title}</h3>
                <div className="flex-1 bg-black/5 rounded-lg flex items-center justify-center animate-pulse text-xs text-[var(--color-garuda-500)]">
                  Loading station metrics...
                </div>
              </div>
            );
          }

          if (data.length === 0) {
            return (
              <div className="card rounded-xl p-5 flex flex-col justify-between h-[420px]">
                <h3 className="text-sm font-semibold mb-4 text-[var(--color-garuda-200)]">{title}</h3>
                <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-garuda-400)]">
                  No data available
                </div>
              </div>
            );
          }

          // Each station gets about 34px of vertical height.
          // Displaying ~10 PS in a frame. 10 * 34 = 340px is the scrollable height.
          const chartHeight = Math.max(340, data.length * 34);

          return (
            <div className="card rounded-xl p-5 flex flex-col h-[420px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-garuda-200)]">{title}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-black/10 text-[var(--color-garuda-400)] font-medium">
                  {data.length} PS
                </span>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                <div style={{ height: `${chartHeight}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data}
                      margin={{ left: 5, right: 25, top: 25, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} orientation="top" />
                      <YAxis
                        dataKey="psName"
                        type="category"
                        stroke="#94a3b8"
                        fontSize={10}
                        width={yAxisWidth}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-garuda-800)',
                          border: '1px solid var(--color-garuda-700)',
                          borderRadius: 8,
                          fontSize: 11
                        }}
                        labelStyle={{ color: 'var(--color-garuda-100)' }}
                        itemStyle={{ color: 'var(--color-garuda-200)' }}
                      />
                      <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={14} name={metricName}>
                        <LabelList dataKey="value" position="right" style={{ fill: 'var(--color-garuda-400)', fontSize: 10, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {renderVerticalChart('Station-wise Cases', casesData, '#3b82f6', 'Cases')}
            {renderVerticalChart('Station-wise Arrests', arrestsData, '#22c55e', 'Arrests')}
            {renderVerticalChart('Station-wise Absconders', abscondersData, '#ef4444', 'Absconders')}
          </div>
        );
      })()}

      {/* ── Most Wanted List (Top 10) ───────────────────────────────── */}
      <div className="card rounded-xl p-5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-garuda-200)' }}>
            <IconShield size={18} color="#dc2626" /> Most Wanted Suspects (Top 10)
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-black/10 text-[var(--color-garuda-400)] font-bold uppercase tracking-wider">
            Active / Absconding
          </span>
        </div>
        
        {loading && !summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
            {[...Array(10)].map((_, idx) => (
              <div key={idx} className="h-40 bg-black/5 rounded-xl border border-slate-700/20 animate-pulse" />
            ))}
          </div>
        ) : summary?.mostWanted?.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
            {summary.mostWanted.map((o) => {
              const riskColors = {
                CRITICAL: { bg: 'rgba(220, 38, 38, 0.04)', color: '#dc2626', border: '#dc2626', glow: 'rgba(220, 38, 38, 0.25)', textBg: 'rgba(220, 38, 38, 0.08)' },
                HIGH: { bg: 'rgba(249, 115, 22, 0.04)', color: '#f97316', border: '#f97316', glow: 'rgba(249, 115, 22, 0.2)', textBg: 'rgba(249, 115, 22, 0.08)' },
                MEDIUM: { bg: 'rgba(234, 179, 8, 0.04)', color: '#eab308', border: '#eab308', glow: 'rgba(234, 179, 8, 0.12)', textBg: 'rgba(234, 179, 8, 0.08)' },
                LOW: { bg: 'rgba(59, 130, 246, 0.04)', color: '#3b82f6', border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.12)', textBg: 'rgba(59, 130, 246, 0.08)' },
              };
              const risk = riskColors[o.riskScore] || riskColors.LOW;

              return (
                <div
                  key={o.id}
                  onClick={() => navigate(`/offenders/${o.id}`)}
                  className="card rounded-xl p-2.5 flex flex-col items-center text-center cursor-pointer transition-all duration-300 relative group overflow-hidden border-t-[3px]"
                  style={{
                    background: `linear-gradient(180deg, var(--color-garuda-900) 0%, ${risk.bg} 100%)`,
                    borderTopColor: risk.border,
                    borderColor: 'var(--color-garuda-700)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 8px 20px -5px ${risk.glow}, 0 6px 8px -6px rgba(0,0,0,0.05)`;
                    e.currentTarget.style.borderColor = risk.border;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                    e.currentTarget.style.borderColor = 'var(--color-garuda-700)';
                  }}
                >
                  {/* Subtle Target Watermark in background */}
                  <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-slate-400 group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-300 pointer-events-none">
                    <IconShield size={60} />
                  </div>

                  {/* Status Dot (top right) */}
                  <div className="absolute top-2 right-2">
                    {o.status === 'ABSCONDING' ? (
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600"></span>
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </div>

                  {/* Avatar / Photo with Double Colored Ring */}
                  <div 
                    className="w-10 h-10 rounded-full overflow-hidden border-2 bg-slate-900 flex items-center justify-center mb-1.5 mt-1.5 transition-all duration-300 shadow-md group-hover:scale-105"
                    style={{ borderColor: risk.border }}
                  >
                    {o.photoUrl ? (
                      <img src={o.photoUrl} alt={o.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: getAvatarColor(o.fullName) }}
                      >
                        {o.fullName?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                  </div>

                  {/* Name & Alias */}
                  <h4 className="font-extrabold text-[11px] text-[var(--color-garuda-100)] truncate w-full" title={o.fullName}>
                    {o.fullName}
                  </h4>
                  <p className="text-[9px] font-semibold text-[var(--color-accent-400)] truncate w-full mb-2 tracking-wide">
                    {o.alias ? `[ ${o.alias} ]` : '—'}
                  </p>

                  {/* Info Badges */}
                  <div className="w-full space-y-1.5 mt-auto z-10">
                    <div className="text-[8px] py-0.5 px-1.5 rounded font-extrabold tracking-widest uppercase text-center transition-colors duration-200" style={{ background: risk.textBg, color: risk.color }}>
                      {o.riskScore}
                    </div>

                    <div className="text-[9px] font-bold text-[var(--color-info-400)] text-center pt-1 border-t border-slate-700/20">
                      {o.totalCases} {o.totalCases === 1 ? 'Case' : 'Cases'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-[var(--color-garuda-500)]">
            No active or absconding offenders on record.
          </div>
        )}
      </div>

      {/* ── Bottom Row: Alerts + Absconder Ticker ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Alert Feed */}
        <div className="card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-garuda-200)' }}>
            <IconBell size={16} color="#d97706" /> Live Alert Feed
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loading && !summary ? (
              <div className="h-32 flex items-center justify-center text-xs text-[var(--color-garuda-500)] animate-pulse">
                Loading alerts...
              </div>
            ) : (
              summary?.recentAlerts?.length > 0 ? summary.recentAlerts.map(alert => {
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
              )
            )}
          </div>
        </div>

        {/* Absconder Ticker */}
        <div className="card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-garuda-200)' }}>
            <IconRunning size={16} color="#ef4444" /> Pending Absconders
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loading && !summary ? (
              <div className="h-32 flex items-center justify-center text-xs text-[var(--color-garuda-500)] animate-pulse">
                Loading absconders...
              </div>
            ) : (
              summary?.absconderTicker?.length > 0 ? summary.absconderTicker.map(a => (
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
              )
            )}
          </div>
        </div>
      </div>

      {/* ── PS-wise Data Table (for SP/Admin) ────────────────────────── */}
      {(summary?.psWiseData?.length > 1 || (loading && !summary)) && (() => {
        if (loading && !summary) {
          return (
            <div className="card rounded-xl p-5 h-64 flex items-center justify-center animate-pulse text-xs text-[var(--color-garuda-500)]">
              Loading station breakdown table...
            </div>
          );
        }

        const sortedData = [...(summary?.psWiseData || [])].sort((a, b) => {
          let valA = a[sortColumn];
          let valB = b[sortColumn];

          if (sortColumn === 'psName') {
            return sortOrder === 'asc'
              ? valA.localeCompare(valB)
              : valB.localeCompare(valA);
          }

          valA = Number(valA || 0);
          valB = Number(valB || 0);

          return sortOrder === 'asc' ? valA - valB : valB - valA;
        });

        const handleHeaderClick = (col) => {
          if (sortColumn === col) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortColumn(col);
            setSortOrder('desc');
          }
        };

        const renderSortIndicator = (col) => {
          if (sortColumn !== col) return null;
          return sortOrder === 'asc' ? ' ▲' : ' ▼';
        };

        return (
          <div className="card rounded-xl overflow-hidden">
            <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-garuda-200)' }}>
                Police Station-wise Breakdown
              </h2>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Period Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide uppercase select-none text-[var(--color-garuda-400)]">Period:</span>
                  <select 
                    className="select py-1 px-2.5 text-xs rounded-md" 
                    value={timeRange} 
                    onChange={(e) => handleTimeRangeChange(e.target.value)}
                  >
                    <option value="all">All Time</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                {/* Sort Column Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide uppercase select-none text-[var(--color-garuda-400)]">Sort:</span>
                  <select 
                    className="select py-1 px-2.5 text-xs rounded-md" 
                    value={sortColumn} 
                    onChange={(e) => setSortColumn(e.target.value)}
                  >
                    <option value="psName">PS Name</option>
                    <option value="totalCases">Cases</option>
                    <option value="totalOffenders">Offenders</option>
                    <option value="totalArrests">Arrests</option>
                    <option value="totalAbsconders">Absconders</option>
                    <option value="totalContrabandKg">Contraband</option>
                    <option value="totalCashSeized">Cash</option>
                  </select>
                </div>

                {/* Sort Order Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide uppercase select-none text-[var(--color-garuda-400)]">Order:</span>
                  <select 
                    className="select py-1 px-2.5 text-xs rounded-md" 
                    value={sortOrder} 
                    onChange={(e) => setSortOrder(e.target.value)}
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="cursor-pointer select-none" onClick={() => handleHeaderClick('psName')}>
                      PS Name{renderSortIndicator('psName')}
                    </th>
                    <th className="text-center cursor-pointer select-none" onClick={() => handleHeaderClick('totalCases')}>
                      Cases{renderSortIndicator('totalCases')}
                    </th>
                    <th className="text-center cursor-pointer select-none" onClick={() => handleHeaderClick('totalOffenders')}>
                      Offenders{renderSortIndicator('totalOffenders')}
                    </th>
                    <th className="text-center cursor-pointer select-none" onClick={() => handleHeaderClick('totalArrests')}>
                      Arrests{renderSortIndicator('totalArrests')}
                    </th>
                    <th className="text-center cursor-pointer select-none" onClick={() => handleHeaderClick('totalAbsconders')}>
                      Absconders{renderSortIndicator('totalAbsconders')}
                    </th>
                    <th className="text-center cursor-pointer select-none" onClick={() => handleHeaderClick('totalContrabandKg')}>
                      Contraband (Kg){renderSortIndicator('totalContrabandKg')}
                    </th>
                    <th className="text-center cursor-pointer select-none" onClick={() => handleHeaderClick('totalCashSeized')}>
                      Cash{renderSortIndicator('totalCashSeized')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((ps) => (
                    <tr key={ps.psId} className="table-row">
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-100)' }}>{ps.psName}</td>
                      <td className="px-4 py-3 text-center" style={{ color: 'var(--color-info-400)' }}>{fmt(ps.totalCases)}</td>
                      <td className="px-4 py-3 text-center" style={{ color: 'var(--color-garuda-200)' }}>{fmt(ps.totalOffenders)}</td>
                      <td className="px-4 py-3 text-center" style={{ color: 'var(--color-success-400)' }}>{fmt(ps.totalArrests)}</td>
                      <td className="px-4 py-3 text-center" style={{ color: 'var(--color-danger-400)' }}>{fmt(ps.totalAbsconders)}</td>
                      <td className="px-4 py-3 text-center" style={{ color: 'var(--color-warning-400)' }}>{fmt(ps.totalContrabandKg)}</td>
                      <td className="px-4 py-3 text-center" style={{ color: 'var(--color-garuda-200)' }}>₹{fmt(ps.totalCashSeized)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
