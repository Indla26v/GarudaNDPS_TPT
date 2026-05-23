/**
 * GARUDA — Case Management Module (Page 3)
 * Route: /cases
 * Full lifecycle management of NDPS cases from FIR registration to conviction.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';

const STAGE_COLORS = {
  FIR:         { bg: '#3b82f6', label: 'FIR Registered' },
  CHARGESHEET: { bg: '#f59e0b', label: 'Charge Sheet Filed' },
  TRIAL:       { bg: '#8b5cf6', label: 'Under Trial' },
  CONVICTED:   { bg: '#22c55e', label: 'Convicted' },
  ACQUITTED:   { bg: '#6b7280', label: 'Acquitted' },
  CLOSED:      { bg: '#ef4444', label: 'Closed' },
};

export default function CaseManagement() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const perms = usePermissions();

  useEffect(() => {
    fetchCases();
  }, [stageFilter]);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const params = {};
      if (stageFilter) params.stage = stageFilter;
      if (search) params.search = search;
      const res = await api.get('/cases', { params });
      const payload = res.data.data;
      setCases(payload?.content || (Array.isArray(payload) ? payload : []));
    } catch (err) {
      setError('Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCases();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Case Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            NDPS case lifecycle — FIR to conviction
          </p>
        </div>
        {(perms.canRegisterCase) && (
          <Link
            to="/cases/new"
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-400))',
              color: '#fff',
            }}
          >
            + Register New Case
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[300px]">
          <input
            type="text"
            placeholder="Search by FIR No., accused name, station..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--color-garuda-800)',
              border: '1px solid var(--color-garuda-600)',
              color: 'var(--color-garuda-100)',
            }}
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}
          >
            Search
          </button>
        </form>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
          style={{
            background: 'var(--color-garuda-800)',
            border: '1px solid var(--color-garuda-600)',
            color: 'var(--color-garuda-100)',
          }}
        >
          <option value="">All Stages</option>
          {Object.entries(STAGE_COLORS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Stage Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(STAGE_COLORS).map(([key, val]) => {
          const count = cases.filter(c => c.stage === key).length;
          return (
            <button
              key={key}
              onClick={() => setStageFilter(stageFilter === key ? '' : key)}
              className="rounded-xl p-3 text-center cursor-pointer transition-all duration-200 hover:scale-105"
              style={{
                background: stageFilter === key ? val.bg + '22' : 'var(--color-garuda-800)',
                border: `1px solid ${stageFilter === key ? val.bg : 'var(--color-garuda-700)'}`,
              }}
            >
              <p className="text-xl font-bold" style={{ color: val.bg }}>{count}</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-garuda-400)' }}>{val.label}</p>
            </button>
          );
        })}
      </div>

      {/* Cases Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-sm animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading cases...</div>
        </div>
      ) : error ? (
        <div className="text-center py-8" style={{ color: 'var(--color-danger-400)' }}>{error}</div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <p className="text-lg font-medium" style={{ color: 'var(--color-garuda-300)' }}>No cases found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-500)' }}>
            {search ? 'Try adjusting your search criteria' : 'Register a new case to get started'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-garuda-700)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>FIR No.</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Station</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Section</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Date</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Stage</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Accused</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const stage = STAGE_COLORS[c.stage] || STAGE_COLORS.FIR;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>{c.fir_no}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>{c.police_stations?.name || '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                        <span className="max-w-[200px] truncate block">{c.section_of_law || '—'}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                        {c.case_date ? new Date(c.case_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: stage.bg + '22', color: stage.bg }}
                        >
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                        {c.case_accused?.length || 0} accused
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/cases/${c.id}`}
                          className="text-xs font-medium px-3 py-1 rounded-md transition-colors"
                          style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
