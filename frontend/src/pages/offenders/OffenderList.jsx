import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

export default function OffenderList({ isConsumerOnly = false }) {
  const [offenders, setOffenders] = useState([]);
  const [search, setSearch] = useState('');
  const [psFilter, setPsFilter] = useState('');
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStations();
  }, []);

  useEffect(() => {
    fetchOffenders();
  }, [page, psFilter, isConsumerOnly]);

  const fetchStations = async () => {
    try {
      const res = await api.get('/police-stations');
      setStations(res.data.data || []);
    } catch { /* ignore */ }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (psFilter) params.psId = psFilter;
      if (search.trim()) params.query = search.trim();
      if (isConsumerOnly) params.category = 'CONSUMER';
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
      if (psFilter) params.psId = psFilter;
      if (isConsumerOnly) params.category = 'CONSUMER';
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
    CONSUMER: { bg: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8' },
    LOCAL_PEDDLER: { bg: 'rgba(245, 158, 11, 0.1)', color: '#b45309' },
    SUPPLIER: { bg: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c' },
    LOCAL_KINGPIN: { bg: 'rgba(236, 72, 153, 0.1)', color: '#be185d' },
    TRANSPORTER: { bg: 'rgba(34, 197, 94, 0.1)', color: '#15803d' },
    INTERSTATE_KINGPIN: { bg: 'rgba(168, 85, 247, 0.1)', color: '#6d28d9' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            {isConsumerOnly ? 'Consumer Database' : 'Offender Database'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            {isConsumerOnly ? 'Search, filter, and manage consumer profiles' : 'Search, filter, and manage offender profiles'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => navigate('/offenders/new')}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-400))' }}
          >
            {isConsumerOnly ? '+ Add Consumer' : '+ Add Offender'}
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        className="flex flex-col md:flex-row gap-3 p-4 rounded-xl"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            id="offender-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, alias, or mobile..."
            className="flex-1 px-4 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)', color: 'var(--color-garuda-50)' }}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
          >
            Search
          </button>
        </form>
        <select
          id="offender-ps-filter"
          value={psFilter}
          onChange={(e) => { setPsFilter(e.target.value); setPage(0); }}
          className="px-4 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)', color: 'var(--color-garuda-50)' }}
        >
          <option value="">All Police Stations</option>
          {stations.map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-garuda-700)' }}>
                {['Sl.No', 'Full Name', 'Alias', 'Category', 'PS', 'District', 'Mobile', 'Cases', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: 'var(--color-garuda-500)' }}>Loading...</td></tr>
              ) : offenders.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: 'var(--color-garuda-500)' }}>No offenders found</td></tr>
              ) : (
                offenders.map((o, i) => {
                  const cat = categoryColors[o.category] || { bg: 'transparent', color: 'var(--color-garuda-300)' };
                  return (
                    <tr
                      key={o.id}
                      className="transition-colors duration-150 cursor-pointer"
                      style={{ borderBottom: '1px solid var(--color-garuda-700)' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-garuda-600)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      onClick={() => navigate(`/offenders/${o.id}/edit`)}
                    >
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-400)' }}>{o.slNo || '-'}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>{o.fullName}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>{o.alias || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-md text-xs font-medium" style={{ background: cat.bg, color: cat.color }}>
                          {o.category?.replace('_', ' ') || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>{o.psName}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-400)' }}>{o.district || '-'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-garuda-200)' }}>{o.mobile || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(59,130,246,0.1)', color: '#1d4ed8' }}>
                          {o.totalCases || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/offenders/${o.id}/edit`); }}
                          className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
                          style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-200)' }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--color-garuda-700)' }}>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded text-sm cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}
            >
              Previous
            </button>
            <span className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded text-sm cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
