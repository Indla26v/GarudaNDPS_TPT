/**
 * GARUDA — District Analytics Page (SP & Admin Only)
 * 
 * Real-time district-level analytics with aggregated data across all PS.
 * Shows trends, comparisons, and key metrics for SP/Admin oversight.
 */
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useSSE } from '../hooks/useSSE';
import {
  IconClipboard, IconOffender, IconLock, IconRunning, IconPackage, IconDollar, IconCar,
} from '../components/Icons';

const METRIC_CARDS = [
  { key: 'totalCases',        label: 'Total Cases',     Icon: IconClipboard, color: '#3b82f6' },
  { key: 'totalOffenders',    label: 'Total Offenders',  Icon: IconOffender,  color: '#8b5cf6' },
  { key: 'totalArrests',      label: 'Total Arrests',    Icon: IconLock,      color: '#22c55e' },
  { key: 'totalAbsconders',   label: 'Absconders',       Icon: IconRunning,   color: '#ef4444' },
  { key: 'totalContrabandKg', label: 'Contraband (Kg)',  Icon: IconPackage,   color: '#f59e0b' },
  { key: 'totalCashSeized',   label: 'Cash Seized (₹)',  Icon: IconDollar,    color: '#06b6d4' },
  { key: 'totalVehiclesSeized', label: 'Vehicles Seized', Icon: IconCar,      color: '#ec4899' },
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

  const renderCardValue = (val) => {
    if (loading && !summary) {
      return <div className="w-16 h-8 bg-black/10 rounded animate-pulse" />;
    }
    return formatNumber(val);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>District Analytics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Real-time aggregated intelligence across all Police Stations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-accent-400)] animate-pulse mr-2">
              <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin inline-block" />
              Updating...
            </div>
          )}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {METRIC_CARDS.map((card) => (
          <div
            key={card.key}
            className="card card-hover rounded-xl p-4 animate-slide-up"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: card.color + '14' }}
            >
              <card.Icon size={18} color={card.color} />
            </div>
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {renderCardValue(summary?.[card.key])}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>{card.label}</p>
          </div>
        ))}
      </div>
 
      {/* PS Comparison Chart (table representation) */}
      <div className="card rounded-xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
            Police Station Comparison
          </h2>
          <span className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>
            {summary?.psWiseData?.length || 0} stations
          </span>
        </div>
 
        <div className="p-6 space-y-4">
          {loading && !summary ? (
            <div className="py-12 text-center text-sm text-[var(--color-garuda-400)] animate-pulse">
              Loading comparisons...
            </div>
          ) : (
            summary?.psWiseData?.map((ps) => {
              const maxCases = Math.max(...(summary.psWiseData.map(p => p.totalCases) || [1]));
              const percentage = maxCases > 0 ? (ps.totalCases / maxCases) * 100 : 0;
 
              return (
                <div key={ps.psId} className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>
                      {ps.psName}
                      <span className="text-xs ml-2 font-mono" style={{ color: 'var(--color-garuda-500)' }}>
                        {ps.psCode}
                      </span>
                    </span>
                    <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap">
                      <span style={{ color: '#2563eb' }}>{formatNumber(ps.totalCases)} cases</span>
                      <span style={{ color: '#16a34a' }}>{formatNumber(ps.totalArrests)} arrests</span>
                      <span style={{ color: '#dc2626' }}>{formatNumber(ps.totalAbsconders)} absconders</span>
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
            })
          )}
        </div>
      </div>
 
      {/* Detailed Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
            Detailed Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th>PS Name</th>
                <th>Code</th>
                <th className="text-right">Cases</th>
                <th className="text-right">Offenders</th>
                <th className="text-right">Arrests</th>
                <th className="text-right">Absconders</th>
                <th className="text-right">Contraband (Kg)</th>
                <th className="text-right">Cash (₹)</th>
              </tr>
            </thead>
            <tbody>
              {loading && !summary ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--color-garuda-400)] animate-pulse">
                    Loading breakdown table...
                  </td>
                </tr>
              ) : (
                summary?.psWiseData?.map((ps, i) => (
                  <tr
                    key={ps.psId}
                    className="table-row"
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>{ps.psName}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-garuda-400)' }}>{ps.psCode}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#2563eb' }}>{formatNumber(ps.totalCases)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{formatNumber(ps.totalOffenders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#16a34a' }}>{formatNumber(ps.totalArrests)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#dc2626' }}>{formatNumber(ps.totalAbsconders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#d97706' }}>{formatNumber(ps.totalContrabandKg)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>₹{formatNumber(ps.totalCashSeized)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
