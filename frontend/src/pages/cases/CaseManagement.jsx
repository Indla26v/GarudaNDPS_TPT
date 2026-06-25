/**
 * GARUDA — Case Management Module (Page 3)
 * Route: /cases
 * Full lifecycle management of NDPS cases from FIR registration to conviction.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const [stageCounts, setStageCounts] = useState({
    FIR: 0,
    CHARGESHEET: 0,
    TRIAL: 0,
    CONVICTED: 0,
    ACQUITTED: 0,
    CLOSED: 0,
  });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const perms = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCases();
  }, [stageFilter, page]);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const params = { page, size: 30 };
      if (stageFilter) params.stage = stageFilter;
      if (search) params.search = search;
      const res = await api.get('/cases', { params });
      const payload = res.data.data;
      setCases(payload?.content || (Array.isArray(payload) ? payload : []));
      setTotalPages(payload?.totalPages || 1);
      if (payload?.stageCounts) {
        setStageCounts(payload.stageCounts);
      }
    } catch (err) {
      setError('Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (page === 0) {
      fetchCases();
    } else {
      setPage(0);
    }
  };

  const handleStageClick = (key) => {
    setStageFilter(prev => prev === key ? '' : key);
    setPage(0);
  };

  const handleStageSelect = (e) => {
    setStageFilter(e.target.value);
    setPage(0);
  };

  return (
    <div className={`space-y-6 animate-fade-in ${totalPages > 1 ? 'pb-20 sm:pb-6 pr-0 sm:pr-16' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Case Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            NDPS case lifecycle — FIR to conviction
          </p>
        </div>
        {(perms.canRegisterCase) && (
          <Link to="/cases/new" className="btn btn-primary whitespace-nowrap">
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
          onChange={handleStageSelect}
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
          const count = stageCounts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => handleStageClick(key)}
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
      {error ? (
        <div className="text-center py-8" style={{ color: 'var(--color-danger-400)' }}>{error}</div>
      ) : (
        <div className="card rounded-xl overflow-hidden border border-slate-100/50 dark:border-slate-800">
          {/* Desktop View */}
          <div className="hidden sm:block overflow-x-auto">
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
                {loading ? (
                  [1, 2, 3, 4, 5].map((idx) => (
                    <tr key={idx} className="table-row animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-16"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-24"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-32"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-20"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-16"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-12"></div></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-700 rounded w-10 ml-auto"></div></td>
                    </tr>
                  ))
                ) : cases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--color-garuda-500)' }}>
                      No cases found
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => {
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
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="block sm:hidden p-4 space-y-3">
            {loading ? (
              [1, 2, 3].map((idx) => (
                <div key={idx} className="rounded-xl border p-4 space-y-3 animate-pulse" style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-700)' }}>
                  <div className="flex justify-between">
                    <div className="w-1/3 h-4 bg-slate-700 rounded"></div>
                    <div className="w-1/4 h-4 bg-slate-700 rounded"></div>
                  </div>
                  <div className="w-1/2 h-4 bg-slate-700 rounded"></div>
                  <div className="flex justify-between">
                    <div className="w-1/4 h-3 bg-slate-700 rounded"></div>
                    <div className="w-1/5 h-3 bg-slate-700 rounded"></div>
                  </div>
                </div>
              ))
            ) : cases.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--color-garuda-500)' }}>No cases found</div>
            ) : (
              cases.map((c) => {
                const stage = STAGE_COLORS[c.stage] || STAGE_COLORS.FIR;
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="rounded-xl border p-4 space-y-3 transition-colors active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                    style={{
                      background: 'var(--color-garuda-900)',
                      borderColor: 'var(--color-garuda-700)',
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: 'var(--color-garuda-100)' }}>FIR: {c.firNo}</h4>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>
                          {c.psName || '—'} • {c.caseDate ? new Date(c.caseDate).toLocaleDateString('en-IN') : '—'}
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: stage.bg + '14', color: stage.bg }}
                      >
                        {stage.label}
                      </span>
                    </div>

                    <div className="text-xs py-1.5 px-2.5 rounded" style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-250)' }}>
                      <span className="font-semibold text-slate-500 mr-1">Section:</span>
                      <span style={{ color: 'var(--color-garuda-100)' }}>{c.sectionOfLaw || '—'}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span style={{ color: 'var(--color-garuda-400)' }}>Linked Accused</span>
                      <span className="font-bold" style={{ color: 'var(--color-accent-400)' }}>{c.accused?.length || 0} accused</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && !loading && (
            <div 
              className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-4 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 z-50 flex flex-row sm:flex-col items-center gap-2 p-2 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md"
              style={{ minWidth: '44px' }}
            >
              {/* Page Number indicator at the top */}
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center select-none pr-2 sm:pr-0 pb-0 sm:pb-1.5 border-r sm:border-r-0 sm:border-b border-slate-200 dark:border-slate-800 mr-1.5 sm:mr-0">
                {page + 1}/{totalPages}
              </div>
              
              {/* Previous Button (Up Arrow) */}
              <button
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0 || loading}
                title="Previous Page"
                className="btn btn-secondary btn-sm w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ padding: 0 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>

              {/* Page List */}
              <div className="flex flex-row sm:flex-col gap-1.5">
                {Array.from({ length: totalPages }).map((_, index) => {
                  if (
                    totalPages <= 6 ||
                    index < 2 ||
                    index === totalPages - 1 ||
                    (index >= page - 1 && index <= page + 1)
                  ) {
                    const isCurrent = page === index;
                    return (
                      <button
                        key={index}
                        onClick={() => setPage(index)}
                        className={`btn btn-sm w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold ${
                          isCurrent
                            ? 'btn-primary'
                            : 'btn-secondary text-slate-500 dark:text-slate-400'
                        }`}
                        style={{ padding: 0 }}
                      >
                        {index + 1}
                      </button>
                    );
                  }
                  if (
                    (index === 2 && page > 2) ||
                    (index === totalPages - 2 && page < totalPages - 3)
                  ) {
                    return (
                      <span key={`ellipsis-${index}`} className="text-slate-400 dark:text-slate-500 text-center select-none text-[10px] leading-none py-0.5 font-bold">
                        •••
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Next Button (Down Arrow) */}
              <button
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={page === totalPages - 1 || loading}
                title="Next Page"
                className="btn btn-secondary btn-sm w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ padding: 0 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
