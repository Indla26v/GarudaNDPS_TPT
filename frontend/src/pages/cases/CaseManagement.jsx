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
          <Link to="/cases/new" className="btn btn-primary">
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
            className="input flex-1"
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="select"
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
              className="card card-hover rounded-xl p-3 text-center cursor-pointer"
              style={{
                borderColor: stageFilter === key ? val.bg : undefined,
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
        <div className="card text-center py-16 rounded-xl">
          <p className="text-lg font-medium" style={{ color: 'var(--color-garuda-300)' }}>No cases found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-500)' }}>
            {search ? 'Try adjusting your search criteria' : 'Register a new case to get started'}
          </p>
        </div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th>FIR No.</th>
                  <th>Station</th>
                  <th>Section</th>
                  <th>Date</th>
                  <th>Stage</th>
                  <th>Accused</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const stage = STAGE_COLORS[c.stage] || STAGE_COLORS.FIR;
                  return (
                    <tr key={c.id} className="table-row">
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>{c.firNo}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>{c.psName || '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                        <span className="max-w-[200px] truncate block">{c.sectionOfLaw || '—'}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                        {c.caseDate ? new Date(c.caseDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: stage.bg + '14', color: stage.bg }}
                        >
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                        {c.accused?.length || 0} accused
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/cases/${c.id}`} className="btn btn-ghost btn-sm">
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
