import { useState, useEffect } from 'react';
import api from '../api/axios';

const STAT_CARDS = [
  { key: 'totalCases', label: 'Total Cases', icon: '📁', color: '#3b82f6' },
  { key: 'totalOffenders', label: 'Total Offenders', icon: '👤', color: '#8b5cf6' },
  { key: 'totalArrests', label: 'Total Arrests', icon: '🔒', color: '#22c55e' },
  { key: 'totalAbsconders', label: 'Absconders', icon: '🏃', color: '#ef4444' },
  { key: 'totalContrabandKg', label: 'Contraband (Kg)', icon: '⚖️', color: '#f59e0b' },
  { key: 'totalCashSeized', label: 'Cash Seized (₹)', icon: '💰', color: '#06b6d4' },
  { key: 'totalVehiclesSeized', label: 'Vehicles Seized', icon: '🚗', color: '#ec4899' },
];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '0';
    return Number(val).toLocaleString('en-IN');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Anti-Drug Operations Overview — Alluri Sitharama Raju District
        </p>
      </div>

      {/* ---- Stat Cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {STAT_CARDS.map((card) => (
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

      {/* ---- PS-wise Table ---- */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
            Police Station-wise Breakdown
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
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-garuda-700)'}
                  onMouseOut={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(26, 42, 74, 0.3)'}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>{ps.psName}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-garuda-400)' }}>{ps.psCode}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-info-400)' }}>{formatNumber(ps.totalCases)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{formatNumber(ps.totalOffenders)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-success-400)' }}>{formatNumber(ps.totalArrests)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-danger-400)' }}>{formatNumber(ps.totalAbsconders)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-warning-400)' }}>{formatNumber(ps.totalContrabandKg)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>₹{formatNumber(ps.totalCashSeized)}</td>
                </tr>
              ))}
              {(!summary?.psWiseData || summary.psWiseData.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: 'var(--color-garuda-500)' }}>
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
