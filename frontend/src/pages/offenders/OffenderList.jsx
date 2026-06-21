import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useSSE } from '../../hooks/useSSE';

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

export default function OffenderList({ isConsumerOnly = false }) {
  const { user } = useAuth();
  const [offenders, setOffenders] = useState([]);
  const [search, setSearch] = useState('');
  const [psFilter, setPsFilter] = useState(() => {
    const role = user?.role;
    if (role === 'SP' || role === 'ASP' || role === 'SDPO') {
      return '';
    }
    return user?.policeStationId ? String(user.policeStationId) : '';
  });
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const { lastEvent } = useSSE();
  const [importLogs, setImportLogs] = useState([]);

  useEffect(() => {
    if (lastEvent?.type === 'data_updated' && lastEvent?.data?.source === 'import') {
      const stats = lastEvent.data.stats;
      const logMessage = {
        id: 'sse_' + Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        text: `Excel Import Processed: Parsed ${stats.rows} rows, Created ${stats.casesCreated} cases, Registered ${stats.offendersCreated} offenders.`,
        errors: stats.errors || []
      };
      setImportLogs(prev => {
        const exists = prev.some(l => l.text === logMessage.text);
        if (exists) return prev;
        return [logMessage, ...prev];
      });
      fetchOffenders();
    }
  }, [lastEvent]);

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/offenders/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const stats = res.data.data;
      const logMessage = {
        id: 'user_' + Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        text: `Excel Import Processed: Parsed ${stats.rows} rows, Created ${stats.casesCreated} cases, Registered ${stats.offendersCreated} offenders.`,
        errors: stats.errors || []
      };
      setImportLogs(prev => {
        const exists = prev.some(l => l.text === logMessage.text);
        if (exists) return prev;
        return [logMessage, ...prev];
      });
      fetchOffenders();
    } catch (err) {
      console.error(err);
      const logMessage = {
        id: 'err_' + Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        text: `Import Failed: ${err.response?.data?.message || err.message || 'Unknown error'}`,
        errors: [err.response?.data?.message || err.message || 'Unknown error']
      };
      setImportLogs(prev => [logMessage, ...prev]);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  useEffect(() => {
    fetchOffenders();
  }, [page, psFilter, categoryFilter, isConsumerOnly]);

  const fetchStations = async () => {
    try {
      const res = await api.get('/police-stations');
      setStations(res.data.data || []);
    } catch { /* ignore */ }
  };

  const handleExport = async () => {
    try {
      const params = {};
      params.psId = psFilter;
      if (search.trim()) params.query = search.trim();
      if (isConsumerOnly) {
        params.category = 'CONSUMER';
      } else if (categoryFilter) {
        params.category = categoryFilter;
      }
      const res = await api.get('/offenders/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${isConsumerOnly ? 'consumers' : 'offenders'}-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    }
  };

  const fetchOffenders = async () => {
    setLoading(true);
    try {
      const params = { page, size: 20 };
      if (search.trim()) params.query = search.trim();
      params.psId = psFilter;
      if (isConsumerOnly) {
        params.category = 'CONSUMER';
      } else if (categoryFilter) {
        params.category = categoryFilter;
      }
      const res = await api.get('/offenders', { params });
      const data = res.data.data;
      setOffenders(data?.content || []);
      setTotalPages(data?.totalPages || 0);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchOffenders();
  };

  const categoryColors = {
    CONSUMER: { bg: 'rgba(59, 130, 246, 0.08)', color: '#1d4ed8' },
    LOCAL_PEDDLER: { bg: 'rgba(245, 158, 11, 0.08)', color: '#b45309' },
    SUPPLIER: { bg: 'rgba(239, 68, 68, 0.08)', color: '#b91c1c' },
    LOCAL_SUPPLIER: { bg: 'rgba(239, 68, 68, 0.08)', color: '#b91c1c' },
    LOCAL_KINGPIN: { bg: 'rgba(236, 72, 153, 0.08)', color: '#be185d' },
    TRANSPORTER: { bg: 'rgba(34, 197, 94, 0.08)', color: '#15803d' },
    INTERSTATE_KINGPIN: { bg: 'rgba(168, 85, 247, 0.08)', color: '#6d28d9' },
  };

  return (
    <div className={`space-y-6 animate-fade-in ${totalPages > 1 ? 'pr-12 sm:pr-16' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            {isConsumerOnly ? 'Consumer Database' : 'Offender Database'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            {isConsumerOnly ? 'Search, filter, and manage consumer profiles' : 'Search, filter, and manage offender profiles'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {importing ? (
            <span className="text-xs animate-pulse font-semibold self-center" style={{ color: 'var(--color-garuda-400)' }}>Importing...</span>
          ) : (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportExcel}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary btn-sm"
              >
                Import Excel
              </button>
            </>
          )}
          <button type="button" onClick={handleExport} className="btn btn-secondary btn-sm">
            Export CSV
          </button>
          <button
            onClick={() => navigate('/offenders/new')}
            className="btn btn-primary btn-sm"
          >
            {isConsumerOnly ? '+ Add Consumer' : '+ Add Offender'}
          </button>
        </div>
      </div>

      {/* Real-time Import Logs Section */}
      {importLogs.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Real-time Import Logs
              </h3>
            </div>
            <button
              onClick={() => setImportLogs([])}
              className="text-xs hover:underline cursor-pointer border-none bg-transparent text-slate-400"
            >
              Clear Logs
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {importLogs.map((log) => (
              <ImportLogCard 
                key={log.id} 
                log={log} 
                onDismiss={(id) => setImportLogs(prev => prev.filter(l => l.id !== id))} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card flex flex-col md:flex-row gap-3 p-4 rounded-xl">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            id="offender-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, alias, or mobile..."
            className="input flex-1"
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
        {!isConsumerOnly && (
          <select
            id="offender-category-filter"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="select"
          >
            <option value="">All Categories</option>
            <option value="CONSUMER">Consumer</option>
            <option value="LOCAL_PEDDLER">Local Peddler</option>
            <option value="LOCAL_SUPPLIER">Local Supplier</option>
            <option value="LOCAL_KINGPIN">Local Kingpin</option>
            <option value="TRANSPORTER">Transporter</option>
            <option value="INTERSTATE_KINGPIN">Interstate Kingpin</option>
          </select>
        )}
        <select
          id="offender-ps-filter"
          value={psFilter}
          onChange={(e) => { setPsFilter(e.target.value); setPage(0); }}
          className="select"
        >
          <option value="">All Police Stations</option>
          {stations.map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card rounded-xl overflow-hidden border border-slate-100/50 dark:border-slate-800">
        {/* Desktop View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                {['S.No', 'CR.NO', 'Full Name', 'Alias', 'PS', 'District', 'Mobile', 'Cases', 'Actions'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map((idx) => (
                  <tr key={idx} className="table-row animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-6"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-16"></div></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                        <div className="h-4 bg-slate-700 rounded w-24"></div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-16"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-20"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-16"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-24"></div></td>
                    <td className="px-4 py-3 text-center"><div className="h-4 bg-slate-700 rounded w-8 mx-auto"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-700 rounded w-12"></div></td>
                  </tr>
                ))
              ) : offenders.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: 'var(--color-garuda-500)' }}>No offenders found</td></tr>
              ) : (
                offenders.map((o, i) => {
                  const cat = categoryColors[o.category] || { bg: 'transparent', color: 'var(--color-garuda-300)' };
                  return (
                    <tr
                      key={o.id}
                      className="table-row cursor-pointer"
                      onClick={() => navigate(`/offenders/${o.id}`)}
                    >
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-400)' }}>{page * 20 + i + 1}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-400)' }}>{o.crNo || '-'}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>
                        <div className="flex items-center gap-3">
                          {o.photoUrl ? (
                            <img
                              src={o.photoUrl}
                              alt={o.fullName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-700 bg-slate-900 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: getAvatarColor(o.fullName) }}
                            >
                              {o.fullName?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <span>{o.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>{o.alias || '-'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>{o.psName}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-400)' }}>{o.district || '-'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-200)' }}>{o.mobile || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(59,130,246,0.08)', color: '#1d4ed8' }}>
                          {o.totalCases || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/offenders/${o.id}`); }}
                            className="btn btn-ghost btn-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/offenders/${o.id}/edit`); }}
                            className="btn btn-ghost btn-sm"
                          >
                            Edit
                          </button>
                        </div>
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-700 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="h-3 bg-slate-700 rounded w-1/4 mt-2"></div>
                <div className="h-8 bg-slate-700/60 rounded mt-2"></div>
              </div>
            ))
          ) : offenders.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--color-garuda-500)' }}>No profiles found</div>
          ) : (
            offenders.map((o) => {
              const cat = categoryColors[o.category] || { bg: 'transparent', color: 'var(--color-garuda-300)' };
              return (
                <div
                  key={o.id}
                  onClick={() => navigate(`/offenders/${o.id}`)}
                  className="rounded-xl border p-4 space-y-3 transition-colors active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                  style={{
                    background: 'var(--color-garuda-900)',
                    borderColor: 'var(--color-garuda-700)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {o.photoUrl ? (
                      <img
                        src={o.photoUrl}
                        alt={o.fullName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-900 flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: getAvatarColor(o.fullName) }}
                      >
                        {o.fullName?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate" style={{ color: 'var(--color-garuda-100)' }}>{o.fullName}</h4>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>
                        Alias: {o.alias || '—'} • Mobile: {o.mobile || '—'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider" style={{ background: cat.bg, color: cat.color }}>
                      {o.category?.replace('_', ' ') || '-'}
                    </span>
                    <div className="text-right">
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-garuda-200)' }}>{o.psName}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-garuda-500)' }}>{o.district || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg text-xs" style={{ background: 'var(--color-garuda-600)' }}>
                    <span style={{ color: 'var(--color-garuda-400)' }}>Cases Linked</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(59,130,246,0.08)', color: '#1d4ed8' }}>
                      {o.totalCases || 0}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div 
            className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2.5 p-2 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md"
            style={{ minWidth: '44px' }}
          >
            {/* Page Number indicator at the top */}
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center select-none pb-1.5 border-b border-slate-100 dark:border-slate-800 w-full mb-0.5">
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

            {/* Vertical Page List */}
            <div className="flex flex-col gap-1.5">
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
    </div>
  );
}

function ImportLogCard({ log, onDismiss }) {
  const [showErrors, setShowErrors] = useState(false);
  const hasErrors = log.errors && log.errors.length > 0;

  return (
    <div 
      className="card rounded-xl p-4 border relative overflow-hidden transition-all duration-300"
      style={{ 
        background: 'var(--color-garuda-800)',
        borderColor: hasErrors ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
            style={{ 
              background: hasErrors ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: hasErrors ? '#f87171' : '#34d399'
            }}
          >
            {hasErrors ? '⚠️' : '✓'}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
              {log.text}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-garuda-400)' }}>
              Received at {log.timestamp} • {hasErrors ? `${log.errors.length} item(s) logged` : 'Clean import'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onDismiss(log.id)}
          className="text-xs hover:text-white cursor-pointer bg-transparent border-none text-slate-500"
        >
          ✕
        </button>
      </div>

      {hasErrors && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none text-left"
            style={{ color: 'var(--color-accent-400)' }}
          >
            {showErrors ? 'Hide details' : `Show logs / errors (${log.errors.length})`}
          </button>
          {showErrors && (
            <div 
              className="mt-2 p-3 rounded-lg text-xs font-mono max-h-40 overflow-y-auto"
              style={{ 
                background: 'var(--color-garuda-950)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.15)'
              }}
            >
              {log.errors.map((err, idx) => (
                <div key={idx} className="py-0.5 border-b border-red-950/20 last:border-b-0">
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
