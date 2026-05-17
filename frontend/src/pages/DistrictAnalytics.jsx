/**
 * GARUDA — District Analytics Page (SP & Admin Only)
 * 
 * Real-time district-level analytics with aggregated data across all PS.
 * Shows trends, comparisons, and key metrics for SP/Admin oversight.
 */
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useSSE } from '../hooks/useSSE';

const METRIC_CARDS = [
  { key: 'totalCases',        label: 'Total Cases',     icon: '📁', color: '#3b82f6' },
  { key: 'totalOffenders',    label: 'Total Offenders',  icon: '👤', color: '#8b5cf6' },
  { key: 'totalArrests',      label: 'Total Arrests',    icon: '🔒', color: '#22c55e' },
  { key: 'totalAbsconders',   label: 'Absconders',       icon: '🏃', color: '#ef4444' },
  { key: 'totalContrabandKg', label: 'Contraband (Kg)',  icon: '⚖️', color: '#f59e0b' },
  { key: 'totalCashSeized',   label: 'Cash Seized (₹)',  icon: '💰', color: '#06b6d4' },
  { key: 'totalVehiclesSeized', label: 'Vehicles Seized', icon: '🚗', color: '#ec4899' },
];

export default function DistrictAnalytics() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const { lastEvent, isConnected } = useSSE();

  useEffect(() => {
    fetchSummary();
  }, []);

  // Refresh data on SSE events
  useEffect(() => {
    if (lastEvent && ['case_created', 'offender_created', 'data_updated'].includes(lastEvent.type)) {
      fetchSummary();
    }
  }, [lastEvent]);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setSummary(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '0';
    return Number(val).toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>District Analytics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Real-time aggregated intelligence across all Police Stations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: isConnected ? '#22c55e' : '#ef4444' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {METRIC_CARDS.map((card) => (
          <div
            key={card.key}
            className="rounded-xl p-4 transition-all duration-300 hover:scale-105 animate-slide-up"
            style={{
              background: 'var(--color-garuda-800)',
              border: '1px solid var(--color-garuda-700)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {formatNumber(summary?.[card.key])}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* PS Comparison Chart (table representation) */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
            Police Station Comparison
          </h2>
          <span className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>
            {summary?.psWiseData?.length || 0} stations
          </span>
        </div>

        <div className="p-6 space-y-4">
          {summary?.psWiseData?.map((ps) => {
            const maxCases = Math.max(...(summary.psWiseData.map(p => p.totalCases) || [1]));
            const percentage = maxCases > 0 ? (ps.totalCases / maxCases) * 100 : 0;

            return (
              <div key={ps.psId} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>
                    {ps.psName}
                    <span className="text-xs ml-2 font-mono" style={{ color: 'var(--color-garuda-500)' }}>
                      {ps.psCode}
                    </span>
                  </span>
                  <div className="flex items-center gap-4 text-xs">
                    <span style={{ color: '#60a5fa' }}>{formatNumber(ps.totalCases)} cases</span>
                    <span style={{ color: '#4ade80' }}>{formatNumber(ps.totalArrests)} arrests</span>
                    <span style={{ color: '#f87171' }}>{formatNumber(ps.totalAbsconders)} absconders</span>
                  </div>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--color-garuda-700)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
            Detailed Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-garuda-700)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>PS Name</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Code</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Cases</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Offenders</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Arrests</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Absconders</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Contraband (Kg)</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Cash (₹)</th>
              </tr>
            </thead>
            <tbody>
              {summary?.psWiseData?.map((ps, i) => (
                <tr
                  key={ps.psId}
                  className="transition-colors duration-150"
                  style={{
                    borderBottom: '1px solid var(--color-garuda-700)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(26, 42, 74, 0.3)',
                  }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>{ps.psName}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-garuda-400)' }}>{ps.psCode}</td>
                  <td className="px-4 py-3 text-right" style={{ color: '#60a5fa' }}>{formatNumber(ps.totalCases)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{formatNumber(ps.totalOffenders)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: '#4ade80' }}>{formatNumber(ps.totalArrests)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: '#f87171' }}>{formatNumber(ps.totalAbsconders)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: '#facc15' }}>{formatNumber(ps.totalContrabandKg)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>₹{formatNumber(ps.totalCashSeized)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
