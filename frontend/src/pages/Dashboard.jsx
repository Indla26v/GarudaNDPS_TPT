import { useState, useEffect } from 'react';
import api from '../api/axios';
import { usePermissions } from '../hooks/usePermissions';

const STAT_CARDS = [
  { key: 'totalCases', label: 'Total Cases', icon: '', color: '#3b82f6' },
  { key: 'totalOffenders', label: 'Total Offenders', icon: '', color: '#8b5cf6' },
  { key: 'totalArrests', label: 'Total Arrests', icon: '', color: '#22c55e' },
  { key: 'totalAbsconders', label: 'Absconders', icon: '', color: '#ef4444' },
  { key: 'totalContrabandKg', label: 'Contraband (Kg)', icon: '', color: '#f59e0b' },
  { key: 'totalCashSeized', label: 'Cash Seized (INR)', icon: '', color: '#06b6d4' },
  { key: 'totalVehiclesSeized', label: 'Vehicles Seized', icon: '', color: '#ec4899' },
];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { isAdmin, isSP, isDSP, isCI, isSI, isConstable, role, canViewAllPS } = usePermissions();

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
          {isAdmin ? 'Anti-Drug Operations Overview — Andhra Pradesh' : 'Anti-Drug Operations Overview'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className="rounded-xl p-4 transition-all duration-300 hover:scale-105 animate-slide-up"
            style={{
              background: 'var(--color-garuda-800)',
              border: '1px solid var(--color-garuda-700)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {formatNumber(summary?.[card.key])}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>{card.label}</p>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>District-wise Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-garuda-700)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>District</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Cases</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Offenders</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Arrests</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Absconders</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Contraband (Kg)</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Cash</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Vehicles</th>
                </tr>
              </thead>
              <tbody>
                {summary?.districtWiseData?.map((dist, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--color-garuda-100)' }}>{dist.district}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-info-400)' }}>{formatNumber(dist.totalCases)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{formatNumber(dist.totalOffenders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-success-400)' }}>{formatNumber(dist.totalArrests)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-danger-400)' }}>{formatNumber(dist.totalAbsconders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-warning-400)' }}>{formatNumber(dist.totalContrabandKg)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{formatNumber(dist.totalCashSeized)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#ec4899' }}>{formatNumber(dist.totalVehiclesSeized)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isSP && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>Police Station-wise Breakdown</h2>
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
                {summary?.psWiseData?.map((ps, i) => (
                  <tr key={ps.psId} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--color-garuda-100)' }}>{ps.psName}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-info-400)' }}>{formatNumber(ps.totalCases)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{formatNumber(ps.totalOffenders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-success-400)' }}>{formatNumber(ps.totalArrests)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-danger-400)' }}>{formatNumber(ps.totalAbsconders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-warning-400)' }}>{formatNumber(ps.totalContrabandKg)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{formatNumber(ps.totalCashSeized)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isAdmin && !isSP && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl p-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-garuda-100)' }}>Recent Cases</h3>
            <ul className="space-y-2">
              {summary?.recentCases?.map((c) => (
                <li key={c.id} className="p-3 rounded" style={{ background: 'var(--color-garuda-900)' }}>
                  <div className="flex justify-between">
                    <span className="font-medium" style={{ color: 'var(--color-garuda-100)' }}>{c.fir_number}</span>
                    <span className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>{new Date(c.case_date).toLocaleDateString()}</span>
                  </div>
                </li>
              ))}
              {(!summary?.recentCases || summary.recentCases.length === 0) && <li style={{ color: 'var(--color-garuda-400)' }}>No recent cases</li>}
            </ul>
          </div>
          {!isConstable && (
            <div className="space-y-6">
              <div className="rounded-xl p-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-garuda-100)' }}>Pending Edit Requests</h3>
                <ul className="space-y-2">
                  {summary?.editRequests?.map((r) => (
                    <li key={r.id} className="p-3 rounded" style={{ background: 'var(--color-garuda-900)' }}>
                      <span style={{ color: 'var(--color-garuda-100)' }}>{r.entity_type} ID: {r.entity_id}</span>
                    </li>
                  ))}
                  {(!summary?.editRequests || summary.editRequests.length === 0) && <li style={{ color: 'var(--color-garuda-400)' }}>No pending requests</li>}
                </ul>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-garuda-100)' }}>Absconders</h3>
                <ul className="space-y-2">
                  {summary?.absconders?.map((a) => (
                    <li key={a.id} className="p-3 rounded" style={{ background: 'var(--color-garuda-900)' }}>
                      <span style={{ color: 'var(--color-garuda-100)' }}>{a.cases?.fir_number}</span>
                    </li>
                  ))}
                  {(!summary?.absconders || summary.absconders.length === 0) && <li style={{ color: 'var(--color-garuda-400)' }}>No absconders</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
